import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { toNoteColor } from '../notes/types'
import { BloquinhoDB } from './database'

describe('toNoteColor', () => {
  it('keeps current colors and maps legacy ones', () => {
    expect(toNoteColor('mint')).toBe('mint')
    expect(toNoteColor('blue')).toBe('sky')
    expect(toNoteColor('orange')).toBe('lemon')
    expect(toNoteColor('unknown')).toBe('default')
    expect(toNoteColor(undefined)).toBe('default')
  })
})

describe('BloquinhoDB upgrade', () => {
  it('renames legacy note colors from version 1', async () => {
    const name = `test-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({ notes: 'id, updatedAt, syncState', meta: 'key' })
    await legacy.table('notes').bulkAdd([
      { id: 'a', color: 'pink', updatedAt: 1, syncState: 'synced' },
      { id: 'b', color: 'default', updatedAt: 2, syncState: 'pending' },
    ])
    legacy.close()

    const db = new BloquinhoDB(name)
    expect((await db.notes.get('a'))?.color).toBe('bubblegum')
    expect(await db.notes.get('b')).toMatchObject({ color: 'default', syncState: 'pending' })
  })
})
