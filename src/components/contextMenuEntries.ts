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
import { openLink, overlayLinkAt } from './overlayLinks'
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

export function clipboardGroup(t: Translate, field: TextField, paste?: (text: string) => void): MenuGroup {
  const hasSelection = field.selectionStart === null || field.selectionStart !== field.selectionEnd
  const editable = !field.readOnly && !field.disabled
  const copyable = hasSelection && field.type !== 'password'
  const insert = paste ?? ((text: string) => runCommand(field, 'insertText', text))
  const canPaste = editable && typeof navigator.clipboard?.readText === 'function'
  return [
    menuAction(t('contextMenu.cut'), ScissorsIcon, () => runCommand(field, 'cut'), {
      shortcut: shortcutLabel('X'),
      disabled: !copyable || !editable,
    }),
    menuAction(t('contextMenu.copy'), CopyIcon, () => runCommand(field, 'copy'), {
      shortcut: shortcutLabel('C'),
      disabled: !copyable,
    }),
    menuAction(
      t('contextMenu.paste'),
      ClipboardTextIcon,
      () => void navigator.clipboard.readText().then(insert, () => {}),
      {
        shortcut: shortcutLabel('V'),
        disabled: !canPaste,
      },
    ),
    menuAction(t('contextMenu.selectAll'), SelectionAllIcon, () => field.select(), { shortcut: shortcutLabel('A') }),
  ]
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
      ],
    },
  ] satisfies MenuGroup
}

interface RichTextHandlers {
  format: (action: FormatAction) => void
  toggleChecklist: () => void
  unlink: (link: HTMLElement) => void
  paste?: (text: string) => void
}

export function richTextGroups(
  t: Translate,
  field: HTMLTextAreaElement,
  point: { x: number; y: number },
  { format, toggleChecklist, unlink, paste }: RichTextHandlers,
): MenuGroup[] {
  const link = overlayLinkAt(field, point.x, point.y)
  const href = link?.dataset.href
  const removable = link?.dataset.link !== undefined
  return [
    href ? linkGroup(t, href, removable ? () => unlink(link!) : undefined) : [],
    clipboardGroup(t, field, paste),
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
