import { SwatchesIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { NOTE_COLORS, type NoteColor } from '../notes/types'
import { snappy } from './motion'

interface ColorFilterProps {
  value: NoteColor | null
  onChange: (color: NoteColor | null) => void
}

function SelectedHalo() {
  return (
    <motion.span
      layoutId="color-filter-halo"
      transition={snappy}
      className="absolute inset-0 rounded-full border-2 border-ink bg-surface shadow-[0_6px_16px_-8px_rgb(var(--shadow-ink)/0.5)]"
    />
  )
}

export function ColorFilter({ value, onChange }: ColorFilterProps) {
  const { t } = useTranslation()

  return (
    <div className="-mx-4 mt-3 -mb-2 overflow-x-auto px-4 py-2 scrollbar-none">
      <div role="radiogroup" aria-label={t('note.color')} className="mx-auto flex w-max items-center gap-1">
        <motion.button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          whileTap={{ scale: 0.92 }}
          transition={snappy}
          className={`relative flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${value === null ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
        >
          {value === null && <SelectedHalo />}
          <SwatchesIcon size={18} weight={value === null ? 'fill' : 'bold'} className="relative" />
          <span className="relative">{t('filter.all')}</span>
        </motion.button>
        {NOTE_COLORS.map((color) => {
          const selected = value === color
          return (
            <motion.button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(`colors.${color}`)}
              title={t(`colors.${color}`)}
              onClick={() => onChange(selected ? null : color)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.85 }}
              transition={snappy}
              className="relative flex size-11 items-center justify-center rounded-full"
            >
              {selected && <SelectedHalo />}
              <span
                data-color={color}
                className={`note-swatch relative size-6 rounded-full border-2 border-ink/15 transition-transform duration-300 ease-(--ease-spring) ${selected ? 'scale-110' : ''}`}
              />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
