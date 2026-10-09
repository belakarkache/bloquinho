import type { Icon } from '@phosphor-icons/react'
import { createContext, useContext, type MouseEvent } from 'react'
import type { NoteColor } from '../notes/types'

export interface MenuAction {
  kind: 'action'
  label: string
  icon: Icon
  onSelect: () => void
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  checked?: boolean
}

export interface MenuIconRow {
  kind: 'icons'
  label: string
  items: { label: string; icon: Icon; onSelect: () => void }[]
}

export interface MenuColorRow {
  kind: 'colors'
  label: string
  value: NoteColor
  onSelect: (color: NoteColor) => void
}

export interface MenuCaption {
  kind: 'caption'
  text: string
}

export type MenuEntry = MenuAction | MenuIconRow | MenuColorRow | MenuCaption
export type MenuGroup = MenuEntry[]
export type OpenContextMenu = (event: MouseEvent, groups: MenuGroup[]) => void

type ActionOptions = Pick<MenuAction, 'shortcut' | 'danger' | 'disabled' | 'checked'>

export function menuAction(label: string, icon: Icon, onSelect: () => void, options: ActionOptions = {}): MenuAction {
  return { kind: 'action', label, icon, onSelect, ...options }
}

export const ContextMenuContext = createContext<OpenContextMenu>(() => {})

export function useContextMenu(): OpenContextMenu {
  return useContext(ContextMenuContext)
}
