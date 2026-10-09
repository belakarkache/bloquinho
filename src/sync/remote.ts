import type { NoteData } from '../notes/types'

export const PUSH_BATCH_SIZE = 200

export interface PullPage {
  notes: NoteData[]
  cursor: string | null
  hasMore: boolean
}

export interface NotesRemote {
  push(notes: NoteData[]): Promise<void>
  pull(since: string | null): Promise<PullPage>
}

export class RateLimitedError extends Error {
  constructor() {
    super('Too many sync requests')
    this.name = 'RateLimitedError'
  }
}

export class QuotaExceededError extends Error {
  constructor() {
    super('Storage quota exceeded')
    this.name = 'QuotaExceededError'
  }
}
