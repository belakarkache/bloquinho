import { CheckIcon, CornersInIcon, CornersOutIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import type { FocusEvent, MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarkdownEditorState } from '../editor/useMarkdownEditor'
import type { NoteColor } from '../notes/types'
import type { VoiceInput } from '../voice/useVoiceInput'
import { ColorPicker } from './ColorPicker'
import { FormatToolbar } from './FormatToolbar'
import { IconButton } from './IconButton'
import { MarkdownEditor } from './MarkdownEditor'
import { pressable, reveal } from './motion'
import { DeleteButton, PinButton } from './NoteButtons'
import { VoiceButton } from './VoiceButton'
import { VoiceModelDialog } from './VoiceModelDialog'
import { VoicePanel } from './VoicePanel'

const keepFocus = (event: MouseEvent) => event.preventDefault()

const VARIANTS = {
  inline: {
    voice: 'px-5 pb-3',
    toolbar: 'px-3 py-1',
    bar: 'px-3 py-2.5',
  },
  sheet: {
    voice: 'px-6 pb-2 sm:px-8',
    toolbar: 'px-3 py-1 sm:px-5',
    bar: 'px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-2.5',
  },
}

interface NoteFormProps {
  editor: MarkdownEditorState
  voice: VoiceInput
  color: NoteColor
  pinned: boolean
  fullscreen: boolean
  variant: keyof typeof VARIANTS
  fieldClassName?: string
  editorClassName?: string
  leading?: ReactNode
  preview?: ReactNode
  controlsVisible?: boolean
  onEditorFocus?: (event: FocusEvent<HTMLDivElement>) => void
  onColorChange: (color: NoteColor) => void
  onTogglePin: () => void
  onToggleFullscreen: () => void
  onDelete?: () => void
  onSave: () => void
}

export function NoteForm({
  editor,
  voice,
  color,
  pinned,
  fullscreen,
  variant,
  fieldClassName = '',
  editorClassName = '',
  leading,
  preview,
  controlsVisible = true,
  onEditorFocus,
  onColorChange,
  onTogglePin,
  onToggleFullscreen,
  onDelete,
  onSave,
}: NoteFormProps) {
  const { t } = useTranslation()
  const spacing = VARIANTS[variant]

  const focusEditor = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('.cm-editor')) return
    event.preventDefault()
    editor.focus()
  }

  return (
    <>
      <div onMouseDown={focusEditor} className={`flex min-h-0 ${fieldClassName}`}>
        {leading}
        {preview}
        <MarkdownEditor
          editor={editor}
          hidden={Boolean(preview)}
          onFocus={onEditorFocus}
          className={`min-w-0 flex-1 ${editorClassName}`}
        />
      </div>
      <VoicePanel voice={voice} className={`shrink-0 ${spacing.voice}`} />
      <AnimatePresence initial={false}>
        {controlsVisible && (
          <motion.div
            key="controls"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: reveal, opacity: { duration: 0.2, delay: 0.08 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: reveal, opacity: { duration: 0.12 } } }}
            onMouseDown={keepFocus}
            className="shrink-0"
          >
            <FormatToolbar
              onFormat={editor.format}
              onToggleChecklist={editor.toggleChecklist}
              className={`border-t border-ink/10 ${spacing.toolbar}`}
            />
            <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 ${spacing.bar}`}>
              <ColorPicker value={color} onChange={onColorChange} />
              <div className="ml-auto flex items-center gap-1">
                <IconButton
                  icon={fullscreen ? CornersInIcon : CornersOutIcon}
                  label={fullscreen ? t('note.collapse') : t('note.expand')}
                  aria-pressed={fullscreen}
                  onClick={onToggleFullscreen}
                  className="max-sm:hidden"
                />
                <PinButton pinned={pinned} onToggle={onTogglePin} />
                {onDelete && <DeleteButton onDelete={onDelete} />}
                <VoiceButton voice={voice} />
                <motion.button
                  type="button"
                  onClick={onSave}
                  {...pressable}
                  className="ml-1 inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent shadow-[0_8px_18px_-10px_var(--accent)] transition-colors hover:bg-accent-hover"
                >
                  <CheckIcon size={16} weight="bold" />
                  {t('note.save')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {voice.download?.status === 'confirm' && (
          <VoiceModelDialog onConfirm={() => void voice.confirmDownload()} onDecline={voice.declineDownload} />
        )}
      </AnimatePresence>
    </>
  )
}
