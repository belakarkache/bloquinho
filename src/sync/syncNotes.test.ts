import { beforeEach, describe, expect, it } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { NotesRepository } from '../notes/repository'
import { NOTE_MAX_LENGTH, type NoteData } from '../notes/types'
import { FakeRemote } from '../test/fakeRemote'
import { PUSH_BATCH_SIZE } from './remote'
import { pullChanges, pushPending } from './syncNotes'

function remoteNote(overrides: Partial<NoteData>): NoteData {
  return {
    id: crypto.randomUUID(),
    content: 'remota',
    color: 'default',
    pinned: false,
    createdAt: 100,
    updatedAt: 100,
    deletedAt: null,
    ...overrides,
  }
}

describe('sync', () => {
  let db: BloquinhoDB
  let remote: FakeRemote
  let now: number
  let repository: NotesRepository

  beforeEach(() => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    remote = new FakeRemote()
    now = 1_000
    repository = new NotesRepository(db, () => now)
  })

  it('pushes pending notes and marks them synced', async () => {
    const note = await repository.create({ content: 'local' })
    expect(await pushPending(db, remote)).toBe(1)
    expect(remote.rows.get(note.id)?.note.content).toBe('local')
    expect((await db.notes.get(note.id))?.syncState).toBe('synced')
    expect(await pushPending(db, remote)).toBe(0)
  })

  it('keeps a note pending when it changed during the push', async () => {
    const note = await repository.create({ content: 'v1' })
    const push = remote.push.bind(remote)
    remote.push = async (notes) => {
      await push(notes)
      await repository.update(note.id, { content: 'v2' })
    }
    await pushPending(db, remote)
    expect(await db.notes.get(note.id)).toMatchObject({ content: 'v2', syncState: 'pending' })
  })

  it('purges local tombstones after pushing them', async () => {
    const note = await repository.create({ content: 'apagar' })
    await repository.remove(note.id)
    await pushPending(db, remote)
    expect(await db.notes.get(note.id)).toBeUndefined()
    expect(remote.rows.get(note.id)?.note.deletedAt).not.toBeNull()
  })

  it('pushes in batches the server accepts', async () => {
    const batchSizes: number[] = []
    const push = remote.push.bind(remote)
    remote.push = async (notes) => {
      batchSizes.push(notes.length)
      await push(notes)
    }
    for (let index = 0; index < PUSH_BATCH_SIZE + 1; index += 1) await repository.create({ content: `${index}` })
    expect(await pushPending(db, remote)).toBe(PUSH_BATCH_SIZE + 1)
    expect(batchSizes).toEqual([PUSH_BATCH_SIZE, 1])
  })

  it('keeps notes over the size limit pending without blocking the others', async () => {
    const tooLong = await repository.create({ content: 'x'.repeat(NOTE_MAX_LENGTH + 1) })
    const fine = await repository.create({ content: 'ok' })
    await pushPending(db, remote)
    expect(remote.rows.has(tooLong.id)).toBe(false)
    expect(remote.rows.has(fine.id)).toBe(true)
    expect((await db.notes.get(tooLong.id))?.syncState).toBe('pending')
  })

  it('sends deleted notes without content', async () => {
    const note = await repository.create({ content: 'segredo' })
    await repository.remove(note.id)
    await pushPending(db, remote)
    expect(remote.rows.get(note.id)?.note.content).toBe('')
  })

  it('pulls remote notes as synced', async () => {
    const incoming = remoteNote({})
    remote.store(incoming)
    await pullChanges(db, remote)
    expect(await db.notes.get(incoming.id)).toEqual({ ...incoming, syncState: 'synced' })
  })

  it('keeps the newer local edit over an older remote one', async () => {
    const note = await repository.create({ content: 'local novo' })
    remote.store(remoteNote({ id: note.id, content: 'remota velha', updatedAt: 500 }))
    await pullChanges(db, remote)
    expect(await db.notes.get(note.id)).toMatchObject({ content: 'local novo', syncState: 'pending' })
  })

  it('takes the newer remote edit over an older local one', async () => {
    const note = await repository.create({ content: 'local velha' })
    remote.store(remoteNote({ id: note.id, content: 'remota nova', updatedAt: 5_000 }))
    await pullChanges(db, remote)
    expect(await db.notes.get(note.id)).toMatchObject({ content: 'remota nova', syncState: 'synced' })
  })

  it('applies remote deletions', async () => {
    const incoming = remoteNote({})
    remote.store(incoming)
    await pullChanges(db, remote)
    remote.store({ ...incoming, updatedAt: 200, deletedAt: 200 })
    await pullChanges(db, remote)
    expect(await db.notes.get(incoming.id)).toBeUndefined()
  })

  it('pages through remote changes and stores the cursor', async () => {
    remote.pageSize = 2
    const incoming = [remoteNote({}), remoteNote({}), remoteNote({}), remoteNote({}), remoteNote({})]
    incoming.forEach((note) => remote.store(note))
    await pullChanges(db, remote)
    expect(await db.notes.count()).toBe(5)
    expect(await db.getMeta('pullCursor')).toBe([...remote.rows.values()].at(-1)?.serverUpdatedAt)
  })

  it('does not move the cursor back when nothing changed', async () => {
    remote.store(remoteNote({}))
    await pullChanges(db, remote)
    const cursor = await db.getMeta('pullCursor')
    await pullChanges(db, remote)
    expect(await db.getMeta('pullCursor')).toBe(cursor)
  })

  it('merges notes from two devices', async () => {
    const otherDb = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    const other = new NotesRepository(otherDb, () => now)
    await repository.create({ content: 'do celular' })
    await other.create({ content: 'do PC' })
    for (const device of [db, otherDb, db]) {
      await pullChanges(device, remote)
      await pushPending(device, remote)
    }
    await pullChanges(otherDb, remote)
    const contents = async (database: BloquinhoDB) => (await database.notes.toArray()).map((n) => n.content).sort()
    expect(await contents(db)).toEqual(['do PC', 'do celular'])
    expect(await contents(otherDb)).toEqual(['do PC', 'do celular'])
  })
})
