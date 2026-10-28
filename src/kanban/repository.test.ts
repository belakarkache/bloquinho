import { beforeEach, describe, expect, it } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { CardsRepository } from './repository'

describe('CardsRepository', () => {
  let db: BloquinhoDB
  let now: number
  let repository: CardsRepository

  beforeEach(async () => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    now = 1_000
    repository = new CardsRepository(db, () => now)
  })

  it('creates pending cards in the todo column by default', async () => {
    const card = await repository.create({ title: 'Comprar pão' })
    expect(await db.cards.get(card.id)).toMatchObject({
      title: 'Comprar pão',
      description: '',
      column: 'todo',
      order: 1_024,
      folder: null,
      sourceExcerpt: '',
      createdAt: 1_000,
      updatedAt: 1_000,
      deletedAt: null,
      syncState: 'pending',
    })
  })

  it('appends new cards after the last one of each column', async () => {
    await repository.create({ title: 'a' })
    const cards = await repository.createMany([
      { title: 'b', folder: 'Casa', sourceExcerpt: '- b' },
      { title: 'c', column: 'doing' },
      { title: 'd' },
    ])
    expect(cards.map(({ title, column, order }) => ({ title, column, order }))).toEqual([
      { title: 'b', column: 'todo', order: 2_048 },
      { title: 'c', column: 'doing', order: 1_024 },
      { title: 'd', column: 'todo', order: 3_072 },
    ])
    expect(cards[0]).toMatchObject({ folder: 'Casa', sourceExcerpt: '- b' })
  })

  it('updates and moves cards bumping updatedAt even when the clock does not move', async () => {
    const card = await repository.create({ title: 'oi' })
    await db.cards.update(card.id, { syncState: 'synced' })
    await repository.update(card.id, { title: 'olá', description: 'detalhe' })
    await repository.move(card.id, 'done', 512)
    expect(await db.cards.get(card.id)).toMatchObject({
      title: 'olá',
      description: 'detalhe',
      column: 'done',
      order: 512,
      updatedAt: 1_002,
      syncState: 'pending',
    })
  })

  it('soft deletes and hides cards', async () => {
    const card = await repository.create({ title: 'apagar' })
    now = 2_000
    await repository.remove(card.id)
    expect(await db.cards.get(card.id)).toMatchObject({ deletedAt: 2_000, updatedAt: 2_000 })
    expect(await repository.listVisible()).toEqual([])
    await repository.update(card.id, { title: 'ignorado' })
    expect((await db.cards.get(card.id))?.title).toBe('apagar')
  })

  it('soft deletes many cards at once and skips missing ids', async () => {
    const [first, second, kept] = await repository.createMany([{ title: 'a' }, { title: 'b' }, { title: 'c' }])
    await repository.removeMany([first.id, second.id, 'missing'])
    expect((await repository.listVisible()).map((card) => card.id)).toEqual([kept.id])
  })

  it('restores a deleted card even after its tombstone was purged', async () => {
    const card = await repository.create({ title: 'voltar' })
    await repository.remove(card.id)
    await db.cards.delete(card.id)
    await repository.restore(card)
    const [restored] = await repository.listVisible()
    expect(restored).toMatchObject({ id: card.id, title: 'voltar', deletedAt: null, syncState: 'pending' })
    expect(restored.updatedAt).toBeGreaterThan(card.updatedAt)
  })
})
