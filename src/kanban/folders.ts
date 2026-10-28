import { db as defaultDb, type BloquinhoDB } from '../db/database'
import { FOLDER_COLORS, type Folder, type FolderColor } from './types'

export type FolderColors = ReadonlyMap<string, FolderColor>

export function pickFolderColor(used: Iterable<FolderColor>, random: () => number = Math.random): FolderColor {
  const counts = new Map<FolderColor, number>(FOLDER_COLORS.map((color) => [color, 0]))
  for (const color of used) counts.set(color, (counts.get(color) ?? 0) + 1)
  const fewest = Math.min(...counts.values())
  const options = FOLDER_COLORS.filter((color) => counts.get(color) === fewest)
  return options[Math.min(Math.floor(random() * options.length), options.length - 1)]
}

export function hashFolderColor(name: string): FolderColor {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return FOLDER_COLORS[hash % FOLDER_COLORS.length]
}

export function folderColorOf(colors: FolderColors, name: string): FolderColor {
  return colors.get(name) ?? hashFolderColor(name)
}

export function toFolderColors(folders: readonly Folder[]): FolderColors {
  return new Map(folders.map((folder) => [folder.name, folder.color]))
}

export class FoldersRepository {
  readonly #db: BloquinhoDB
  readonly #now: () => number
  readonly #random: () => number

  constructor(database: BloquinhoDB, now: () => number = Date.now, random: () => number = Math.random) {
    this.#db = database
    this.#now = now
    this.#random = random
  }

  async list(): Promise<Folder[]> {
    return this.#db.folders.toArray()
  }

  async setColor(name: string, color: FolderColor): Promise<void> {
    await this.#db.transaction('rw', this.#db.folders, async () => {
      const current = await this.#db.folders.get(name)
      if (current?.color === color) return
      await this.#db.folders.put({
        name,
        color,
        updatedAt: Math.max(this.#now(), (current?.updatedAt ?? 0) + 1),
        syncState: 'pending',
      })
    })
  }

  async rename(from: string, to: string): Promise<void> {
    await this.#db.transaction('rw', this.#db.folders, async () => {
      const current = await this.#db.folders.get(from)
      if (!current) return
      await this.#db.folders.delete(from)
      if (await this.#db.folders.get(to)) return
      await this.#db.folders.put({
        name: to,
        color: current.color,
        updatedAt: Math.max(this.#now(), current.updatedAt + 1),
        syncState: 'pending',
      })
    })
  }

  async ensure(names: Iterable<string | null>): Promise<void> {
    await this.#db.transaction('rw', this.#db.folders, async () => {
      const existing = await this.#db.folders.toArray()
      const known = new Set(existing.map((folder) => folder.name))
      const used = existing.map((folder) => folder.color)
      const added: Folder[] = []
      for (const name of names) {
        if (!name || known.has(name)) continue
        known.add(name)
        const color = pickFolderColor(used, this.#random)
        used.push(color)
        added.push({ name, color, updatedAt: this.#now(), syncState: 'pending' })
      }
      if (added.length > 0) await this.#db.folders.bulkAdd(added)
    })
  }
}

export const foldersRepository = new FoldersRepository(defaultDb)
