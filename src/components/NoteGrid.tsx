import { NoteIcon, PushPinIcon, type Icon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartitionedNotes } from '../notes/filter'
import type { Note } from '../notes/types'
import { EmptyState } from './EmptyState'
import { computeMasonry } from './masonry'
import { gentle, quickFade } from './motion'
import { NoteCard } from './NoteCard'
import {
  findDropTarget,
  moveToTarget,
  neighborsOf,
  OTHERS_HEADER,
  PINNED_HEADER,
  sameSections,
  toMasonryBlocks,
  type DropTarget,
  type Neighbors,
  type NoteSections,
  type Point,
} from './reorder'
import { useColumnCount } from './useColumnCount'
import { useElementWidth, useHeights } from './useMeasure'

const HEADER_HEIGHT = 36
const SETTLE_FALLBACK_MS = 1_000

const SECTIONS: Record<string, { icon: Icon; title: 'grid.pinned' | 'grid.others' }> = {
  [PINNED_HEADER]: { icon: PushPinIcon, title: 'grid.pinned' },
  [OTHERS_HEADER]: { icon: NoteIcon, title: 'grid.others' },
}

interface NoteGridProps {
  notes: PartitionedNotes
  filtering: boolean
  onOpen: (note: Note) => void
  onToggleItem: (note: Note, line: number) => void
  onTogglePin: (note: Note) => void
  onDelete: (note: Note) => void
  onContextMenu: (note: Note, event: MouseEvent) => void
  onReorder: (note: Note, neighbors: Neighbors) => void
}

interface DragDraft {
  sections: NoteSections
  dropped: boolean
}

function toSections({ pinned, others }: PartitionedNotes): NoteSections {
  return { pinned: pinned.map((note) => note.id), others: others.map((note) => note.id) }
}

function targetKey(target: DropTarget): string {
  return target.kind === 'section' ? target.section : `${target.id}:${target.after}`
}

function SectionHeader({ icon: SectionIcon, title, x, y }: { icon: Icon; title: string; x: number; y: number }) {
  return (
    <motion.h2
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: quickFade }}
      transition={gentle}
      style={{ height: HEADER_HEIGHT, left: x, top: y }}
      className="absolute flex items-center gap-1.5 px-1 text-xs font-bold tracking-[0.14em] text-ink-soft uppercase"
    >
      <SectionIcon size={14} weight="fill" />
      {title}
    </motion.h2>
  )
}

export function NoteGrid({
  notes,
  filtering,
  onOpen,
  onToggleItem,
  onTogglePin,
  onDelete,
  onContextMenu,
  onReorder,
}: NoteGridProps) {
  const { t } = useTranslation()
  const columns = useColumnCount()
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const [heights, measure] = useHeights()
  const gap = columns > 2 ? 16 : 12

  const [draft, setDraft] = useState<DragDraft | null>(null)
  const lastTarget = useRef<string | null>(null)

  const current = toSections(notes)
  const settled = draft?.dropped === true && sameSections(draft.sections, current)
  if (settled) setDraft(null)
  const sections = draft && !settled ? draft.sections : current

  const blocks = toMasonryBlocks(sections)
  const layout = computeMasonry(blocks, { columns, width, gap, headerHeight: HEADER_HEIGHT, heights })
  const notesById = new Map([...notes.pinned, ...notes.others].map((note) => [note.id, note]))
  const empty = notesById.size === 0

  const startDrag = () => {
    lastTarget.current = null
    setDraft({ sections: current, dropped: false })
  }

  const dragOver = (note: Note, point: Point) => {
    const container = containerRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const local = { x: point.x - bounds.left - window.scrollX, y: point.y - bounds.top - window.scrollY }
    const target = findDropTarget(local, { blocks, layout, heights, headerHeight: HEADER_HEIGHT, draggedId: note.id })
    if (!target || targetKey(target) === lastTarget.current) return
    lastTarget.current = targetKey(target)
    setDraft((latest) => latest && { ...latest, sections: moveToTarget(latest.sections, note.id, target) })
  }

  const drop = (note: Note) => {
    if (!draft) return
    const dropped = { ...draft, dropped: true }
    setDraft(dropped)
    setTimeout(() => setDraft((latest) => (latest === dropped ? null : latest)), SETTLE_FALLBACK_MS)
    const neighbors = neighborsOf(draft.sections, note.id)
    if (neighbors && !sameSections(draft.sections, current)) onReorder(note, neighbors)
  }

  return (
    <div className="mt-8">
      {empty && <EmptyState filtering={filtering} />}
      <motion.div ref={containerRef} animate={{ height: layout.height }} transition={gentle} className="relative">
        <AnimatePresence>
          {blocks.map((block) => {
            const position = layout.positions.get(block.id)
            if (!position || width === 0) return null
            if (block.kind === 'header') {
              const { icon, title } = SECTIONS[block.id]
              return <SectionHeader key={block.id} icon={icon} title={t(title)} x={position.x} y={position.y} />
            }
            const note = notesById.get(block.id)
            if (!note) return null
            return (
              <NoteCard
                key={note.id}
                note={note}
                position={position}
                measured={heights.has(note.id)}
                measureRef={measure}
                onOpen={onOpen}
                onToggleItem={onToggleItem}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
                onContextMenu={onContextMenu}
                onDragStart={startDrag}
                onDrag={dragOver}
                onDragEnd={drop}
              />
            )
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
