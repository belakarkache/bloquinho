import { describe, expect, it } from 'vitest'
import { computeMasonry, type MasonryBlock } from './masonry'

const note = (id: string): MasonryBlock => ({ id, kind: 'note' })
const header = (id: string): MasonryBlock => ({ id, kind: 'header' })

describe('computeMasonry', () => {
  it('places each note in the shortest column', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 40],
      ['c', 50],
    ])
    const { positions, height } = computeMasonry([note('a'), note('b'), note('c')], {
      columns: 2,
      width: 210,
      gap: 10,
      headerHeight: 30,
      heights,
    })
    expect(positions.get('a')).toEqual({ x: 0, y: 0, width: 100 })
    expect(positions.get('b')).toEqual({ x: 110, y: 0, width: 100 })
    expect(positions.get('c')).toEqual({ x: 110, y: 50, width: 100 })
    expect(height).toBe(100)
  })

  it('starts a new full-width row for headers', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 60],
    ])
    const { positions, height } = computeMasonry([header('h1'), note('a'), header('h2'), note('b')], {
      columns: 2,
      width: 210,
      gap: 10,
      headerHeight: 30,
      heights,
    })
    expect(positions.get('h1')).toEqual({ x: 0, y: 0, width: 210 })
    expect(positions.get('a')).toEqual({ x: 0, y: 40, width: 100 })
    expect(positions.get('h2')).toEqual({ x: 0, y: 150, width: 210 })
    expect(positions.get('b')).toEqual({ x: 0, y: 190, width: 100 })
    expect(height).toBe(250)
  })
})
