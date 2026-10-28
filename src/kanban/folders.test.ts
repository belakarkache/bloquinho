import { beforeEach, describe, expect, it } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { folderColorOf, FoldersRepository, hashFolderColor, pickFolderColor } from './folders'
import { CardsRepository } from './repository'
import { FOLDER_COLORS } from './types'

describe('pickFolderColor', () => {
  it('picks among the least used colors', () => {
    const used = FOLDER_COLORS.filter((color) => color !== 'mint')
    expect(pickFolderColor(used, () => 0.99)).toBe('mint')
  })

  it('never picks the default note color', () => {
    expect(FOLDER_COLORS).not.toContain('default')
    expect(pickFolderColor([], () => 0)).toBe(FOLDER_COLORS[0])
    expect(pickFolderColor([], () => 0.999)).toBe(FOLDER_COLORS.at(-1))
  })
})

describe('folderColorOf', () => {
  it('prefers the stored color and falls back to a stable hash', () => {
    expect(folderColorOf(new Map([['Casa', 'coral']]), 'Casa')).toBe('coral')
    expect(folderColorOf(new Map(), 'Casa')).toBe(hashFolderColor('Casa'))
  })
})

describe('FoldersRepository', () => {
  let db: BloquinhoDB
  let folders: FoldersRepository

  beforeEach(() => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    folders = new FoldersRepository(db, () => 1_000, () => 0)
  })

  it('assigns distinct colors to new folders and keeps existing ones', async () => {
    await folders.setColor('Casa', FOLDER_COLORS[0])
    await folders.ensure(['Casa', 'Trabalho', null, 'Trabalho'])
    const stored = await folders.list()
    expect(stored).toHaveLength(2)
    expect(stored.find((folder) => folder.name === 'Casa')?.color).toBe(FOLDER_COLORS[0])
    expect(stored.find((folder) => folder.name === 'Trabalho')?.color).toBe(FOLDER_COLORS[1])
  })

  it('assigns colors when cards create or move into a folder', async () => {
    const cards = new CardsRepository(db, () => 1_000, () => crypto.randomUUID(), folders)
    const card = await cards.create({ title: 'Lavar louça', folder: 'Casa' })
    await cards.update(card.id, { folder: 'Mercado' })
    expect((await folders.list()).map((folder) => folder.name).sort()).toEqual(['Casa', 'Mercado'])
  })

  it('renames a folder on its cards and carries its color', async () => {
    const cards = new CardsRepository(db, () => 1_000, () => crypto.randomUUID(), folders)
    await cards.createMany([
      { title: 'Lavar louça', folder: 'Casa' },
      { title: 'Varrer', folder: 'Casa' },
      { title: 'Relatório', folder: 'Trabalho' },
    ])
    await folders.setColor('Casa', 'coral')
    await cards.renameFolder('Casa', 'Lar')
    const visible = await cards.listVisible()
    expect(visible.filter((card) => card.folder === 'Lar')).toHaveLength(2)
    expect(visible.every((card) => card.syncState === 'pending')).toBe(true)
    expect(await db.folders.get('Casa')).toBeUndefined()
    expect((await db.folders.get('Lar'))?.color).toBe('coral')
  })

  it('merges into an existing folder keeping its color', async () => {
    const cards = new CardsRepository(db, () => 1_000, () => crypto.randomUUID(), folders)
    await cards.createMany([
      { title: 'a', folder: 'Casa' },
      { title: 'b', folder: 'Lar' },
    ])
    await folders.setColor('Lar', 'mint')
    await cards.renameFolder('Casa', 'Lar')
    expect((await cards.listVisible()).map((card) => card.folder)).toEqual(['Lar', 'Lar'])
    expect((await folders.list()).map((folder) => [folder.name, folder.color])).toEqual([['Lar', 'mint']])
  })
})
