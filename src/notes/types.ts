export const NOTE_COLORS = [
  'default',
  'lemon',
  'lime',
  'mint',
  'aqua',
  'sky',
  'lavender',
  'bubblegum',
  'coral',
] as const

export const NOTE_MAX_LENGTH = 20_000

export type NoteColor = (typeof NOTE_COLORS)[number]

export type SyncState = 'pending' | 'synced'

export interface NoteData {
  id: string
  content: string
  color: NoteColor
  pinned: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Note extends NoteData {
  syncState: SyncState
}

export interface NewNote {
  content: string
  color?: NoteColor
  pinned?: boolean
}

export type NoteChanges = Partial<Pick<Note, 'content' | 'color' | 'pinned'>>

const LEGACY_COLORS: Record<string, NoteColor> = {
  red: 'coral',
  orange: 'lemon',
  yellow: 'lemon',
  green: 'mint',
  teal: 'aqua',
  blue: 'sky',
  purple: 'lavender',
  pink: 'bubblegum',
}

export function isNoteColor(value: unknown): value is NoteColor {
  return NOTE_COLORS.includes(value as NoteColor)
}

export function toNoteColor(value: unknown): NoteColor {
  if (isNoteColor(value)) return value
  return (typeof value === 'string' && LEGACY_COLORS[value]) || 'default'
}
