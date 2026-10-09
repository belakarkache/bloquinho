import { describe, expect, it } from 'vitest'
import { matchesFilter, partitionNotes } from './filter'
import type { Note } from './types'

function note(overrides: Partial<Note>): Note {
  return {
    id: crypto.randomUUID(),
    content: '',
    color: 'default',
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    syncState: 'synced',
    ...overrides,
  }
}

describe('matchesFilter', () => {
  it('matches every search term ignoring case and accents', () => {
    const shopping = note({ content: 'Comprar Pão e café' })
    expect(matchesFilter(shopping, { query: 'pao CAFE', color: null })).toBe(true)
    expect(matchesFilter(shopping, { query: 'pao leite', color: null })).toBe(false)
  })

  it('ignores checklist markers', () => {
    const list = note({ content: 'Mercado\n- [x] leite' })
    expect(matchesFilter(list, { query: 'leite', color: null })).toBe(true)
    expect(matchesFilter(list, { query: 'x', color: null })).toBe(false)
  })

  it('filters by color', () => {
    const red = note({ content: 'x', color: 'coral' })
    expect(matchesFilter(red, { query: '', color: 'coral' })).toBe(true)
    expect(matchesFilter(red, { query: '', color: 'sky' })).toBe(false)
  })
})

describe('partitionNotes', () => {
  it('splits pinned from others, newest created first', () => {
    const older = note({ content: 'a', createdAt: 1, updatedAt: 9 })
    const newer = note({ content: 'b', createdAt: 2, updatedAt: 2 })
    const pinned = note({ content: 'c', pinned: true })
    const result = partitionNotes([older, pinned, newer], { query: '', color: null })
    expect(result.pinned).toEqual([pinned])
    expect(result.others).toEqual([newer, older])
  })

  it('follows the saved order', () => {
    const first = note({ content: 'a', createdAt: 1 })
    const second = note({ content: 'b', createdAt: 2 })
    const result = partitionNotes([first, second], { query: '', color: null }, [first.id, second.id])
    expect(result.others).toEqual([first, second])
  })
})
