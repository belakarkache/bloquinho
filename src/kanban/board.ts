import { cardsInColumn, orderBetween } from './order'
import { CARD_COLUMNS, type Card, type CardColumn } from './types'

export type BoardColumns = Record<CardColumn, Card[]>

export function folderNames(cards: readonly Card[]): string[] {
  const names = new Set(cards.flatMap((card) => (card.folder ? [card.folder] : [])))
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function boardColumns(cards: readonly Card[], folder: string | null): BoardColumns {
  const visible = folder === null ? cards : cards.filter((card) => card.folder === folder)
  return Object.fromEntries(CARD_COLUMNS.map((column) => [column, cardsInColumn(visible, column)])) as BoardColumns
}

export function moveCard(
  columns: BoardColumns,
  id: string,
  column: CardColumn,
  index: number,
): { columns: BoardColumns; card: Card } | null {
  const card = CARD_COLUMNS.flatMap((name) => columns[name]).find((other) => other.id === id)
  if (!card) return null
  const target = columns[column].filter((other) => other.id !== id)
  const position = Math.min(Math.max(index, 0), target.length)
  const order = orderBetween(target[position - 1]?.order ?? null, target[position]?.order ?? null)
  const moved = { ...card, column, order }
  target.splice(position, 0, moved)
  return {
    columns: { ...columns, [card.column]: columns[card.column].filter((other) => other.id !== id), [column]: target },
    card: moved,
  }
}
