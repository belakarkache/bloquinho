import { PushPinIcon } from '@phosphor-icons/react'
import { motion, type PanInfo } from 'motion/react'
import type { MouseEvent, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { toNoteView, type NoteBlock } from '../notes/checklist'
import type { Note } from '../notes/types'
import { plainInline } from '../notes/markdown'
import { ChecklistBox } from './ChecklistBox'
import { InlineMarkdown } from './InlineMarkdown'
import type { MasonryPosition } from './masonry'
import { bouncy, gentle, quickFade } from './motion'
import { DeleteButton, PinButton } from './NoteButtons'
import type { Point } from './reorder'
import { useCardDrag } from './useCardDrag'
import { useCardElevation } from './useCardElevation'
import { useOverflow } from './useMeasure'

interface NoteCardProps {
  note: Note
  position: MasonryPosition
  measured: boolean
  measureRef: Ref<HTMLElement>
  onOpen: (note: Note) => void
  onToggleItem: (note: Note, line: number) => void
  onTogglePin: (note: Note) => void
  onDelete: (note: Note) => void
  onContextMenu: (note: Note, event: MouseEvent) => void
  onDragStart: (note: Note) => void
  onDrag: (note: Note, point: Point) => void
  onDragEnd: (note: Note) => void
}

function tiltFor(id: string): number {
  const hash = [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 997, 7)
  return ((hash % 5) - 2) * 0.6
}

const PREVIEW_BLOCKS = 10

type ListBlock = Extract<NoteBlock, { kind: 'item' | 'bullet' | 'ordered' }>
type BodySection = Exclude<NoteBlock, ListBlock> | { kind: 'list'; type: ListBlock['kind']; items: ListBlock[] }

const BODY_TEXT = 'text-[14.5px] leading-relaxed break-words text-ink-soft'

function ChecklistRow({ block, onToggle }: { block: Extract<ListBlock, { kind: 'item' }>; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <li className="flex items-start gap-1.5 text-[14.5px] leading-relaxed">
      <ChecklistBox
        checked={block.checked}
        label={block.text || t('note.emptyItem')}
        onToggle={onToggle}
        className="pointer-events-auto"
      />
      <span
        className={`min-w-0 break-words transition-colors ${block.checked ? 'text-ink-faint line-through' : 'text-ink-soft'}`}
      >
        <InlineMarkdown text={block.text} />
      </span>
    </li>
  )
}

function ListRow({ block, onToggleItem }: { block: ListBlock; onToggleItem: (line: number) => void }) {
  if (block.kind === 'item') return <ChecklistRow block={block} onToggle={() => onToggleItem(block.line)} />
  return (
    <li className={`flex items-start gap-1.5 ${BODY_TEXT}`}>
      <span aria-hidden="true" className="min-w-[1.125em] shrink-0 text-center text-ink-faint tabular-nums">
        {block.kind === 'bullet' ? '•' : `${block.number}.`}
      </span>
      <span className="min-w-0">
        <InlineMarkdown text={block.text} />
      </span>
    </li>
  )
}

function isListBlock(block: NoteBlock): block is ListBlock {
  return block.kind === 'item' || block.kind === 'bullet' || block.kind === 'ordered'
}

function toSections(blocks: NoteBlock[]): BodySection[] {
  const sections: BodySection[] = []
  for (const block of blocks) {
    const previous = sections.at(-1)
    if (!isListBlock(block)) sections.push(block)
    else if (previous?.kind === 'list' && previous.type === block.kind) previous.items.push(block)
    else sections.push({ kind: 'list', type: block.kind, items: [block] })
  }
  return sections
}

function BodySectionView({ section, onToggleItem }: { section: BodySection; onToggleItem: (line: number) => void }) {
  switch (section.kind) {
    case 'list': {
      const List = section.type === 'ordered' ? 'ol' : 'ul'
      return (
        <List className="flex flex-col gap-1">
          {section.items.map((item, index) => (
            <ListRow key={index} block={item} onToggleItem={onToggleItem} />
          ))}
        </List>
      )
    }
    case 'heading':
      return (
        <h4 className="font-display text-[15.5px] leading-snug font-semibold break-words text-ink">
          <InlineMarkdown text={section.text} />
        </h4>
      )
    case 'code':
      return (
        <pre className="rounded-xl bg-ink/6 px-2.5 py-2 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ink">
          {section.text}
        </pre>
      )
    case 'text':
      return (
        <p className={`whitespace-pre-wrap ${BODY_TEXT}`}>
          <InlineMarkdown text={section.text} />
        </p>
      )
  }
}

function NoteBody({ blocks, onToggleItem }: { blocks: NoteBlock[]; onToggleItem: (line: number) => void }) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {toSections(blocks.slice(0, PREVIEW_BLOCKS)).map((section, index) => (
        <BodySectionView key={index} section={section} onToggleItem={onToggleItem} />
      ))}
    </div>
  )
}

