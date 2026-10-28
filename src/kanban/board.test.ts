import { describe, expect, it } from 'vitest'
import { boardColumns, folderNames, moveCard } from './board'
import type { Card } from './types'

function card(id: string, column: Card['column'], order: number, folder: string | null = null): Card {
  return {
    id,
    title: id,
    description: '',
    column,
    order,
    folder,
    sourceExcerpt: '',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    syncState: 'pending',
  }
}

const cards = [
  card('a', 'todo', 1_024, 'Casa'),
  card('b', 'todo', 2_048),
  card('c', 'doing', 1_024, 'Trabalho'),
  card('d', 'todo', 3_072, 'Casa'),
]

function ids(columns: ReturnType<typeof boardColumns>) {
  return { todo: columns.todo.map(({ id }) => id), doing: columns.doing.map(({ id }) => id), done: columns.done.map(({ id }) => id) }
}

describe('folderNames', () => {
  it('lists unique folders alphabetically', () => {
    expect(folderNames([...cards, card('e', 'done', 0, 'Banco')])).toEqual(['Banco', 'Casa', 'Trabalho'])
  })
})

describe('boardColumns', () => {
  it('groups by column and filters by folder', () => {
    expect(ids(boardColumns(cards, null))).toEqual({ todo: ['a', 'b', 'd'], doing: ['c'], done: [] })
    expect(ids(boardColumns(cards, 'Casa'))).toEqual({ todo: ['a', 'd'], doing: [], done: [] })
  })
})

describe('moveCard', () => {
  const columns = boardColumns(cards, null)

  it('reorders inside a column between its neighbors', () => {
    const result = moveCard(columns, 'd', 'todo', 0)!
    expect(ids(result.columns).todo).toEqual(['d', 'a', 'b'])
    expect(result.card.order).toBe(0)
    expect(moveCard(columns, 'a', 'todo', 1)!.card.order).toBe(2_560)
  })

  it('moves across columns and into empty ones', () => {
    const across = moveCard(columns, 'b', 'doing', 0)!
    expect(ids(across.columns)).toEqual({ todo: ['a', 'd'], doing: ['b', 'c'], done: [] })
    expect(across.card).toMatchObject({ column: 'doing', order: 0 })
    const empty = moveCard(columns, 'c', 'done', 5)!
    expect(ids(empty.columns)).toEqual({ todo: ['a', 'b', 'd'], doing: [], done: ['c'] })
    expect(empty.card.order).toBe(1_024)
  })

  it('ignores unknown cards', () => {
    expect(moveCard(columns, 'x', 'done', 0)).toBeNull()
  })
})
