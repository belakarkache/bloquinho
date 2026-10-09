import { toPlainText } from './checklist'
import { applyOrder } from './order'
import type { Note, NoteColor } from './types'

export interface NoteFilter {
  query: string
  color: NoteColor | null
}

export interface PartitionedNotes {
  pinned: Note[]
  others: Note[]
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function matchesFilter(note: Note, { query, color }: NoteFilter): boolean {
  if (color && note.color !== color) return false
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const content = normalize(toPlainText(note.content))
  return terms.every((term) => content.includes(term))
}

export function filterNotes(notes: Note[], filter: NoteFilter): Note[] {
  return notes.filter((note) => matchesFilter(note, filter)).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function partitionNotes(notes: Note[], filter: NoteFilter, order: readonly string[] = []): PartitionedNotes {
  const visible = applyOrder(
    notes.filter((note) => matchesFilter(note, filter)),
    order,
  )
  return {
    pinned: visible.filter((note) => note.pinned),
    others: visible.filter((note) => !note.pinned),
  }
}
