import { describe, expect, it } from 'vitest'
import { applyOrder, moveBetween } from './order'
import type { Note } from './types'

function note(id: string, createdAt: number): Note {
  return {
    id,
    content: '',
    color: 'default',
    pinned: false,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    syncState: 'synced',
  }
}

describe('applyOrder', () => {
  it('puts notes missing from the order first, newest created first', () => {
    const notes = [note('a', 1), note('b', 2), note('c', 3), note('d', 4)]
    const ids = applyOrder(notes, ['b', 'a']).map((n) => n.id)
    expect(ids).toEqual(['d', 'c', 'b', 'a'])
  })

  it('ignores ids of notes that no longer exist', () => {
    const ids = applyOrder([note('a', 1), note('b', 2)], ['gone', 'a', 'b']).map((n) => n.id)
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('moveBetween', () => {
  it('places the note right before its next neighbor', () => {
    expect(moveBetween(['a', 'b', 'c', 'd'], 'd', 'a', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })

  it('places the note right after its previous neighbor when it is last', () => {
    expect(moveBetween(['a', 'b', 'c'], 'a', 'c', null)).toEqual(['b', 'c', 'a'])
  })

  it('places the note first when it has no neighbors', () => {
    expect(moveBetween(['a', 'b'], 'b', null, null)).toEqual(['b', 'a'])
  })
})
