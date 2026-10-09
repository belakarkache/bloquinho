import { blockHeight, type MasonryBlock, type MasonryLayout } from './masonry'

export interface NoteSections {
  pinned: string[]
  others: string[]
}

export type SectionName = keyof NoteSections

export type DropTarget = { kind: 'note'; id: string; after: boolean } | { kind: 'section'; section: SectionName }

export interface Point {
  x: number
  y: number
}

export interface Neighbors {
  section: SectionName
  previous: string | null
  next: string | null
}

export const PINNED_HEADER = 'section:pinned'
export const OTHERS_HEADER = 'section:others'

const HEADER_SECTIONS: Record<string, SectionName> = {
  [PINNED_HEADER]: 'pinned',
  [OTHERS_HEADER]: 'others',
}

export function toMasonryBlocks({ pinned, others }: NoteSections): MasonryBlock[] {
  const noteBlock = (id: string): MasonryBlock => ({ id, kind: 'note' })
  if (pinned.length === 0) return others.map(noteBlock)
  return [
    { id: PINNED_HEADER, kind: 'header' },
    ...pinned.map(noteBlock),
    ...(others.length > 0 ? [{ id: OTHERS_HEADER, kind: 'header' } as const, ...others.map(noteBlock)] : []),
  ]
}

function sectionOf(sections: NoteSections, id: string): SectionName | null {
  if (sections.pinned.includes(id)) return 'pinned'
  if (sections.others.includes(id)) return 'others'
  return null
}

export function moveToTarget(sections: NoteSections, id: string, target: DropTarget): NoteSections {
  const without: NoteSections = {
    pinned: sections.pinned.filter((other) => other !== id),
    others: sections.others.filter((other) => other !== id),
  }
  if (target.kind === 'section') return { ...without, [target.section]: [id, ...without[target.section]] }
  const section = sectionOf(without, target.id)
  if (!section) return sections
  const list = without[section]
  const index = list.indexOf(target.id) + (target.after ? 1 : 0)
  return { ...without, [section]: [...list.slice(0, index), id, ...list.slice(index)] }
}

export function sameSections(a: NoteSections, b: NoteSections): boolean {
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((id, index) => id === y[index])
  return same(a.pinned, b.pinned) && same(a.others, b.others)
}

export function neighborsOf(sections: NoteSections, id: string): Neighbors | null {
  const section = sectionOf(sections, id)
  if (!section) return null
  const list = sections[section]
  const index = list.indexOf(id)
  return { section, previous: list[index - 1] ?? null, next: list[index + 1] ?? null }
}

interface HitTestOptions {
  blocks: MasonryBlock[]
  layout: MasonryLayout
  heights: ReadonlyMap<string, number>
  headerHeight: number
  draggedId: string
}

export function findDropTarget(point: Point, options: HitTestOptions): DropTarget | null {
  const { blocks, layout, heights, headerHeight, draggedId } = options
  for (const block of blocks) {
    const position = layout.positions.get(block.id)
    if (block.id === draggedId || !position) continue
    const height = blockHeight(block, heights, headerHeight)
    const inside =
      point.x >= position.x &&
      point.x <= position.x + position.width &&
      point.y >= position.y &&
      point.y <= position.y + height
    if (!inside) continue
    if (block.kind === 'header') return { kind: 'section', section: HEADER_SECTIONS[block.id] }
    return { kind: 'note', id: block.id, after: point.y > position.y + height / 2 }
  }
  return null
}
