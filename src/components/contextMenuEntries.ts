import {
  ArrowSquareOutIcon,
  ArrowsOutSimpleIcon,
  CardsIcon,
  ClipboardTextIcon,
  CopyIcon,
  LinkBreakIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PushPinIcon,
  PushPinSlashIcon,
  ScissorsIcon,
  SelectionAllIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import type { FormatAction } from '../notes/formatting'
import type { Note, NoteColor } from '../notes/types'
import { THEME_OPTIONS, type ThemePreference } from '../theme/theme'
import { menuAction, type MenuAction, type MenuEntry, type MenuGroup } from './contextMenu'
import { BLOCK_ACTIONS, FORMAT_ICONS, INLINE_ACTIONS } from './formatActions'
import { openLink } from './editorLinks'
import { shortcutLabel } from './shortcuts'
import { THEME_ICON } from './themeIcons'

type Translate = TFunction
type TextField = HTMLInputElement | HTMLTextAreaElement

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', 'number'])

export function isTextField(target: EventTarget | null): target is TextField {
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
}

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text)
}

function runCommand(field: TextField, command: 'cut' | 'copy' | 'insertText', text?: string): void {
  field.focus()
  document.execCommand(command, false, text)
}

function isPresent<T>(value: T | false | undefined): value is T {
  return value !== false && value !== undefined
}

export function linkGroup(t: Translate, href: string, onRemove?: () => void): MenuGroup {
  return [
    { kind: 'caption', text: href },
    menuAction(t('contextMenu.openLink'), ArrowSquareOutIcon, () => openLink(href)),
    menuAction(t('contextMenu.copyLink'), LinkSimpleIcon, () => copyText(href)),
    ...(onRemove ? [menuAction(t('contextMenu.removeLink'), LinkBreakIcon, onRemove)] : []),
  ]
}

export interface ClipboardHandlers {
  hasSelection: boolean
  editable: boolean
  copyable?: boolean
  cut: () => void
  copy: () => void
  paste: (text: string) => void
  selectAll: () => void
}

function clipboardEntries(
  t: Translate,
  { hasSelection, editable, copyable = true, cut, copy, paste, selectAll }: ClipboardHandlers,
): MenuGroup {
  const canCopy = hasSelection && copyable
  const canPaste = editable && typeof navigator.clipboard?.readText === 'function'
  return [
    menuAction(t('contextMenu.cut'), ScissorsIcon, cut, {
      shortcut: shortcutLabel('X'),
      disabled: !canCopy || !editable,
    }),
    menuAction(t('contextMenu.copy'), CopyIcon, copy, {
      shortcut: shortcutLabel('C'),
      disabled: !canCopy,
    }),
    menuAction(
      t('contextMenu.paste'),
      ClipboardTextIcon,
      () => void navigator.clipboard.readText().then(paste, () => {}),
      {
        shortcut: shortcutLabel('V'),
        disabled: !canPaste,
      },
    ),
    menuAction(t('contextMenu.selectAll'), SelectionAllIcon, selectAll, { shortcut: shortcutLabel('A') }),
  ]
}

export function clipboardGroup(t: Translate, field: TextField): MenuGroup {
  return clipboardEntries(t, {
    hasSelection: field.selectionStart === null || field.selectionStart !== field.selectionEnd,
    editable: !field.readOnly && !field.disabled,
    copyable: field.type !== 'password',
    cut: () => runCommand(field, 'cut'),
    copy: () => runCommand(field, 'copy'),
    paste: (text) => runCommand(field, 'insertText', text),
    selectAll: () => field.select(),
  })
}

export function formatGroup(t: Translate, format: (action: FormatAction) => void, toggleChecklist: () => void) {
  const formatItem = (action: FormatAction) => ({
    label: t(`format.${action}`),
    icon: FORMAT_ICONS[action],
    onSelect: () => format(action),
  })
  return [
    { kind: 'icons', label: t('format.toolbar'), items: INLINE_ACTIONS.map(formatItem) },
    {
      kind: 'icons',
      label: t('format.toolbar'),
      items: [
        ...BLOCK_ACTIONS.map(formatItem),
        { label: t('note.checklist'), icon: ListChecksIcon, onSelect: toggleChecklist },
        formatItem('clear'),
      ],
    },
  ] satisfies MenuGroup
}

interface RichTextHandlers {
  link: { href: string; unlink?: () => void } | null
  clipboard: ClipboardHandlers
  format: (action: FormatAction) => void
  toggleChecklist: () => void
}

export function richTextGroups(t: Translate, { link, clipboard, format, toggleChecklist }: RichTextHandlers): MenuGroup[] {
  return [
    link ? linkGroup(t, link.href, link.unlink) : [],
    clipboardEntries(t, clipboard),
    formatGroup(t, format, toggleChecklist),
  ]
}

interface NoteHandlers {
  onTogglePin: () => void
  onColor: (color: NoteColor) => void
  onDelete: () => void
  onOpen?: () => void
  onDuplicate?: () => void
}

export function noteGroups(
  t: Translate,
  note: Note,
  { onTogglePin, onColor, onDelete, onOpen, onDuplicate }: NoteHandlers,
): MenuGroup[] {
  const actions: (MenuAction | undefined)[] = [
    onOpen && menuAction(t('contextMenu.openNote'), ArrowsOutSimpleIcon, onOpen),
    menuAction(
      note.pinned ? t('note.unpin') : t('note.pin'),
      note.pinned ? PushPinSlashIcon : PushPinIcon,
      onTogglePin,
    ),
    onDuplicate && menuAction(t('contextMenu.duplicate'), CardsIcon, onDuplicate),
    menuAction(t('contextMenu.copyNote'), CopyIcon, () => copyText(note.content)),
  ]
  return [
    actions.filter(isPresent),
    [{ kind: 'colors', label: t('note.color'), value: note.color, onSelect: onColor }],
    [menuAction(t('note.delete'), TrashIcon, onDelete, { danger: true })],
  ]
}

interface AppHandlers {
  onNewNote: () => void
  onSearch: () => void
  theme: ThemePreference
  onTheme: (theme: ThemePreference) => void
}

export function appGroups(t: Translate, { onNewNote, onSearch, theme, onTheme }: AppHandlers): MenuGroup[] {
  const selection = window.getSelection()?.toString() ?? ''
  const themeEntries: MenuEntry[] = THEME_OPTIONS.map((option) =>
    menuAction(t(`theme.${option}`), THEME_ICON[option], () => onTheme(option), { checked: theme === option }),
  )
  return [
    selection
      ? [menuAction(t('contextMenu.copy'), CopyIcon, () => copyText(selection), { shortcut: shortcutLabel('C') })]
      : [],
    [
      menuAction(t('composer.new'), NotePencilIcon, onNewNote),
      menuAction(t('search.open'), MagnifyingGlassIcon, onSearch, { shortcut: shortcutLabel('K') }),
    ],
    [{ kind: 'caption', text: t('theme.label') }, ...themeEntries],
  ]
}
