import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { detectPlatform } from '../lib/install'
import { ModalDialog } from './ModalDialog'
import { gentle, pressable, quickFade } from './motion'

const STEPS = ['step1', 'step2', 'step3'] as const

export function InstallDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const platform = detectPlatform()
  return (
    <ModalDialog onClose={onClose} aria-labelledby="install-title" className="items-end p-0 sm:items-center sm:p-6">
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
          id="install-title"
          className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink"
        >
          {t('install.title')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('install.intro')}</p>
        <ol className="mt-5 flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-ink">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                {index + 1}
              </span>
              <span className="pt-0.5">{t(`install.${platform}.${step}`)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex sm:justify-end">
          <motion.button
            type="button"
            onClick={onClose}
            {...pressable}
            className="h-12 w-full rounded-2xl bg-accent px-5 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover sm:w-auto"
          >
            {t('install.done')}
          </motion.button>
        </div>
      </motion.div>
    </ModalDialog>
  )
}
