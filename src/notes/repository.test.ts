import { beforeEach, describe, expect, it } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { NotesRepository } from './repository'

describe('NotesRepository', () => {
  let db: BloquinhoDB
  let now: number
  let repository: NotesRepository

  beforeEach(async () => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    now = 1_000
    repository = new NotesRepository(db, () => now)
  })

  it('creates pending notes', async () => {
    const note = await repository.create({ content: 'oi' })
    expect(await db.notes.get(note.id)).toMatchObject({
      content: 'oi',
      color: 'default',
      pinned: false,
      createdAt: 1_000,
      updatedAt: 1_000,
      deletedAt: null,
      syncState: 'pending',
    })
  })

  it('bumps updatedAt even when the clock does not move', async () => {
    const note = await repository.create({ content: 'oi' })
    await db.notes.update(note.id, { syncState: 'synced' })
    await repository.update(note.id, { content: 'olá' })
    expect(await db.notes.get(note.id)).toMatchObject({ content: 'olá', updatedAt: 1_001, syncState: 'pending' })
  })

  it('soft deletes and hides notes', async () => {
    const note = await repository.create({ content: 'apagar' })
    now = 2_000
    await repository.remove(note.id)
    expect(await db.notes.get(note.id)).toMatchObject({ deletedAt: 2_000, updatedAt: 2_000 })
    expect(await repository.listVisible()).toEqual([])
  })

  it('restores a deleted note even after its tombstone was purged', async () => {
    const note = await repository.create({ content: 'voltar' })
    await repository.remove(note.id)
    await db.notes.delete(note.id)
    await repository.restore(note)
    const [restored] = await repository.listVisible()
    expect(restored).toMatchObject({ id: note.id, content: 'voltar', deletedAt: null, syncState: 'pending' })
    expect(restored.updatedAt).toBeGreaterThan(note.updatedAt)
  })
})
