import { db as defaultDb, type BloquinhoDB } from '../db/database'
import { FoldersRepository, foldersRepository } from './folders'
import { orderBetween } from './order'
import type { Card, CardChanges, CardColumn, NewCard } from './types'

export class CardsRepository {
  readonly #db: BloquinhoDB
  readonly #now: () => number
  readonly #newId: () => string
  readonly #folders: FoldersRepository

  constructor(
    database: BloquinhoDB,
    now: () => number = Date.now,
    newId: () => string = () => crypto.randomUUID(),
    folders: FoldersRepository = new FoldersRepository(database, now),
  ) {
    this.#db = database
    this.#now = now
    this.#newId = newId
    this.#folders = folders
  }

  async create(input: NewCard): Promise<Card> {
    const [card] = await this.createMany([input])
    return card
  }

  async createMany(inputs: readonly NewCard[]): Promise<Card[]> {
    return this.#db.transaction('rw', this.#db.cards, this.#db.folders, async () => {
      const timestamp = this.#now()
      const lastOrder = new Map<CardColumn, number | null>()
      const cards: Card[] = []
      for (const { title, description = '', column = 'todo', folder = null, sourceExcerpt = '' } of inputs) {
        if (!lastOrder.has(column)) lastOrder.set(column, await this.#lastOrder(column))
        const order = orderBetween(lastOrder.get(column) ?? null, null)
        lastOrder.set(column, order)
        cards.push({
          id: this.#newId(),
          title,
          description,
          column,
          order,
          folder,
          sourceExcerpt,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncState: 'pending',
        })
      }
      await this.#db.cards.bulkAdd(cards)
      await this.#folders.ensure(cards.map((card) => card.folder))
      return cards
    })
  }

  async update(id: string, changes: CardChanges): Promise<void> {
    await this.#db.transaction('rw', this.#db.cards, this.#db.folders, async () => {
      await this.#modify(id, changes)
      if (changes.folder) await this.#folders.ensure([changes.folder])
    })
  }

  async renameFolder(from: string, to: string): Promise<void> {
    if (!to || from === to) return
    await this.#db.transaction('rw', this.#db.cards, this.#db.folders, async () => {
      const cards = await this.#db.cards.filter((card) => card.folder === from && card.deletedAt === null).toArray()
      for (const card of cards) await this.#modify(card.id, { folder: to })
      await this.#folders.rename(from, to)
    })
  }

  async move(id: string, column: CardColumn, order: number): Promise<void> {
    await this.#modify(id, { column, order })
  }

  async remove(id: string): Promise<void> {
    await this.removeMany([id])
  }

  async removeMany(ids: readonly string[]): Promise<void> {
    await this.#db.transaction('rw', this.#db.cards, async () => {
      for (const current of await this.#db.cards.bulkGet([...ids])) {
        if (!current || current.deletedAt !== null) continue
        const timestamp = this.#nextTimestamp(current)
        await this.#db.cards.update(current.id, {
          deletedAt: timestamp,
          updatedAt: timestamp,
          syncState: 'pending',
        })
      }
    })
  }

  async restore(card: Card): Promise<void> {
    await this.#db.transaction('rw', this.#db.cards, async () => {
      const current = await this.#db.cards.get(card.id)
      const latest = current && current.updatedAt > card.updatedAt ? current : card
      await this.#db.cards.put({
        ...card,
        deletedAt: null,
        updatedAt: this.#nextTimestamp(latest),
        syncState: 'pending',
      })
    })
  }

  async listVisible(): Promise<Card[]> {
    return this.#db.cards.filter((card) => card.deletedAt === null).toArray()
  }

  async #modify(id: string, changes: Partial<Card>): Promise<void> {
    await this.#db.transaction('rw', this.#db.cards, async () => {
      const current = await this.#db.cards.get(id)
      if (!current || current.deletedAt !== null) return
      await this.#db.cards.update(id, {
        ...changes,
        updatedAt: this.#nextTimestamp(current),
        syncState: 'pending',
      })
    })
  }

  async #lastOrder(column: CardColumn): Promise<number | null> {
    const cards = await this.#db.cards
      .where('column')
      .equals(column)
      .filter((card) => card.deletedAt === null)
      .toArray()
    return cards.reduce<number | null>((max, card) => (max === null || card.order > max ? card.order : max), null)
  }

  #nextTimestamp(current: Card): number {
    return Math.max(this.#now(), current.updatedAt + 1)
  }
}

export const cardsRepository = new CardsRepository(defaultDb, Date.now, () => crypto.randomUUID(), foldersRepository)
