import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { bouncy } from './motion'

const STACK = [
  { color: 'sky', rotate: -10, x: -34, y: 10 },
  { color: 'bubblegum', rotate: 9, x: 34, y: 6 },
  { color: 'lime', rotate: -2, x: 0, y: 0 },
] as const

function NoteStack() {
  return (
    <div className="relative mx-auto h-36 w-44" aria-hidden="true">
      {STACK.map(({ color, rotate, x, y }, index) => (
        <motion.div
          key={color}
          data-color={color}
          initial={{ opacity: 0, y: -60, rotate: 0 }}
          animate={{ opacity: 1, y, x, rotate }}
          transition={{ ...bouncy, delay: 0.1 + index * 0.12 }}
          className="note-surface absolute inset-x-8 top-2 h-28 rounded-2xl p-4"
        >
          <div className="h-2.5 w-16 rounded-full bg-ink/20" />
          <div className="mt-2.5 h-2 w-20 rounded-full bg-ink/12" />
          <div className="mt-2 h-2 w-12 rounded-full bg-ink/12" />
        </motion.div>
      ))}
    </div>
  )
}

export function EmptyState({ filtering }: { filtering: boolean }) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-16 max-w-sm text-center"
    >
      {filtering ? (
        <motion.div
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={bouncy}
          className="mx-auto flex size-20 items-center justify-center rounded-full bg-surface-2 text-ink-soft"
        >
          <MagnifyingGlassIcon size={36} weight="duotone" />
        </motion.div>
      ) : (
        <NoteStack />
      )}
      <h2 className="mt-6 font-display text-2xl font-bold tracking-[-0.01em] text-ink">
        {filtering ? t('grid.noResultsTitle') : t('grid.emptyTitle')}
      </h2>
      <p className="mt-2 text-ink-soft">{filtering ? t('grid.noResults') : t('grid.empty')}</p>
    </motion.div>
  )
}
