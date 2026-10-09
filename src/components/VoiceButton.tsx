import { CaretUpIcon, CheckIcon, CircleNotchIcon, LockSimpleIcon, MicrophoneIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInput } from '../voice/useVoiceInput'
import { bouncy, snappy } from './motion'

const CANCEL_DISTANCE = 96
const LOCK_DISTANCE = 72
const TAP_DURATION_MS = 250

const GLYPHS = {
  idle: MicrophoneIcon,
  holding: MicrophoneIcon,
  locked: CheckIcon,
  transcribing: CircleNotchIcon,
}

interface Gesture {
  x: number
  y: number
  startedAt: number
}

function useEscapeToCancel(voice: VoiceInput) {
  const { recording, cancel } = voice
  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      cancel()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, cancel])
}

function LockHint({ lift }: { lift: MotionValue<number> }) {
  const { t } = useTranslation()
  const y = useTransform(lift, (value) => value * 0.6)
  const opacity = useTransform(lift, [0, -LOCK_DISTANCE], [1, 0.4])
  return (
    <motion.span
      initial={{ opacity: 0, y: 12, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.8, transition: { duration: 0.12 } }}
      transition={bouncy}
      className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2"
      aria-hidden="true"
    >
      <motion.span
        style={{ y, opacity }}
        title={t('voice.slideToLock')}
        className="flex flex-col items-center gap-0.5 rounded-full bg-surface px-2 pt-2 pb-1.5 text-ink-soft shadow-[0_8px_20px_-8px_rgb(var(--shadow-ink)/0.35)]"
      >
        <LockSimpleIcon size={16} weight="bold" />
        <CaretUpIcon size={12} weight="bold" className="animate-bounce" />
      </motion.span>
    </motion.span>
  )
}

function buttonLook(voice: VoiceInput) {
  if (voice.phase === 'holding') return 'bg-danger text-white'
  if (voice.phase === 'locked') return 'bg-accent text-on-accent shadow-[0_8px_18px_-10px_var(--accent)]'
  return 'text-ink-soft hover:bg-ink/8 hover:text-ink'
}

export function VoiceButton({ voice }: { voice: VoiceInput }) {
  const { t } = useTranslation()
  const gesture = useRef<Gesture | null>(null)
  const lift = useMotionValue(0)
  useEscapeToCancel(voice)

  if (!voice.supported) return null

  const endGesture = () => {
    gesture.current = null
    lift.set(0)
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    if (voice.phase === 'locked') {
      void voice.finish()
      return
    }
    if (voice.phase !== 'idle') return
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { x: event.clientX, y: event.clientY, startedAt: performance.now() }
    voice.start('holding')
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current
    if (!current || voice.phase !== 'holding') return
    const dx = Math.min(0, event.clientX - current.x)
    const dy = Math.min(0, event.clientY - current.y)
    voice.dragX.set(dx)
    lift.set(dy)
    if (dx < -CANCEL_DISTANCE) {
      endGesture()
      voice.cancel()
    } else if (dy < -LOCK_DISTANCE) {
      endGesture()
      voice.dragX.set(0)
      voice.lock()
    }
  }

  const onPointerUp = () => {
    const current = gesture.current
    if (!current) return
    endGesture()
    if (performance.now() - current.startedAt < TAP_DURATION_MS) {
      voice.dragX.set(0)
      voice.lock()
    } else void voice.finish()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (voice.phase === 'idle') voice.start('locked')
    else if (voice.phase === 'locked') void voice.finish()
  }

  const locked = voice.phase === 'locked'
  const busy = voice.phase === 'transcribing'
  const Glyph = GLYPHS[voice.phase]

  return (
    <span className="relative inline-flex shrink-0">
      <AnimatePresence>{voice.phase === 'holding' && <LockHint lift={lift} />}</AnimatePresence>
      <motion.button
        type="button"
        aria-label={locked ? t('voice.finish') : t('voice.record')}
        aria-pressed={voice.recording}
        title={locked ? t('voice.finish') : t('voice.hint')}
        disabled={busy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseDown={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={onKeyDown}
        animate={{ scale: voice.phase === 'holding' ? 1.25 : 1 }}
        whileHover={voice.phase === 'idle' ? { scale: 1.06 } : undefined}
        transition={snappy}
        className={`inline-flex size-11 touch-none items-center justify-center rounded-full transition-colors duration-200 select-none [-webkit-touch-callout:none] disabled:opacity-60 ${buttonLook(voice)}`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={Glyph.displayName}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.1 } }}
            transition={bouncy}
            className={`inline-flex ${busy ? 'animate-spin' : ''}`}
          >
            <Glyph size={20} weight={voice.recording ? 'fill' : 'bold'} />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </span>
  )
}
