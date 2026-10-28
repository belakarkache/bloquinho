import { CollisionPriority } from '@dnd-kit/abstract'
import { DragDropProvider, useDroppable, type DragDropEventHandlers } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { CheckCircleIcon, CircleDashedIcon, CircleHalfIcon, PlusIcon, type Icon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bouncy, pressable } from '../components/motion'
import { boardColumns, moveCard, type BoardColumns } from './board'
import { folderColorOf, type FolderColors } from './folders'
import { cardsRepository } from './repository'
import { CARD_COLUMNS, isCardColumn, type Card, type CardColumn } from './types'

const COLUMN_ICON: Record<CardColumn, Icon> = {
  todo: CircleDashedIcon,
  doing: CircleHalfIcon,
  done: CheckCircleIcon,
}

interface KanbanBoardProps {
  cards: Card[]
  folder: string | null
  folderColors: FolderColors
  onOpen: (card: Card) => void
  onAdd: () => void
}

function KanbanCard({
  card,
  index,
  folderColors,
  onOpen,
}: {
  card: Card
  index: number
  folderColors: FolderColors | null
  onOpen: (card: Card) => void
}) {
  const { t } = useTranslation()
  const { ref, isDragging } = useSortable({ id: card.id, index, group: card.column, type: 'card', accept: 'card' })
  const done = card.column === 'done'

  return (
    <li
      ref={ref}
      role="button"
      tabIndex={0}
      data-color="default"
      aria-label={`${t('kanban.openCard')}: ${card.title}`}
      onClick={() => onOpen(card)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(card)
      }}
      className={`note-surface group/card relative cursor-pointer touch-manipulation rounded-[20px] select-none [-webkit-touch-callout:none] transition-[rotate,box-shadow] duration-200 ${isDragging ? 'z-10 rotate-2 shadow-[0_24px_40px_-18px_rgb(var(--shadow-ink)/0.55)]!' : ''}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={bouncy}
        className="flex flex-col gap-1 p-4"
      >
        <span
          className={`font-display text-[16px] leading-snug font-semibold tracking-[-0.01em] break-words ${done ? 'text-ink-soft line-through decoration-ink/30' : 'text-ink'}`}
        >
          {card.title}
        </span>
        {card.description && (
          <span className="line-clamp-3 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
            {card.description}
          </span>
        )}
        {folderColors && card.folder && (
          <span
            data-color={folderColorOf(folderColors, card.folder)}
            className="note-swatch mt-1.5 max-w-full self-start truncate rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-on-brand"
          >
            {card.folder}
          </span>
        )}
      </motion.div>
    </li>
  )
}

function KanbanColumn({
  column,
  cards,
  folderColors,
  onOpen,
  onAdd,
}: {
  column: CardColumn
  cards: Card[]
  folderColors: FolderColors | null
  onOpen: (card: Card) => void
  onAdd?: () => void
}) {
  const { t } = useTranslation()
  const { ref, isDropTarget } = useDroppable({
    id: column,
    type: 'column',
    accept: 'card',
    collisionPriority: CollisionPriority.Low,
  })
  const ColumnIcon = COLUMN_ICON[column]
  const titleId = `kanban-column-${column}`

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      className={`flex w-[min(85%,22rem)] shrink-0 snap-center flex-col rounded-[28px] border-2 bg-surface-2/60 p-2.5 transition-[border-color,background-color] duration-200 sm:w-auto ${isDropTarget ? 'border-accent-ink bg-surface-2' : 'border-transparent'}`}
    >
      <header className="flex items-center gap-2 px-2 pt-1.5 pb-3">
        <ColumnIcon size={18} weight="bold" className="text-ink-soft" />
        <h2 id={titleId} className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
          {t(`kanban.columns.${column}`)}
        </h2>
        <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold text-ink-soft tabular-nums">
          {cards.length}
        </span>
      </header>
      <ul className="flex min-h-24 flex-1 flex-col gap-2.5">
        {cards.map((card, index) => (
          <KanbanCard key={card.id} card={card} index={index} folderColors={folderColors} onOpen={onOpen} />
        ))}
        {cards.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-[20px] border-2 border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
            {t('kanban.emptyColumn')}
          </li>
        )}
      </ul>
      {onAdd && (
        <motion.button
          type="button"
          onClick={onAdd}
          {...pressable}
          whileHover={{ scale: 1.02 }}
          className="group/add mt-2.5 flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <PlusIcon
            size={16}
            weight="bold"
            className="transition-transform duration-300 ease-(--ease-spring) group-hover/add:rotate-90"
          />
          {t('kanban.addCard')}
        </motion.button>
      )}
    </section>
  )
}

export function KanbanBoard({ cards, folder, folderColors, onOpen, onAdd }: KanbanBoardProps) {
  const { t } = useTranslation()
  const [dropped, setDropped] = useState<{ source: Card[]; folder: string | null; columns: BoardColumns } | null>(null)
  const [preview, setPreview] = useState<BoardColumns | null>(null)
  const previewRef = useRef<BoardColumns | null>(null)
  const settled =
    dropped && dropped.source === cards && dropped.folder === folder ? dropped.columns : boardColumns(cards, folder)
  const columns = preview ?? settled

  const showPreview = (next: BoardColumns | null) => {
    previewRef.current = next
    setPreview(next)
  }

  const handleDragOver: DragDropEventHandlers['onDragOver'] = (event) => {
    event.preventDefault()
    const { source, target } = event.operation
    if (!source || !target || source.id === target.id) return
    const current = previewRef.current ?? settled
    const id = String(source.id)
    const column = isSortable(target) ? target.group : target.id
    if (!isCardColumn(column)) return
    const inColumn = current[column].some((card) => card.id === id)
    if (!isSortable(target) && inColumn) return
    const index = isSortable(target) ? target.index : current[column].length
    const result = moveCard(current, id, column, index)
    if (result) showPreview(result.columns)
  }

  const handleDragEnd: DragDropEventHandlers['onDragEnd'] = (event) => {
    const final = previewRef.current
    showPreview(null)
    const { source } = event.operation
    if (event.canceled || !final || !source) return
    const id = String(source.id)
    const original = cards.find((card) => card.id === id)
    const moved = CARD_COLUMNS.flatMap((column) => final[column]).find((card) => card.id === id)
    if (!original || !moved || (moved.column === original.column && moved.order === original.order)) return
    setDropped({ source: cards, folder, columns: final })
    void cardsRepository.move(id, moved.column, moved.order)
  }

  return (
    <DragDropProvider onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div
        aria-label={t('kanban.name')}
        role="group"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto px-4 pb-4 scrollbar-none sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0"
      >
        {CARD_COLUMNS.map((column) => (
          <KanbanColumn
            key={column}
            column={column}
            cards={columns[column]}
            folderColors={folder === null ? folderColors : null}
            onOpen={onOpen}
            onAdd={column === 'todo' ? onAdd : undefined}
          />
        ))}
      </div>
    </DragDropProvider>
  )
}
