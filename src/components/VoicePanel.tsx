import { CaretLeftIcon, CircleNotchIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceInput } from '../voice/useVoiceInput'
import { IconButton } from './IconButton'
import { gentle } from './motion'

const PREVIEW_LENGTH = 180
const BAR_WEIGHTS = [0.55, 0.85, 1, 0.75, 0.5]

function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  return <span className="text-sm font-semibold text-ink tabular-nums">{formatElapsed(Math.max(0, now - since))}</span>
}

function LevelBar({ level, weight }: { level: MotionValue<number>; weight: number }) {
  const scaleY = useTransform(level, (value) => 0.2 + Math.min(1, value * weight) * 0.8)
  return <motion.span style={{ scaleY }} className="h-4 w-1 rounded-full bg-ink/60" />
}

function LevelMeter({ level }: { level: MotionValue<number> }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {BAR_WEIGHTS.map((weight, index) => (
        <LevelBar key={index} level={level} weight={weight} />
      ))}
    </span>
  )
}

function SlideToCancel({ dragX }: { dragX: MotionValue<number> }) {
  const { t } = useTranslation()
  const opacity = useTransform(dragX, [0, -96], [1, 0.2])
  return (
    <motion.span
      style={{ x: dragX, opacity }}
      className="ml-auto inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap text-ink-soft"
    >
      <CaretLeftIcon size={14} weight="bold" className="animate-pulse" />
      {t('voice.slideToCancel')}
    </motion.span>
  )
}

function Recording({ voice }: { voice: VoiceInput }) {
  const { t } = useTranslation()
  const locked = voice.phase === 'locked'
  const preview = voice.preview.length > PREVIEW_LENGTH ? `…${voice.preview.slice(-PREVIEW_LENGTH)}` : voice.preview
  return (
    <>
      <div className="flex min-h-11 items-center gap-3">
        {locked && (
          <IconButton
            icon={TrashIcon}
            label={t('voice.discard')}
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={voice.cancel}
            className="-ml-2 hover:bg-danger/12 hover:text-danger"
          />
        )}
        <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden="true" />
        <Elapsed since={voice.startedAt} />
        <LevelMeter level={voice.level} />
        {!locked && <SlideToCancel dragX={voice.dragX} />}
      </div>
      <p aria-live="polite" className="mt-1 text-[15px] leading-relaxed break-words text-ink-soft italic">
        {preview || t('voice.listening')}
      </p>
    </>
  )
}

function Status({ voice }: { voice: VoiceInput }) {
  const { t } = useTranslation()
  if (voice.phase === 'transcribing' || voice.download?.status === 'loading') {
    const label =
      voice.download?.status === 'loading'
        ? t('voice.downloading', { progress: Math.round(voice.download.progress) })
        : t('voice.transcribing')
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-soft">
        <CircleNotchIcon size={16} weight="bold" className="animate-spin" />
        {label}
      </p>
    )
  }
  if (!voice.notice) return null
  return (
    <p role="alert" className="flex min-h-11 items-center gap-2 text-sm font-medium text-danger">
      <WarningCircleIcon size={18} weight="fill" className="shrink-0" />
      {t(`voice.${voice.notice}`)}
    </p>
  )
}

export function VoicePanel({ voice, className = '' }: { voice: VoiceInput; className?: string }) {
  const visible = voice.phase !== 'idle' || voice.download?.status === 'loading' || voice.notice !== null
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="voice"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={gentle}
          className="overflow-hidden"
        >
          <div className={className}>{voice.recording ? <Recording voice={voice} /> : <Status voice={voice} />}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
