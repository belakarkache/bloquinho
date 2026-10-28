import { CheckIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useColorNames } from '../notes/colorNames'
import type { NoteColor } from '../notes/types'
import { bouncy, snappy } from './motion'

interface ColorPickerProps<C extends NoteColor> {
  value: C
  onChange: (color: C) => void
  colors: readonly C[]
  label?: string
  customNames?: boolean
}

export function ColorPicker<C extends NoteColor>({
  value,
  onChange,
  colors,
  label,
  customNames = true,
}: ColorPickerProps<C>) {
  const { t } = useTranslation()
  const { nameOf: customNameOf, defaultName } = useColorNames()
  const nameOf = customNames ? customNameOf : defaultName
  return (
    <div
      role="radiogroup"
      aria-label={label ?? t('note.color')}
      className="flex w-full justify-between sm:w-auto sm:flex-wrap sm:justify-start sm:gap-1"
    >
      {colors.map((color) => {
        const selected = value === color
        return (
          <motion.button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={nameOf(color)}
            title={nameOf(color)}
            onClick={() => onChange(color)}
            whileHover={{ scale: 1.18, y: -2 }}
            whileTap={{ scale: 0.85 }}
            transition={snappy}
            className="flex size-[34px] items-center justify-center rounded-full sm:size-9"
          >
            <span
              data-color={color}
              className={`note-swatch flex size-7 items-center justify-center rounded-full border-2 transition-[border-color,box-shadow] duration-200 ${color === 'default' ? 'text-ink' : 'text-on-brand'} ${selected ? 'border-ink shadow-[0_0_0_3px_var(--surface)]' : 'border-ink/15'}`}
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, transition: { duration: 0.12 } }}
                    transition={bouncy}
                    className="inline-flex"
                  >
                    <CheckIcon size={14} weight="bold" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
