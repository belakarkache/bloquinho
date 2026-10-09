import { describe, expect, it } from 'vitest'
import { computeMasonry } from './masonry'
import { findDropTarget, moveToTarget, neighborsOf, PINNED_HEADER, toMasonryBlocks } from './reorder'

describe('moveToTarget', () => {
  const sections = { pinned: ['p1', 'p2'], others: ['a', 'b', 'c'] }

  it('moves a note before or after another one', () => {
    expect(moveToTarget(sections, 'c', { kind: 'note', id: 'a', after: false }).others).toEqual(['c', 'a', 'b'])
    expect(moveToTarget(sections, 'a', { kind: 'note', id: 'b', after: true }).others).toEqual(['b', 'a', 'c'])
  })

  it('moves a note into the other section', () => {
    const moved = moveToTarget(sections, 'b', { kind: 'note', id: 'p1', after: true })
    expect(moved).toEqual({ pinned: ['p1', 'b', 'p2'], others: ['a', 'c'] })
  })

  it('moves a note to the start of a section through its header', () => {
    const moved = moveToTarget(sections, 'p2', { kind: 'section', section: 'others' })
    expect(moved).toEqual({ pinned: ['p1'], others: ['p2', 'a', 'b', 'c'] })
  })
})

describe('neighborsOf', () => {
  it('returns the section and surrounding notes', () => {
    const sections = { pinned: ['p1'], others: ['a', 'b', 'c'] }
    expect(neighborsOf(sections, 'b')).toEqual({ section: 'others', previous: 'a', next: 'c' })
    expect(neighborsOf(sections, 'p1')).toEqual({ section: 'pinned', previous: null, next: null })
  })
})

describe('findDropTarget', () => {
  const sections = { pinned: ['p1'], others: ['a', 'b'] }
  const blocks = toMasonryBlocks(sections)
  const heights = new Map([
    ['p1', 100],
    ['a', 100],
    ['b', 100],
  ])
  const layout = computeMasonry(blocks, { columns: 2, width: 210, gap: 10, headerHeight: 30, heights })
  const hit = (x: number, y: number, draggedId = 'b') =>
    findDropTarget({ x, y }, { blocks, layout, heights, headerHeight: 30, draggedId })

  it('targets the top or bottom half of the card under the pointer', () => {
    const a = layout.positions.get('a')!
    expect(hit(a.x + 5, a.y + 10)).toEqual({ kind: 'note', id: 'a', after: false })
    expect(hit(a.x + 5, a.y + 90)).toEqual({ kind: 'note', id: 'a', after: true })
  })

  it('targets a section through its header', () => {
    expect(hit(150, layout.positions.get(PINNED_HEADER)!.y + 5)).toEqual({ kind: 'section', section: 'pinned' })
  })

  it('ignores the dragged card and empty space', () => {
    const b = layout.positions.get('b')!
    expect(hit(b.x + 5, b.y + 10)).toBeNull()
    expect(hit(5, 10_000)).toBeNull()
  })
})
