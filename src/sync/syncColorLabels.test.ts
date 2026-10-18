import { beforeEach, describe, expect, it } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { ColorLabelsRepository } from '../notes/colorLabels'
import { COLOR_LABEL_MAX_LENGTH } from '../notes/types'
import { FakeRemote } from '../test/fakeRemote'
import { syncColorLabels } from './syncColorLabels'
import { SyncManager } from './SyncManager'

describe('color labels', () => {
  let db: BloquinhoDB
  let remote: FakeRemote
  let now: number
  let repository: ColorLabelsRepository

  beforeEach(() => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    remote = new FakeRemote()
    now = 1_000
    repository = new ColorLabelsRepository(db, () => now)
  })

  it('normalizes names and skips unchanged renames', async () => {
    await repository.rename('lemon', '  Trabalho   urgente ')
    expect(await db.colorLabels.get('lemon')).toMatchObject({ name: 'Trabalho urgente', updatedAt: 1_000 })
    await db.colorLabels.update('lemon', { syncState: 'synced' })
    await repository.rename('lemon', 'Trabalho urgente')
    expect((await db.colorLabels.get('lemon'))?.syncState).toBe('synced')
    await repository.rename('sky', 'x'.repeat(COLOR_LABEL_MAX_LENGTH + 10))
    expect((await db.colorLabels.get('sky'))?.name).toHaveLength(COLOR_LABEL_MAX_LENGTH)
  })

  it('pushes pending labels and marks them synced', async () => {
    await repository.rename('mint', 'Casa')
    await syncColorLabels(db, remote)
    expect(remote.labels.get('mint')).toEqual({ color: 'mint', name: 'Casa', updatedAt: 1_000 })
    expect((await db.colorLabels.get('mint'))?.syncState).toBe('synced')
  })

  it('keeps the newest name on both sides', async () => {
    remote.labels.set('coral', { color: 'coral', name: 'Remoto', updatedAt: 2_000 })
    remote.labels.set('aqua', { color: 'aqua', name: 'Velho', updatedAt: 500 })
    await repository.rename('coral', 'Local antigo')
    await repository.rename('aqua', 'Local novo')
    await syncColorLabels(db, remote)
    expect((await db.colorLabels.get('coral'))?.name).toBe('Remoto')
    expect((await db.colorLabels.get('aqua'))?.name).toBe('Local novo')
    expect(remote.labels.get('aqua')?.name).toBe('Local novo')
  })

  it('keeps a label pending when it changed during the sync', async () => {
    await repository.rename('lime', 'v1')
    const sync = remote.syncColorLabels.bind(remote)
    remote.syncColorLabels = async (labels) => {
      const result = await sync(labels)
      now = 5_000
      await repository.rename('lime', 'v2')
      return result
    }
    await syncColorLabels(db, remote)
    expect(await db.colorLabels.get('lime')).toMatchObject({ name: 'v2', syncState: 'pending' })
  })

  it('syncs labels when the manager starts and pushes renames later', async () => {
    remote.labels.set('sky', { color: 'sky', name: 'Viagens', updatedAt: 100 })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    expect((await db.colorLabels.get('sky'))?.name).toBe('Viagens')
    await repository.rename('lavender', 'Leituras')
    expect(manager.getStatus()).toBe('saving')
    await manager.pushNow()
    expect(remote.labels.get('lavender')?.name).toBe('Leituras')
    expect(manager.getStatus()).toBe('synced')
    manager.stop()
  })

  it('clears labels with the rest of the local data', async () => {
    await repository.rename('lemon', 'Contas')
    await db.clearAll()
    expect(await db.colorLabels.count()).toBe(0)
  })
})
