import { ArrowCounterClockwiseIcon, TrashIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { bouncy, pressable, quickFade } from './motion'

const TOAST_DURATION_MS = 6_000

interface UndoToastProps {
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ onUndo, onDismiss }: UndoToastProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.95, transition: quickFade }}
      transition={bouncy}
      className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm overflow-hidden rounded-2xl bg-toast text-on-toast shadow-[0_18px_40px_-16px_rgb(var(--shadow-ink)/0.6)]"
    >
      <div className="flex items-center gap-3 py-2 pr-2 pl-4">
        <TrashIcon size={18} weight="bold" className="shrink-0 opacity-70" />
        <span className="flex-1 text-sm font-medium">{t('note.deleted')}</span>
        <motion.button
          type="button"
          onClick={onUndo}
          {...pressable}
          className="group/undo inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-toast-action hover:bg-on-toast/10"
        >
          <ArrowCounterClockwiseIcon
            size={16}
            weight="bold"
            className="transition-transform duration-300 ease-(--ease-spring) group-hover/undo:-rotate-90"
          />
          {t('note.undo')}
        </motion.button>
      </div>
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION_MS / 1000, ease: 'linear' }}
        className="h-1 origin-left bg-toast-action"
      />
    </motion.div>
  )
}
