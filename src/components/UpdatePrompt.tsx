import { ArrowsClockwiseIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { bouncy, pressable, quickFade } from './motion'

const UPDATE_CHECK_MS = 60 * 60 * 1000

function checkPeriodically(_url: string, registration: ServiceWorkerRegistration | undefined) {
  if (!registration) return
  setInterval(() => {
    if (navigator.onLine) void registration.update()
  }, UPDATE_CHECK_MS)
}

export function UpdatePrompt({ hidden }: { hidden: boolean }) {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: checkPeriodically })

  return (
    <AnimatePresence>
      {needRefresh && !hidden && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95, transition: quickFade }}
          transition={bouncy}
          className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-toast py-2 pr-2 pl-4 text-on-toast shadow-[0_18px_40px_-16px_rgb(var(--shadow-ink)/0.6)]"
        >
          <ArrowsClockwiseIcon size={18} weight="bold" className="shrink-0 opacity-70" />
          <span className="flex-1 text-sm font-medium">{t('update.available')}</span>
          <motion.button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            {...pressable}
            className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-bold text-toast-action hover:bg-on-toast/10"
          >
            {t('update.reload')}
          </motion.button>
          <motion.button
            type="button"
            aria-label={t('update.dismiss')}
            onClick={() => setNeedRefresh(false)}
            {...pressable}
            className="inline-flex size-10 items-center justify-center rounded-xl opacity-70 hover:bg-on-toast/10 hover:opacity-100"
          >
            <XIcon size={16} weight="bold" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
