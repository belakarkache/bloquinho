import { TrashIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorPicker } from '../components/ColorPicker'
import { ModalDialog } from '../components/ModalDialog'
import { gentle, pressable, quickFade, snappy } from '../components/motion'
import { isSaveShortcut } from '../components/shortcuts'
import { useBackToClose } from '../components/useBackToClose'
import { pickFolderColor, type FolderColors } from './folders'
import { FIELD, LABEL } from './formStyles'
import { SourceExcerpt } from './SourceExcerpt'
import {
  CARD_COLUMNS,
  CARD_DESCRIPTION_MAX_LENGTH,
  CARD_FOLDER_MAX_LENGTH,
  CARD_TITLE_MAX_LENGTH,
  FOLDER_COLORS,
  type Card,
  type CardChanges,
  type CardColumn,
  type FolderColor,
} from './types'

export interface CardDraft extends Required<CardChanges> {
  column: CardColumn
  folderColor: FolderColor | null
}

interface CardEditorProps {
  card: Card | null
  folders: string[]
  folderColors: FolderColors
  defaultFolder: string | null
  onSave: (draft: CardDraft) => void
  onDelete: (card: Card) => void
  onClose: () => void
}

function ColumnPicker({ value, onChange }: { value: CardColumn; onChange: (column: CardColumn) => void }) {
  const { t } = useTranslation()
  const highlightId = useId()
  const labelId = useId()

  return (
    <div>
      <span id={labelId} className={LABEL}>
        {t('kanban.column')}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex gap-0.5 rounded-2xl bg-surface-2 p-1">
        {CARD_COLUMNS.map((column) => {
          const selected = column === value
          return (
            <button
              key={column}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(column)}
              className={`relative h-10 flex-1 rounded-xl text-[13px] font-semibold transition-colors ${selected ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {selected && (
                <motion.span
                  layoutId={highlightId}
                  transition={snappy}
                  className="absolute inset-0 rounded-xl bg-surface shadow-[0_2px_8px_-3px_rgb(var(--shadow-ink)/0.3)]"
                />
              )}
              <span className="relative">{t(`kanban.columns.${column}`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CardEditor({ card, folders, folderColors, defaultFolder, onSave, onDelete, onClose }: CardEditorProps) {
  const { t } = useTranslation()
  const folderListId = useId()
  const [draft, setDraft] = useState<CardDraft>(() => ({
    title: card?.title ?? '',
    description: card?.description ?? '',
    folder: card ? card.folder : defaultFolder,
    column: card?.column ?? 'todo',
    folderColor: null,
  }))
  const [suggestedColor] = useState(() => pickFolderColor(folderColors.values()))
  const update = (changes: Partial<CardDraft>) => setDraft((current) => ({ ...current, ...changes }))
  const folderName = draft.folder?.trim() || null
  const storedColor = folderName ? folderColors.get(folderName) : undefined
  const folderColor = draft.folderColor ?? storedColor ?? suggestedColor

  const saveAndClose = () => {
    const title = draft.title.trim()
    if (title) {
      onSave({
        title,
        description: draft.description.trim(),
        folder: folderName,
        column: draft.column,
        folderColor: folderName && folderColor !== storedColor ? folderColor : null,
      })
    }
    onClose()
  }

  useBackToClose(true, saveAndClose)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isSaveShortcut(event)) return
    event.preventDefault()
    saveAndClose()
  }

  return (
    <ModalDialog
      onClose={saveAndClose}
      aria-labelledby="card-editor-title"
      onKeyDown={handleKeyDown}
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
        className="relative flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-[32px] sm:p-8"
      >
        <h2 id="card-editor-title" className="font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">
          {card ? t('kanban.editCard') : t('kanban.newCard')}
        </h2>
        <div className="mt-5 flex flex-col gap-4">
          <label className="block">
            <span className={LABEL}>{t('kanban.title')}</span>
            <input
              autoFocus={card === null}
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder={t('kanban.titlePlaceholder')}
              maxLength={CARD_TITLE_MAX_LENGTH}
              required
              enterKeyHint="done"
              className={`h-12 w-full ${FIELD}`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>{t('kanban.description')}</span>
            <textarea
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder={t('kanban.descriptionPlaceholder')}
              maxLength={CARD_DESCRIPTION_MAX_LENGTH}
              rows={3}
              className={`block max-h-60 min-h-24 w-full resize-none py-3 leading-relaxed field-sizing-content ${FIELD}`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>{t('kanban.folder')}</span>
            <input
              value={draft.folder ?? ''}
              onChange={(event) => update({ folder: event.target.value })}
              placeholder={t('kanban.folderPlaceholder')}
              maxLength={CARD_FOLDER_MAX_LENGTH}
              list={folderListId}
              enterKeyHint="done"
              className={`h-12 w-full ${FIELD}`}
            />
            <datalist id={folderListId}>
              {folders.map((folder) => (
                <option key={folder} value={folder} />
              ))}
            </datalist>
          </label>
          <AnimatePresence initial={false}>
            {folderName && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={snappy}
                className="-mt-2 overflow-hidden"
              >
                <ColorPicker
                  value={folderColor}
                  onChange={(color) => update({ folderColor: color })}
                  colors={FOLDER_COLORS}
                  label={t('kanban.folderColor')}
                  customNames={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <ColumnPicker value={draft.column} onChange={(column) => update({ column })} />
          {card?.sourceExcerpt && <SourceExcerpt excerpt={card.sourceExcerpt} />}
        </div>
        <div className="mt-6 flex shrink-0 items-center gap-2">
          {card && (
            <motion.button
              type="button"
              onClick={() => onDelete(card)}
              {...pressable}
              className="group/delete inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-danger/12 hover:text-danger"
            >
              <TrashIcon size={18} weight="bold" className="group-hover/delete:animate-wiggle" />
              {t('kanban.delete')}
            </motion.button>
          )}
          <motion.button
            type="submit"
            {...pressable}
            className="ml-auto h-12 rounded-2xl bg-accent px-6 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover"
          >
            {t('kanban.save')}
          </motion.button>
        </div>
      </motion.form>
    </ModalDialog>
  )
}
