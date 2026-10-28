import { NOTE_COLORS, type NoteColor } from '../notes/types'

export const CARD_COLUMNS = ['todo', 'doing', 'done'] as const

export const CARD_TITLE_MAX_LENGTH = 200
export const CARD_DESCRIPTION_MAX_LENGTH = 2_000
export const CARD_FOLDER_MAX_LENGTH = 60

export type FolderColor = Exclude<NoteColor, 'default'>

export const FOLDER_COLORS = NOTE_COLORS.filter((color): color is FolderColor => color !== 'default')

export type CardColumn = (typeof CARD_COLUMNS)[number]

type SyncState = 'pending' | 'synced'

export interface CardData {
  id: string
  title: string
  description: string
  column: CardColumn
  order: number
  folder: string | null
  sourceExcerpt: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Card extends CardData {
  syncState: SyncState
}

export interface FolderData {
  name: string
  color: FolderColor
  updatedAt: number
}

export interface Folder extends FolderData {
  syncState: SyncState
}

export interface NewCard {
  title: string
  description?: string
  column?: CardColumn
  folder?: string | null
  sourceExcerpt?: string
}

export type CardChanges = Partial<Pick<Card, 'title' | 'description' | 'folder'>>

export function isCardColumn(value: unknown): value is CardColumn {
  return CARD_COLUMNS.includes(value as CardColumn)
}
