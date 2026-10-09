import { ListChecksIcon, NotePencilIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import { isBlankNote } from '../notes/checklist'
import { unlinkInContent } from '../notes/links'
import { NOTE_MAX_LENGTH, type NewNote, type NoteColor } from '../notes/types'
import { useVoiceInput } from '../voice/useVoiceInput'
import { ColorPicker } from './ColorPicker'
import { useContextMenu } from './contextMenu'
import { richTextGroups } from './contextMenuEntries'
import { FormatToolbar } from './FormatToolbar'
import { IconButton } from './IconButton'
import { HighlightedContent } from './MarkdownHighlight'
import { gentle, pressable } from './motion'
import { PinButton } from './NoteButtons'
import { linkIndexIn, useOverlayLinkClick } from './overlayLinks'
import { useChecklistTextarea } from './useChecklistTextarea'
import { VoiceButton } from './VoiceButton'
import { VoiceModelDialog } from './VoiceModelDialog'
import { VoicePanel } from './VoicePanel'

export interface NoteComposerHandle {
  focus: () => void
}

interface NoteComposerProps {
  ref?: Ref<NoteComposerHandle>
  onCreate: (note: NewNote) => Promise<unknown>
}

export function NoteComposer({ ref, onCreate }: NoteComposerProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [color, setColor] = useState<NoteColor>('default')
  const [pinned, setPinned] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const {
    textareaRef,
    onKeyDown: onTextareaKeyDown,
    toggleChecklist,
    format,
    insertTranscript,
  } = useChecklistTextarea(content, setContent)
  const voice = useVoiceInput((transcript) => {
    setExpanded(true)
    return insertTranscript(transcript)
  })

  const openMenu = useContextMenu()
  const linkClick = useOverlayLinkClick()

  const openTextMenu = (event: MouseEvent<HTMLTextAreaElement>) => {
    const unlink = (link: HTMLElement) => {
      const line = link.closest<HTMLElement>('[data-line]')
      if (line) setContent(unlinkInContent(content, Number(line.dataset.line), linkIndexIn(line, link)))
    }
    openMenu(
      event,
      richTextGroups(
        t,
        event.currentTarget,
        { x: event.clientX, y: event.clientY },
        { format, toggleChecklist, unlink },
      ),
    )
  }

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        textareaRef.current?.focus({ preventScroll: true })
      },
    }),
    [textareaRef],
  )

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus()
  }, [textareaRef])

  const reset = () => {
    setContent('')
    setColor('default')
    setPinned(false)
  }

  const save = async () => {
    const draft = { content, color, pinned }
    reset()
    if (!isBlankNote(draft.content)) await onCreate(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void save()
    }
    if (event.key === 'Escape' && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (formRef.current?.contains(event.relatedTarget)) return
    void save()
    setExpanded(false)
  }

  return (
    <form
      ref={formRef}
      data-color={color}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={`note-surface relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl transition-[background-color,border-color,translate] duration-300 ${expanded ? '-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <span className="flex h-[1.625rem] shrink-0 items-center">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
            <NotePencilIcon size={16} weight="bold" />
          </span>
        </span>
        <div className="grid max-h-[50vh] min-w-0 flex-1 overflow-y-auto text-[16px] leading-relaxed">
          <div
            aria-hidden="true"
            className="pointer-events-none break-words whitespace-pre-wrap text-ink [grid-area:1/1]"
          >
            <HighlightedContent content={content} />
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={onTextareaKeyDown}
            maxLength={NOTE_MAX_LENGTH}
            onFocus={() => setExpanded(true)}
            onContextMenu={openTextMenu}
            {...linkClick}
            placeholder={t('composer.placeholder')}
            aria-label={t('composer.placeholder')}
            rows={1}
            className={`field-sizing-content block w-full resize-none overflow-hidden bg-transparent break-words text-transparent caret-ink outline-none [grid-area:1/1] placeholder:text-ink-soft ${expanded ? 'min-h-24' : 'min-h-7'}`}
          />
        </div>
        <span className="-my-2.5 -mr-2 flex shrink-0 items-center">
          <VoiceButton voice={voice} />
        </span>
      </div>
      <VoicePanel voice={voice} className="px-5 pb-3" />
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="toolbar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={gentle}
          >
            <FormatToolbar onFormat={format} className="border-t border-ink/10 px-3 py-1" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-3 py-2.5">
              <ColorPicker value={color} onChange={setColor} />
              <div className="ml-auto flex items-center gap-0.5">
                <IconButton icon={ListChecksIcon} label={t('note.checklist')} onClick={toggleChecklist} />
                <PinButton pinned={pinned} onToggle={() => setPinned(!pinned)} />
                <motion.button
                  type="submit"
                  {...pressable}
                  className="ml-1 h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent shadow-[0_8px_18px_-10px_var(--accent)] transition-colors hover:bg-accent-hover"
                >
                  {t('composer.save')}
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
    </form>
  )
}
