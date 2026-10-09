import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { toNoteColor, type NoteData } from '../notes/types'
import { QuotaExceededError, RateLimitedError, type NotesRemote, type PullPage } from './remote'

const PAGE_SIZE = 500

interface NoteRow {
  id: string
  content: string
  color: string
  pinned: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  server_updated_at: string
}

function toRow(note: NoteData): Omit<NoteRow, 'server_updated_at'> {
  return {
    id: note.id,
    content: note.content,
    color: note.color,
    pinned: note.pinned,
    created_at: new Date(note.createdAt).toISOString(),
    updated_at: new Date(note.updatedAt).toISOString(),
    deleted_at: note.deletedAt === null ? null : new Date(note.deletedAt).toISOString(),
  }
}

function fromRow(row: NoteRow): NoteData {
  return {
    id: row.id,
    content: row.content,
    color: toNoteColor(row.color),
    pinned: row.pinned,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    deletedAt: row.deleted_at === null ? null : Date.parse(row.deleted_at),
  }
}

function toSyncError(error: PostgrestError): Error {
  if (error.code === 'PT429') return new RateLimitedError()
  if (error.code === 'PT413') return new QuotaExceededError()
  return error
}

export function createSupabaseRemote(client: SupabaseClient): NotesRemote {
  return {
    async push(notes) {
      const { error } = await client.rpc('push_notes', { payload: notes.map(toRow) })
      if (error) throw toSyncError(error)
    },

    async pull(since): Promise<PullPage> {
      const { data, error } = await client.rpc('pull_notes', { since, page_size: PAGE_SIZE })
      if (error) throw toSyncError(error)
      const rows = (data ?? []) as NoteRow[]
      return {
        notes: rows.map(fromRow),
        cursor: rows.at(-1)?.server_updated_at ?? null,
        hasMore: rows.length === PAGE_SIZE,
      }
    },
  }
}
