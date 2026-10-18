import { TagIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { colorLabelsRepository } from '../notes/colorLabels'
import { useColorNames } from '../notes/colorNames'
import { COLOR_LABEL_MAX_LENGTH, NOTE_COLORS, type NoteColor } from '../notes/types'
import { ModalDialog } from './ModalDialog'
import { gentle, pressable, quickFade } from './motion'

export function ColorLabelsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { customName, defaultName } = useColorNames()
  const [drafts, setDrafts] = useState<Partial<Record<NoteColor, string>>>({})

  const saveAndClose = () => {
    for (const [color, name] of Object.entries(drafts) as [NoteColor, string][]) {
      void colorLabelsRepository.rename(color, name)
    }
    onClose()
  }

  return (
    <ModalDialog
      onClose={saveAndClose}
      aria-labelledby="categories-title"
      className="items-end p-0 sm:items-center sm:p-6"
    >
      <motion.form
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        onSubmit={(event) => {
          event.preventDefault()
          saveAndClose()
        }}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[32px] sm:p-8"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <TagIcon size={24} weight="bold" />
        </span>
        <h2
          id="categories-title"
          className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink"
        >
          {t('categories.title')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('categories.intro')}</p>
        <ul className="-mx-1 mt-5 flex min-h-0 flex-col gap-2 overflow-y-auto px-1 py-1">
          {NOTE_COLORS.map((color) => (
            <li key={color}>
              <label className="flex h-12 items-center gap-3 rounded-2xl border-2 border-line bg-surface px-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-accent-ink focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
                <span data-color={color} className="note-swatch size-6 shrink-0 rounded-full border-2 border-ink/15" />
                <input
                  value={drafts[color] ?? customName(color)}
                  onChange={(event) => setDrafts((current) => ({ ...current, [color]: event.target.value }))}
                  placeholder={defaultName(color)}
                  maxLength={COLOR_LABEL_MAX_LENGTH}
                  aria-label={t('categories.rename', { name: defaultName(color) })}
                  enterKeyHint="done"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex shrink-0 sm:justify-end">
          <motion.button
            type="submit"
            {...pressable}
            className="h-12 w-full rounded-2xl bg-accent px-5 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover sm:w-auto"
          >
            {t('categories.done')}
          </motion.button>
        </div>
      </motion.form>
    </ModalDialog>
  )
}
