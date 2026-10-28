import { describe, expect, it } from 'vitest'
import { cardsInColumn, orderBetween } from './order'
import type { Card } from './types'

function card(id: string, column: Card['column'], order: number, createdAt = 0): Card {
  return {
    id,
    title: id,
    description: '',
    column,
    order,
    folder: null,
    sourceExcerpt: '',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    syncState: 'pending',
  }
}

describe('orderBetween', () => {
  it('places cards in empty, leading, trailing and middle positions', () => {
    expect(orderBetween(null, null)).toBe(1_024)
    expect(orderBetween(null, 1_024)).toBe(0)
    expect(orderBetween(1_024, null)).toBe(2_048)
    expect(orderBetween(1_024, 2_048)).toBe(1_536)
  })
})

describe('cardsInColumn', () => {
  it('filters by column and sorts by order then creation', () => {
    const cards = [card('c', 'todo', 2), card('a', 'todo', 1, 5), card('x', 'done', 0), card('b', 'todo', 1, 9)]
    expect(cardsInColumn(cards, 'todo').map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})
