import { PencilSimpleIcon, SwatchesIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { colorLabelsRepository } from '../notes/colorLabels'
import { useColorNames } from '../notes/colorNames'
import { COLOR_LABEL_MAX_LENGTH, NOTE_COLORS, type NoteColor } from '../notes/types'
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

function CategoryName({ color }: { color: NoteColor }) {
  const { t } = useTranslation()
  const { nameOf, customName, defaultName } = useColorNames()
  const [editing, setEditing] = useState(false)
  const name = nameOf(color)

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 'auto', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={snappy}
      className="relative overflow-hidden"
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={customName(color)}
          placeholder={defaultName(color)}
          maxLength={COLOR_LABEL_MAX_LENGTH}
          aria-label={t('categories.rename', { name })}
          enterKeyHint="done"
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => {
            void colorLabelsRepository.rename(color, event.currentTarget.value)
            setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.value = customName(color)
            if (event.key !== 'Enter' && event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.blur()
          }}
          className="h-11 w-36 bg-transparent pr-4 text-sm font-semibold text-ink outline-none placeholder:text-ink-faint"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t('categories.rename', { name })}
          title={t('categories.rename', { name })}
          className="group/name flex h-11 items-center gap-1.5 pr-4 text-sm font-semibold whitespace-nowrap text-ink"
        >
          <span className="max-w-40 truncate">{name}</span>
          <PencilSimpleIcon
            size={14}
            weight="bold"
            className="shrink-0 text-ink-faint transition-colors group-hover/name:text-ink"
          />
        </button>
      )}
    </motion.div>
  )
}

export function ColorFilter({ value, onChange }: ColorFilterProps) {
  const { t } = useTranslation()
  const { nameOf, customName } = useColorNames()

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
            <div key={color} className="relative flex items-center">
              {selected && <SelectedHalo />}
              <motion.button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={nameOf(color)}
                title={nameOf(color)}
                onClick={() => onChange(selected ? null : color)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.85 }}
                transition={snappy}
                className="relative flex size-11 items-center justify-center rounded-full"
              >
                <span
                  data-color={color}
                  className={`note-swatch relative size-6 rounded-full border-2 border-ink/15 transition-transform duration-300 ease-(--ease-spring) ${selected ? 'scale-110' : ''}`}
                />
              </motion.button>
              <AnimatePresence initial={false}>
                {selected && customName(color) && <CategoryName color={color} />}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
