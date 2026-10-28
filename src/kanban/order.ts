import type { Card, CardColumn } from './types'

const ORDER_STEP = 1_024

export function orderBetween(previous: number | null, next: number | null): number {
  if (previous === null && next === null) return ORDER_STEP
  if (previous === null) return next! - ORDER_STEP
  if (next === null) return previous + ORDER_STEP
  return (previous + next) / 2
}

export function cardsInColumn(cards: readonly Card[], column: CardColumn): Card[] {
  return cards.filter((card) => card.column === column).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}
