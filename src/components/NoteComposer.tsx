import { CornersInIcon, CornersOutIcon, NotePencilIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useMarkdownEditor } from '../editor/useMarkdownEditor'
import { isBlankNote } from '../notes/checklist'
import type { NewNote, NoteColor } from '../notes/types'
import { useVoiceInput } from '../voice/useVoiceInput'
import { ColorPicker } from './ColorPicker'
import { FormatToolbar } from './FormatToolbar'
import { IconButton } from './IconButton'
import { MarkdownEditor } from './MarkdownEditor'
import { pressable, reveal } from './motion'
import { PinButton } from './NoteButtons'
import { VoiceButton } from './VoiceButton'
import { VoiceModelDialog } from './VoiceModelDialog'
import { VoicePanel } from './VoicePanel'

const keepFocus = (event: MouseEvent) => event.preventDefault()

export interface NoteComposerHandle {
  focus: () => void
}

interface NoteComposerProps {
  ref?: Ref<NoteComposerHandle>
  defaultColor?: NoteColor
  onCreate: (note: NewNote) => Promise<unknown>
}

export function NoteComposer({ ref, defaultColor = 'default', onCreate }: NoteComposerProps) {
  const { t } = useTranslation()
  const [chosenColor, setColor] = useState<NoteColor | null>(null)
  const color = chosenColor ?? defaultColor
  const [pinned, setPinned] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [fullscreenHeight, setFullscreenHeight] = useState<number | null>(null)
  const fullscreen = fullscreenHeight !== null
  const formRef = useRef<HTMLFormElement>(null)
  const editor = useMarkdownEditor('', t('composer.placeholder'))
  const { content, focus } = editor
  const voice = useVoiceInput((transcript) => {
    setExpanded(true)
    return editor.insertTranscript(transcript)
  })

  useImperativeHandle(ref, () => ({
    focus: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      focus({ preventScroll: true })
    },
  }))

  const focusOnDesktop = useEffectEvent(() => {
    if (window.matchMedia('(pointer: fine)').matches) focus()
  })

  useEffect(() => {
    focusOnDesktop()
  }, [])

  const reset = () => {
    editor.reset()
    setColor(null)
    setPinned(false)
    setFullscreenHeight(null)
  }

  const toggleFullscreen = () => {
    setFullscreenHeight(fullscreen ? null : (formRef.current?.offsetHeight ?? 0))
    focus()
  }

  const save = async () => {
    const draft = { content, color, pinned }
    reset()
    if (!isBlankNote(draft.content)) await onCreate(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.key.toLowerCase() === 's')) {
      event.preventDefault()
      void save()
    }
    if (event.key !== 'Escape') return
    if (fullscreen) setFullscreenHeight(null)
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (formRef.current?.contains(event.relatedTarget)) return
    void save()
    setExpanded(false)
  }

  return (
    <div className="mx-auto w-full max-w-2xl" style={fullscreen ? { height: fullscreenHeight } : undefined}>
      {fullscreen && <div aria-hidden="true" className="fixed inset-0 z-45 bg-(--scrim) backdrop-blur-[3px]" />}
      <form
        ref={formRef}
        data-color={color}
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`note-surface overflow-hidden rounded-3xl transition-[background-color,border-color,translate] duration-300 ease-out-soft ${fullscreen ? 'fixed inset-4 z-45 flex flex-col' : `relative w-full ${expanded ? '-translate-y-0.5' : ''}`}`}
      >
        <div
          className={`flex items-start gap-3 pt-4 pb-3 ${fullscreen ? 'min-h-0 flex-1 px-5 sm:px-[max(1.25rem,calc(50%_-_24rem))] sm:pt-14' : 'px-5'}`}
        >
          <span className="flex h-[1.625rem] shrink-0 items-center">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
              <NotePencilIcon size={16} weight="bold" />
            </span>
          </span>
          <MarkdownEditor
            editor={editor}
            onFocus={() => setExpanded(true)}
            className={`scrollbar-none min-w-0 flex-1 overflow-y-auto text-[16px] leading-relaxed transition-[min-height] duration-[320ms] ease-out-soft ${fullscreen ? 'h-full' : 'max-h-[50vh]'} ${expanded ? 'min-h-24' : 'min-h-7'}`}
          />
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
              animate={{ height: 'auto', opacity: 1, transition: { height: reveal, opacity: { duration: 0.2, delay: 0.08 } } }}
              exit={{ height: 0, opacity: 0, transition: { height: reveal, opacity: { duration: 0.12 } } }}
              onMouseDown={keepFocus}
            >
              <FormatToolbar onFormat={editor.format} onToggleChecklist={editor.toggleChecklist} className="border-t border-ink/10 px-3 py-1" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-3 py-2.5">
                <ColorPicker value={color} onChange={setColor} />
                <div className="ml-auto flex items-center gap-0.5">
                  <IconButton
                    icon={fullscreen ? CornersInIcon : CornersOutIcon}
                    label={fullscreen ? t('note.collapse') : t('note.expand')}
                    aria-pressed={fullscreen}
                    onClick={toggleFullscreen}
                    className="max-sm:hidden"
                  />
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
    </div>
  )
}
