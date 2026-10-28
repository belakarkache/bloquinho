import { FolderIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorPicker } from '../components/ColorPicker'
import { ModalDialog } from '../components/ModalDialog'
import { gentle, pressable, quickFade, snappy } from '../components/motion'
import { folderNames } from './board'
import { folderColorOf, foldersRepository, toFolderColors } from './folders'
import { cardsRepository } from './repository'
import { CARD_FOLDER_MAX_LENGTH, FOLDER_COLORS, type FolderColor } from './types'

interface FolderDraft {
  name?: string
  color?: FolderColor
}

export function FoldersDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const cards = useLiveQuery(() => cardsRepository.listVisible(), [], [])
  const stored = useLiveQuery(() => foldersRepository.list(), [], [])
  const folders = useMemo(() => folderNames(cards), [cards])
  const colors = useMemo(() => toFolderColors(stored), [stored])
  const [drafts, setDrafts] = useState<Record<string, FolderDraft>>({})
  const [picking, setPicking] = useState<string | null>(null)

  const update = (folder: string, changes: FolderDraft) =>
    setDrafts((current) => ({ ...current, [folder]: { ...current[folder], ...changes } }))

  const saveAndClose = async () => {
    onClose()
    for (const [folder, { name, color }] of Object.entries(drafts)) {
      const finalName = name?.trim() || folder
      if (finalName !== folder) await cardsRepository.renameFolder(folder, finalName)
      if (color) await foldersRepository.setColor(finalName, color)
    }
  }

  return (
    <ModalDialog
      onClose={() => void saveAndClose()}
      aria-labelledby="folders-title"
      className="items-end p-0 sm:items-center sm:p-6"
    >
      <motion.form
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        onSubmit={(event) => {
          event.preventDefault()
          void saveAndClose()
        }}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[32px] sm:p-8"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <FolderIcon size={24} weight="bold" />
        </span>
        <h2 id="folders-title" className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">
          {t('kanban.foldersDialog.title')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {folders.length > 0 ? t('kanban.foldersDialog.intro') : t('kanban.foldersDialog.empty')}
        </p>
        {folders.length > 0 && (
          <ul className="-mx-1 mt-5 flex min-h-0 flex-col gap-2 overflow-y-auto px-1 py-1">
            {folders.map((folder) => {
              const draft = drafts[folder] ?? {}
              const color = draft.color ?? folderColorOf(colors, folder)
              const open = picking === folder
              return (
                <li key={folder}>
                  <div className="flex h-12 items-center gap-3 rounded-2xl border-2 border-line bg-surface pr-3.5 pl-2 transition-[border-color,box-shadow] duration-200 focus-within:border-accent-ink focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
                    <button
                      type="button"
                      onClick={() => setPicking(open ? null : folder)}
                      aria-expanded={open}
                      aria-label={t('kanban.foldersDialog.color', { name: folder })}
                      title={t('kanban.foldersDialog.color', { name: folder })}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink/8"
                    >
                      <span data-color={color} className="note-swatch size-6 rounded-full border-2 border-ink/15" />
                    </button>
                    <input
                      value={draft.name ?? folder}
                      onChange={(event) => update(folder, { name: event.target.value })}
                      placeholder={folder}
                      maxLength={CARD_FOLDER_MAX_LENGTH}
                      aria-label={t('kanban.foldersDialog.rename', { name: folder })}
                      enterKeyHint="done"
                      className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={snappy}
                        className="overflow-hidden"
                      >
                        <div className="px-1 pt-2 pb-1">
                          <ColorPicker
                            value={color}
                            onChange={(next) => update(folder, { color: next })}
                            colors={FOLDER_COLORS}
                            label={t('kanban.foldersDialog.color', { name: folder })}
                            customNames={false}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        )}
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