export function NoteCard({
  note,
  position,
  measured,
  measureRef,
  onOpen,
  onToggleItem,
  onTogglePin,
  onDelete,
  onContextMenu,
  onDragStart,
  onDrag,
  onDragEnd,
}: NoteCardProps) {
  const { t } = useTranslation()
  const { title, blocks } = toNoteView(note.content)
  const { frameRef, contentRef, overflowing } = useOverflow<HTMLDivElement, HTMLDivElement>()
  const drag = useCardDrag()
  const elevation = useCardElevation(drag.armed)

  return (
    <motion.article
      ref={measureRef}
      layoutId={note.id}
      data-measure-id={note.id}
      data-color={note.color}
      layout
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{
        opacity: measured ? 1 : 0,
        scale: drag.armed ? 1.04 : 1,
        transition: { opacity: { duration: 0.2 }, scale: bouncy },
      }}
      exit={{ opacity: 0, scale: 0.8, rotate: -4, transition: quickFade }}
      whileHover={{ y: -5, rotate: tiltFor(note.id), transition: gentle }}
      whileDrag={{ scale: 1.05, rotate: tiltFor(note.id) * 2 + 1.5, transition: bouncy }}
      drag
      dragControls={drag.controls}
      dragListener={false}
      dragMomentum={false}
      dragSnapToOrigin
      onPointerDown={drag.onPointerDown}
      onContextMenu={(event) => {
        drag.onContextMenu(event)
        onContextMenu(note, event)
      }}
      onClickCapture={drag.onClickCapture}
      onDragStart={() => {
        drag.markDragged()
        elevation.lift()
        onDragStart(note)
      }}
      onDrag={(_, info: PanInfo) => onDrag(note, info.point)}
      onDragEnd={() => onDragEnd(note)}
      onDragTransitionEnd={elevation.land}
      {...elevation.handlers}
      style={{ width: position.width, left: position.x, top: position.y }}
      transition={gentle}
      className={`note-surface group/card absolute flex max-h-75 min-h-25 touch-manipulation flex-col rounded-[22px] pb-14 select-none [-webkit-touch-callout:none] ${elevation.layer}`}
    >
      <button
        type="button"
        onClick={() => onOpen(note)}
        aria-label={title ? `${t('note.open')}: ${plainInline(title)}` : t('note.open')}
        className="absolute inset-0 rounded-[22px]"
      />
      <div
        ref={frameRef}
        className={`pointer-events-none relative min-h-0 overflow-hidden px-4 pt-4 ${overflowing ? 'mask-[linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]' : ''}`}
      >
        <div ref={contentRef}>
          {title && (
            <h3 className="pr-6 font-display text-[18px] leading-snug font-semibold tracking-[-0.01em] break-words text-ink">
              <InlineMarkdown text={title} />
            </h3>
          )}
          {blocks.length > 0 && <NoteBody blocks={blocks} onToggleItem={(line) => onToggleItem(note, line)} />}
        </div>
      </div>
      {note.pinned && (
        <motion.span
          initial={{ scale: 0, rotate: 45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={bouncy}
          className="pointer-events-none absolute top-3.5 right-3.5 text-ink"
          aria-hidden="true"
        >
          <PushPinIcon size={18} weight="fill" />
        </motion.span>
      )}
      <div className="absolute right-2 bottom-2 flex gap-0.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/card:opacity-100 [@media(hover:hover)]:group-hover/card:opacity-100">
        <PinButton
          pinned={note.pinned}
          iconClassName="transition-transform group-hover/icon:-rotate-12"
          onToggle={() => onTogglePin(note)}
        />
        <DeleteButton onDelete={() => onDelete(note)} />
      </div>
    </motion.article>
  )
}
