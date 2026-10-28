import { CaretDownIcon, QuotesIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { snappy } from '../components/motion'

export function SourceExcerpt({ excerpt }: { excerpt: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="group/source -ml-2 inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
      >
        <QuotesIcon size={16} weight="bold" />
        {open ? t('kanban.hideSource') : t('kanban.showSource')}
        <CaretDownIcon
          size={14}
          weight="bold"
          className={`transition-transform duration-300 ease-(--ease-spring) ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.blockquote
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={snappy}
            className="overflow-hidden"
          >
            <p className="mt-1.5 max-h-48 overflow-y-auto rounded-2xl border-l-4 border-accent-ink bg-surface-2 px-3.5 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
              {excerpt}
            </p>
          </motion.blockquote>
        )}
      </AnimatePresence>
    </div>
  )
}
