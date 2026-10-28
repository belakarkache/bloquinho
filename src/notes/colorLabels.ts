import { db as defaultDb, type BloquinhoDB } from '../db/database'
import { COLOR_LABEL_MAX_LENGTH, type NoteColor } from './types'

function normalizeLabel(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, COLOR_LABEL_MAX_LENGTH)
}

export class ColorLabelsRepository {
  readonly #db: BloquinhoDB
  readonly #now: () => number

  constructor(database: BloquinhoDB, now: () => number = Date.now) {
    this.#db = database
    this.#now = now
  }

  async rename(color: NoteColor, name: string): Promise<void> {
    const normalized = normalizeLabel(name)
    await this.#db.transaction('rw', this.#db.colorLabels, async () => {
      const current = await this.#db.colorLabels.get(color)
      if ((current?.name ?? '') === normalized) return
      const changes = {
        name: normalized,
        updatedAt: Math.max(this.#now(), (current?.updatedAt ?? 0) + 1),
        syncState: 'pending' as const,
      }
      if (current) await this.#db.colorLabels.update(color, changes)
      else await this.#db.colorLabels.add({ color, ...changes })
    })
  }
}

export const colorLabelsRepository = new ColorLabelsRepository(defaultDb)
