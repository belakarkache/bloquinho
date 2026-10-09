import type { BloquinhoDB } from '../db/database'
import { NOTE_MAX_LENGTH, type Note, type NoteData } from '../notes/types'
import { PUSH_BATCH_SIZE, type NotesRemote } from './remote'

export const PULL_CURSOR_KEY = 'pullCursor'
export const PULL_OVERLAP_MS = 60_000

export async function pushPending(db: BloquinhoDB, remote: NotesRemote): Promise<number> {
  const pending = await db.pendingNotes().filter(fitsRemoteLimits).toArray()

  for (let start = 0; start < pending.length; start += PUSH_BATCH_SIZE) {
    const batch = pending.slice(start, start + PUSH_BATCH_SIZE)
    await remote.push(batch.map(toOutgoingNote))
    await markPushed(db, batch)
  }
  return pending.length
}

async function markPushed(db: BloquinhoDB, sent: Note[]): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    for (const note of sent) {
      const current = await db.notes.get(note.id)
      if (!current || current.updatedAt !== note.updatedAt) continue
      if (current.deletedAt !== null) await db.notes.delete(note.id)
      else await db.notes.update(note.id, { syncState: 'synced' })
    }
  })
}

function fitsRemoteLimits(note: Note): boolean {
  return note.deletedAt !== null || note.content.length <= NOTE_MAX_LENGTH
}

export async function pullChanges(db: BloquinhoDB, remote: NotesRemote): Promise<void> {
  const storedCursor = await db.getMeta(PULL_CURSOR_KEY)
  let since = withOverlap(storedCursor)
  let hasMore = true

  while (hasMore) {
    const page = await remote.pull(since)
    await db.transaction('rw', db.notes, db.meta, async () => {
      for (const incoming of page.notes) await applyRemoteNote(db, incoming)
      if (page.cursor) await db.setMeta(PULL_CURSOR_KEY, page.cursor)
    })
    since = page.cursor ?? since
    hasMore = page.hasMore && page.cursor !== null
  }
}

async function applyRemoteNote(db: BloquinhoDB, incoming: NoteData): Promise<void> {
  const local = await db.notes.get(incoming.id)
  if (local && local.updatedAt >= incoming.updatedAt) return
  if (incoming.deletedAt !== null) {
    if (local) await db.notes.delete(incoming.id)
    return
  }
  await db.notes.put({ ...incoming, syncState: 'synced' })
}

function withOverlap(cursor: string | null): string | null {
  if (!cursor) return null
  return new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString()
}

function toOutgoingNote({ id, content, color, pinned, createdAt, updatedAt, deletedAt }: Note): NoteData {
  return { id, content: deletedAt === null ? content : '', color, pinned, createdAt, updatedAt, deletedAt }
}
