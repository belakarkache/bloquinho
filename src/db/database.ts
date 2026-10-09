import Dexie, { type EntityTable } from 'dexie'
import { toNoteColor, type Note } from '../notes/types'

export interface MetaEntry {
  key: string
  value: string
}

export class BloquinhoDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'bloquinho') {
    super(name)
    this.version(1).stores({
      notes: 'id, updatedAt, syncState',
      meta: 'key',
    })
    this.version(2).upgrade((transaction) =>
      transaction
        .table<Note, string>('notes')
        .toCollection()
        .modify((note) => {
          note.color = toNoteColor(note.color)
        }),
    )
  }

  pendingNotes() {
    return this.notes.where('syncState').equals('pending')
  }

  async getMeta(key: string): Promise<string | null> {
    const entry = await this.meta.get(key)
    return entry?.value ?? null
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.meta.put({ key, value })
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', this.notes, this.meta, async () => {
      await this.notes.clear()
      await this.meta.clear()
    })
  }
}

export const db = new BloquinhoDB()
