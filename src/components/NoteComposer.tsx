import { NotePencilIcon } from '@phosphor-icons/react'
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useMarkdownEditor } from '../editor/useMarkdownEditor'
import { isBlankNote } from '../notes/checklist'
import type { NewNote, NoteColor } from '../notes/types'
import { useVoiceInput } from '../voice/useVoiceInput'
import { NoteForm } from './NoteForm'
import { isSaveShortcut } from './shortcuts'

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
  const surfaceRef = useRef<HTMLDivElement>(null)
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
    setFullscreenHeight(fullscreen ? null : (surfaceRef.current?.offsetHeight ?? 0))
    focus()
  }

  const save = async () => {
    const draft = { content, color, pinned }
    reset()
    if (!isBlankNote(draft.content)) await onCreate(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSaveShortcut(event)) {
      event.preventDefault()
      void save()
    }
    if (event.key !== 'Escape') return
    if (fullscreen) setFullscreenHeight(null)
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (surfaceRef.current?.contains(event.relatedTarget) || !isBlankNote(content)) return
    reset()
    setExpanded(false)
  }

  return (
    <div className="mx-auto w-full max-w-2xl" style={fullscreen ? { height: fullscreenHeight } : undefined}>
      {fullscreen && <div aria-hidden="true" className="fixed inset-0 z-45 bg-(--scrim) backdrop-blur-[3px]" />}
      <div
        ref={surfaceRef}
        data-color={color}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`note-surface overflow-hidden rounded-3xl transition-[background-color,border-color,translate] duration-300 ease-out-soft ${fullscreen ? 'fixed inset-4 z-45 flex flex-col' : `relative w-full ${expanded ? '-translate-y-0.5' : ''}`}`}
      >
        <NoteForm
          editor={editor}
          voice={voice}
          color={color}
          pinned={pinned}
          fullscreen={fullscreen}
          variant="inline"
          controlsVisible={expanded}
          leading={
            <span className="flex h-[1.625rem] shrink-0 items-center">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
                <NotePencilIcon size={16} weight="bold" />
              </span>
            </span>
          }
          fieldClassName={`items-start gap-3 pt-4 pb-3 ${fullscreen ? 'flex-1 px-5 sm:px-[max(1.25rem,calc(50%_-_24rem))] sm:pt-14' : 'px-5'}`}
          editorClassName={`scrollbar-none overflow-y-auto text-[16px] leading-relaxed transition-[min-height] duration-[320ms] ease-out-soft ${fullscreen ? 'h-full' : 'max-h-[50vh]'} ${expanded ? 'min-h-24' : 'min-h-7'}`}
          onEditorFocus={() => setExpanded(true)}
          onColorChange={setColor}
          onTogglePin={() => setPinned(!pinned)}
          onToggleFullscreen={toggleFullscreen}
          onSave={() => void save()}
        />
      </div>
    </div>
  )
}
