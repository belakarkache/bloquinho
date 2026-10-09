import type { NoteData } from '../notes/types'
import type { NotesRemote, PullPage } from '../sync/remote'

interface StoredNote {
  note: NoteData
  serverUpdatedAt: string
}

export class FakeRemote implements NotesRemote {
  readonly rows = new Map<string, StoredNote>()
  pageSize = 100
  #tick = 0

  async push(notes: NoteData[]): Promise<void> {
    for (const note of notes) {
      const existing = this.rows.get(note.id)
      if (existing && existing.note.updatedAt >= note.updatedAt) continue
      this.store(note)
    }
  }

  async pull(since: string | null): Promise<PullPage> {
    const page = [...this.rows.values()]
      .filter((row) => since === null || row.serverUpdatedAt > since)
      .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt))
      .slice(0, this.pageSize)
    return {
      notes: page.map((row) => row.note),
      cursor: page.at(-1)?.serverUpdatedAt ?? null,
      hasMore: page.length === this.pageSize,
    }
  }

  store(note: NoteData): void {
    this.#tick += 1
    const serverUpdatedAt = new Date(Date.UTC(2026, 0, 1) + this.#tick * 120_000).toISOString()
    this.rows.set(note.id, { note, serverUpdatedAt })
  }
}
