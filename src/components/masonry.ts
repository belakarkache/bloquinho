export type MasonryBlock = { id: string; kind: 'note' | 'header' }

export interface MasonryOptions {
  columns: number
  width: number
  gap: number
  headerHeight: number
  heights: ReadonlyMap<string, number>
}

export interface MasonryPosition {
  x: number
  y: number
  width: number
}

export interface MasonryLayout {
  positions: Map<string, MasonryPosition>
  height: number
}

const FALLBACK_NOTE_HEIGHT = 120

export function blockHeight(block: MasonryBlock, heights: ReadonlyMap<string, number>, headerHeight: number): number {
  if (block.kind === 'header') return headerHeight
  return heights.get(block.id) ?? FALLBACK_NOTE_HEIGHT
}

export function computeMasonry(blocks: MasonryBlock[], options: MasonryOptions): MasonryLayout {
  const { columns, width, gap, headerHeight, heights } = options
  const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns)
  const positions = new Map<string, MasonryPosition>()
  let columnTops = Array.from({ length: columns }, () => 0)

  for (const block of blocks) {
    if (block.kind === 'header') {
      const top = Math.max(...columnTops)
      const y = top === 0 ? 0 : top + gap
      positions.set(block.id, { x: 0, y, width })
      columnTops = columnTops.map(() => y + blockHeight(block, heights, headerHeight))
      continue
    }
    const column = columnTops.indexOf(Math.min(...columnTops))
    const y = columnTops[column] === 0 ? 0 : columnTops[column] + gap
    positions.set(block.id, { x: column * (columnWidth + gap), y, width: columnWidth })
    columnTops[column] = y + blockHeight(block, heights, headerHeight)
  }

  return { positions, height: Math.max(0, ...columnTops) }
}
