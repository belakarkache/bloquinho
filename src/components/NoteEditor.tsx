import { CheckIcon, ListChecksIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
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

  return (
    <ModalDialog
      ref={dialogRef}
      onClose={close}
      aria-label={t('note.open')}
      tabIndex={-1}
      className="items-center p-4 outline-none sm:p-8"
    >
      <motion.div
        layoutId={note.id}
        data-color={note.color}
        transition={gentle}
        onContextMenu={(event) =>
          openMenu(event, noteGroups(t, note, { onTogglePin: togglePin, onColor: changeColor, onDelete: deleteNote }))
        }
        className="note-surface relative flex max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] transition-[background-color,border-color] duration-300"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <LineEditor editor={editor} />
          <VoicePanel voice={voice} className="px-6 pb-2 sm:px-8" />
          <p className="px-6 pb-2 text-right text-xs text-ink-soft sm:px-8">{editedLabel}</p>
          <FormatToolbar onFormat={editor.format} className="border-t border-ink/10 px-3 py-1 sm:px-5" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-3 py-2.5 sm:px-5">
            <ColorPicker value={note.color} onChange={changeColor} />
            <div className="ml-auto flex items-center gap-1">
              <IconButton icon={ListChecksIcon} label={t('note.checklist')} onClick={editor.toggleActiveLine} />
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
