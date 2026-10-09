import { db as defaultDb, type BloquinhoDB } from '../db/database'
import type { NewNote, Note, NoteChanges } from './types'

export class NotesRepository {
  readonly #db: BloquinhoDB
  readonly #now: () => number
  readonly #newId: () => string

  constructor(
    database: BloquinhoDB,
    now: () => number = Date.now,
    newId: () => string = () => crypto.randomUUID(),
  ) {
    this.#db = database
    this.#now = now
    this.#newId = newId
  }

  async create({ content, color = 'default', pinned = false }: NewNote): Promise<Note> {
    const timestamp = this.#now()
    const note: Note = {
      id: this.#newId(),
      content,
      color,
      pinned,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncState: 'pending',
    }
    await this.#db.notes.add(note)
    return note
  }

  async update(id: string, changes: NoteChanges): Promise<void> {
    await this.#db.transaction('rw', this.#db.notes, async () => {
      const current = await this.#db.notes.get(id)
      if (!current || current.deletedAt !== null) return
      await this.#db.notes.update(id, {
        ...changes,
        updatedAt: this.#nextTimestamp(current),
        syncState: 'pending',
      })
    })
  }

  async remove(id: string): Promise<void> {
    await this.#db.transaction('rw', this.#db.notes, async () => {
      const current = await this.#db.notes.get(id)
      if (!current || current.deletedAt !== null) return
      const timestamp = this.#nextTimestamp(current)
      await this.#db.notes.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
        syncState: 'pending',
      })
    })
  }

  async restore(note: Note): Promise<void> {
    await this.#db.transaction('rw', this.#db.notes, async () => {
      const current = await this.#db.notes.get(note.id)
      const latest = current && current.updatedAt > note.updatedAt ? current : note
      await this.#db.notes.put({
        ...note,
        deletedAt: null,
        updatedAt: this.#nextTimestamp(latest),
        syncState: 'pending',
      })
    })
  }

  async listVisible(): Promise<Note[]> {
    return this.#db.notes.filter((note) => note.deletedAt === null).toArray()
  }

  #nextTimestamp(current: Note): number {
    return Math.max(this.#now(), current.updatedAt + 1)
  }
}

export const notesRepository = new NotesRepository(defaultDb)
