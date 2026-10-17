import { CheckIcon, CornersInIcon, CornersOutIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { localeFor } from '../i18n'
import { hasChecklist, isBlankNote } from '../notes/checklist'
import type { Note, NoteChanges, NoteColor } from '../notes/types'
import { useVoiceInput } from '../voice/useVoiceInput'
import { ColorPicker } from './ColorPicker'
import { useContextMenu } from './contextMenu'
import { noteGroups } from './contextMenuEntries'
import { IconButton } from './IconButton'
import { LineEditor } from './LineEditor'
import { ModalDialog } from './ModalDialog'
import { gentle, pressable } from './motion'
import { FormatToolbar } from './FormatToolbar'
import { DeleteButton, PinButton } from './NoteButtons'
import { useLineEditor } from './useLineEditor'
import { VoiceButton } from './VoiceButton'
import { VoiceModelDialog } from './VoiceModelDialog'
import { VoicePanel } from './VoicePanel'

const SAVE_DELAY_MS = 400
const EXPANDED_PADDING = 'px-6 pt-6 sm:px-[max(2rem,calc(50%_-_24rem))] sm:pt-14'

interface NoteEditorProps {
  note: Note
  onChange: (id: string, changes: NoteChanges) => Promise<void>
  onDelete: (note: Note) => void
  onClose: () => void
}

function useEditedLabel(updatedAt: number): string {
  const { t, i18n } = useTranslation()
  const formatter = new Intl.DateTimeFormat(localeFor(i18n.resolvedLanguage), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return t('note.edited', { time: formatter.format(updatedAt) })
}

export function NoteEditor({ note, onChange, onDelete, onClose }: NoteEditorProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const editor = useLineEditor(note.content)
  const { content, focusEnd } = editor
  const savedContent = useRef(content)
  const lastFilledContent = useRef(note.content)
  const [startsInChecklist] = useState(() => hasChecklist(note.content))
  const [expanded, setExpanded] = useState(false)
  const editedLabel = useEditedLabel(note.updatedAt)
  const voice = useVoiceInput(editor.insertTranscript)
  const openMenu = useContextMenu()

  const focusInitially = useEffectEvent(() => {
    if (startsInChecklist) dialogRef.current?.focus()
    else focusEnd()
  })

  useEffect(() => {
    focusInitially()
  }, [])

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

  const saveShortcut = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return
    event.preventDefault()
    close()
  }

  return (
    <ModalDialog
      ref={dialogRef}
      onClose={close}
      aria-label={t('note.open')}
      tabIndex={-1}
      onKeyDown={saveShortcut}
      className={`items-center outline-none ${expanded ? 'sm:p-4' : 'sm:p-8'}`}
    >
      <motion.div
        layoutId={note.id}
        data-color={note.color}
        transition={gentle}
        onContextMenu={(event) =>
          openMenu(event, noteGroups(t, note, { onTogglePin: togglePin, onColor: changeColor, onDelete: deleteNote }))
        }
        className={`note-surface relative flex h-full w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)] transition-[background-color,border-color] duration-300 max-sm:border-0! sm:rounded-[28px] sm:pt-0 ${expanded ? '' : 'sm:h-auto sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-2xl'}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <LineEditor editor={editor} className={expanded ? EXPANDED_PADDING : undefined} />
          <VoicePanel voice={voice} className="shrink-0 px-6 pb-2 sm:px-8" />
          <p className="shrink-0 px-6 pb-2 text-right text-xs text-ink-soft sm:px-8">{editedLabel}</p>
          <FormatToolbar
            onFormat={editor.format}
            onToggleChecklist={editor.toggleActiveLine}
            className="shrink-0 border-t border-ink/10 px-3 py-1 sm:px-5"
          />
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-2.5">
            <ColorPicker value={note.color} onChange={changeColor} />
            <div className="ml-auto flex items-center gap-1">
              <IconButton
                icon={expanded ? CornersInIcon : CornersOutIcon}
                label={expanded ? t('note.collapse') : t('note.expand')}
                aria-pressed={expanded}
                onClick={() => setExpanded(!expanded)}
                className="max-sm:hidden"
              />
              <PinButton pinned={note.pinned} onToggle={togglePin} />
              <DeleteButton onDelete={deleteNote} />
              <VoiceButton voice={voice} />
              <motion.button
                type="button"
                onClick={close}
                {...pressable}
                className="ml-1 inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-surface transition-opacity hover:opacity-90"
              >
                <CheckIcon size={16} weight="bold" />
                {t('note.close')}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {voice.download?.status === 'confirm' && (
          <VoiceModelDialog onConfirm={() => void voice.confirmDownload()} onDecline={voice.declineDownload} />
        )}
      </AnimatePresence>
    </ModalDialog>
  )
}
