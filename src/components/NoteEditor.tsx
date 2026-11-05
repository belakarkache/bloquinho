import { motion } from 'motion/react'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { SourcePosition } from '../editor/useChecklistPreview'
import { useMarkdownEditor } from '../editor/useMarkdownEditor'
import { hasChecklist, isBlankNote, toggleItem } from '../notes/checklist'
import type { Note, NoteChanges, NoteColor } from '../notes/types'
import { useVoiceInput } from '../voice/useVoiceInput'
import { ChecklistPreview } from './ChecklistPreview'
import { useContextMenu } from './contextMenu'
import { noteGroups } from './contextMenuEntries'
import { ModalDialog } from './ModalDialog'
import { sheet } from './motion'
import { NoteForm } from './NoteForm'
import { isSaveShortcut } from './shortcuts'
import { useBackToClose } from './useBackToClose'

const SAVE_DELAY_MS = 400
const TOUCH_FOCUS_FALLBACK_MS = 600
const EDITOR_AREA = 'scrollbar-none relative min-h-56 overflow-y-auto pb-8 text-[17px] leading-relaxed'
const DEFAULT_PADDING = 'px-6 pt-6 sm:px-8 sm:pt-8'
const EXPANDED_PADDING = 'px-6 pt-6 sm:px-[max(2rem,calc(50%_-_24rem))] sm:pt-14'

interface NoteEditorProps {
  note: Note
  onChange: (id: string, changes: NoteChanges) => Promise<void>
  onDelete: (note: Note) => void
  onClose: () => void
}

export function NoteEditor({ note, onChange, onDelete, onClose }: NoteEditorProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const editor = useMarkdownEditor(note.content, t('note.editPlaceholder'))
  const { content, focusEnd } = editor
  const savedContent = useRef(content)
  const lastFilledContent = useRef(note.content)
  const [startsInChecklist] = useState(() => hasChecklist(note.content))
  const [previewing, setPreviewing] = useState(startsInChecklist)
  const [expanded, setExpanded] = useState(false)
  const voice = useVoiceInput(editor.insertTranscript)
  const openMenu = useContextMenu()

  useLayoutEffect(() => {
    const panel = panelRef.current
    const card = document.querySelector(`[data-measure-id="${CSS.escape(note.id)}"]`)
    if (!panel || !card) return
    const { left, top, width, height } = card.getBoundingClientRect()
    panel.style.transformOrigin = `${left + width / 2 - panel.offsetLeft}px ${top + height / 2 - panel.offsetTop}px`
  }, [note.id])

  const focusedInitially = useRef(false)

  const focusOnce = () => {
    if (focusedInitially.current) return
    focusedInitially.current = true
    if (startsInChecklist) dialogRef.current?.focus()
    else focusEnd()
  }

  const focusIfUntouched = () => {
    if (document.activeElement === dialogRef.current) focusOnce()
  }

  const focusInitially = useEffectEvent(focusOnce)
  const focusDeferred = useEffectEvent(focusIfUntouched)

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      focusInitially()
      return
    }
    dialogRef.current?.focus({ preventScroll: true })
    const timer = setTimeout(focusDeferred, TOUCH_FOCUS_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [])

  const settleOpen = () => {
    editor.refresh()
    focusIfUntouched()
  }

  useEffect(() => {
    if (!isBlankNote(content)) lastFilledContent.current = content
  }, [content])

  useEffect(() => {
    if (content === savedContent.current) return
    const timer = setTimeout(() => {
      savedContent.current = content
      void onChange(note.id, { content })
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [content, note.id, onChange])

  const deleteNote = () => onDelete({ ...note, content: lastFilledContent.current })

  const togglePin = () => void onChange(note.id, { pinned: !note.pinned })
  const changeColor = (color: NoteColor) => void onChange(note.id, { color })

  const close = () => {
    if (isBlankNote(content)) {
      deleteNote()
      return
    }
    if (content !== savedContent.current) {
      savedContent.current = content
      void onChange(note.id, { content })
    }
    onClose()
  }

  useBackToClose(true, close)

  const startEditing = (position: SourcePosition | null) => {
    flushSync(() => setPreviewing(false))
    if (position) editor.focusLine(position.line, position.column)
    else focusEnd()
  }

  const editingFirst =
    <T extends unknown[]>(run: (...args: T) => void) =>
    (...args: T) => {
      startEditing(null)
      run(...args)
    }

  const formEditor = previewing
    ? { ...editor, format: editingFirst(editor.format), toggleChecklist: editingFirst(editor.toggleChecklist) }
    : editor

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isSaveShortcut(event)) {
      event.preventDefault()
      close()
      return
    }
    const typing = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
    if (previewing && typing && event.target === dialogRef.current) startEditing(null)
  }

  const editorClassName = `${EDITOR_AREA} ${expanded ? EXPANDED_PADDING : DEFAULT_PADDING}`

  return (
    <ModalDialog
      ref={dialogRef}
      onClose={close}
      onEscape={expanded ? () => setExpanded(false) : close}
      aria-label={t('note.open')}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`items-center outline-none ${expanded ? 'sm:p-4' : 'sm:p-8'}`}
    >
      <motion.div
        ref={panelRef}
        variants={sheet}
        initial="closed"
        animate="open"
        exit="closed"
        onAnimationComplete={(definition) => definition === 'open' && settleOpen()}
        data-color={note.color}
        onContextMenu={(event) =>
          openMenu(event, noteGroups(t, note, { onTogglePin: togglePin, onColor: changeColor, onDelete: deleteNote }))
        }
        className={`note-surface relative flex h-full w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] transition-[background-color,border-color] duration-300 max-sm:border-0! sm:rounded-[28px] sm:pt-0 ${expanded ? '' : 'sm:h-auto sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-2xl'}`}
      >
        <NoteForm
          editor={formEditor}
          voice={voice}
          color={note.color}
          pinned={note.pinned}
          fullscreen={expanded}
          variant="sheet"
          fieldClassName="flex-1"
          editorClassName={editorClassName}
          preview={
            previewing && (
              <ChecklistPreview
                content={content}
                className={`min-w-0 flex-1 ${editorClassName}`}
                onToggleItem={(line) => editor.replaceContent(toggleItem(content, line))}
                onEdit={startEditing}
              />
            )
          }
          onColorChange={changeColor}
          onTogglePin={togglePin}
          onToggleFullscreen={() => setExpanded(!expanded)}
          onDelete={deleteNote}
          onSave={close}
        />
      </motion.div>
    </ModalDialog>
  )
}
