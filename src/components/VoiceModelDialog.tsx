import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { WHISPER_DOWNLOAD_MB } from '../voice/whisper'
import { ModalDialog } from './ModalDialog'
import { gentle, pressable, quickFade } from './motion'

interface VoiceModelDialogProps {
  onConfirm: () => void
  onDecline: () => void
}

export function VoiceModelDialog({ onConfirm, onDecline }: VoiceModelDialogProps) {
  const { t } = useTranslation()
  return (
    <ModalDialog onClose={onDecline} aria-labelledby="voice-model-title" className="items-end p-0 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        className="relative w-full rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[32px] sm:p-8"
      >
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <DownloadSimpleIcon size={24} weight="bold" />
        </span>
        <h2
          id="voice-model-title"
          className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink"
        >
          {t('voice.downloadTitle')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {t('voice.downloadBody', { size: WHISPER_DOWNLOAD_MB })}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <motion.button
            type="button"
            onClick={onDecline}
            {...pressable}
            className="h-12 rounded-2xl px-5 font-semibold text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
          >
            {t('voice.downloadDecline')}
          </motion.button>
          <motion.button
            type="button"
            onClick={onConfirm}
            {...pressable}
            className="h-12 rounded-2xl bg-accent px-5 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover"
          >
            {t('voice.downloadConfirm')}
          </motion.button>
        </div>
      </motion.div>
    </ModalDialog>
  )
}
