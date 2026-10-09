import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { NotesRepository } from '../notes/repository'
import { FakeRemote } from '../test/fakeRemote'
import { QuotaExceededError, RateLimitedError } from './remote'
import { SyncManager } from './SyncManager'

describe('SyncManager', () => {
  let db: BloquinhoDB
  let remote: FakeRemote
  let repository: NotesRepository

  beforeEach(() => {
    db = new BloquinhoDB(`test-${crypto.randomUUID()}`)
    remote = new FakeRemote()
    repository = new NotesRepository(db)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uploads notes created while signed out on first start', async () => {
    const note = await repository.create({ content: 'antes do login' })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    expect(remote.rows.get(note.id)?.note.content).toBe('antes do login')
    expect(manager.getStatus()).toBe('idle')
    manager.stop()
  })

  it('wipes data owned by another account before syncing', async () => {
    await db.setMeta('ownerId', 'user-old')
    await repository.create({ content: 'de outra conta' })
    const manager = new SyncManager(db, remote, 'user-new')
    await manager.start()
    expect(remote.rows.size).toBe(0)
    expect(await db.notes.count()).toBe(0)
    expect(await db.getMeta('ownerId')).toBe('user-new')
    manager.stop()
  })

  it('pushes new notes after a short debounce without pulling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    let pulls = 0
    let pushes = 0
    const pull = remote.pull.bind(remote)
    const push = remote.push.bind(remote)
    remote.pull = async (since) => {
      pulls += 1
      return pull(since)
    }
    remote.push = async (notes) => {
      pushes += 1
      return push(notes)
    }
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    const first = await repository.create({ content: 'primeira' })
    await vi.advanceTimersByTimeAsync(1_000)
    const second = await repository.create({ content: 'segunda' })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(remote.rows.has(first.id)).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('idle'))
    expect(remote.rows.has(first.id)).toBe(true)
    expect(remote.rows.has(second.id)).toBe(true)
    expect(pushes).toBe(1)
    expect(pulls).toBe(1)
    manager.stop()
  })

  it('syncs note edits at most once every five minutes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    let pulls = 0
    const pull = remote.pull.bind(remote)
    remote.pull = async (since) => {
      pulls += 1
      return pull(since)
    }
    const note = await repository.create({ content: 'original' })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    await repository.update(note.id, { content: 'editada' })
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(pulls).toBe(1)
    expect(remote.rows.get(note.id)?.note.content).toBe('original')
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('idle'))
    expect(pulls).toBe(2)
    expect(remote.rows.get(note.id)?.note.content).toBe('editada')
    manager.stop()
  })

  it('reports pending changes until they are pushed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    expect(manager.getStatus()).toBe('idle')
    await repository.create({ content: 'nova' })
    await vi.waitFor(() => expect(manager.getStatus()).toBe('pending'))
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('idle'))
    manager.stop()
  })

  it('allows the first manual sync right away and then once a minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    let pulls = 0
    const pull = remote.pull.bind(remote)
    remote.pull = async (since) => {
      pulls += 1
      return pull(since)
    }
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    const first = await repository.create({ content: 'primeira' })
    await manager.syncManually()
    expect(pulls).toBe(2)
    expect(remote.rows.has(first.id)).toBe(true)
    expect(manager.getStatus()).toBe('idle')
    const second = await repository.create({ content: 'segunda' })
    await manager.syncManually()
    expect(pulls).toBe(2)
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('idle'))
    await manager.syncManually()
    expect(pulls).toBe(3)
    expect(remote.rows.has(second.id)).toBe(true)
    manager.stop()
  })

  it('reports errors and notifies subscribers', async () => {
    remote.pull = async () => {
      throw new Error('boom')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const manager = new SyncManager(db, remote, 'user-1')
    const listener = vi.fn()
    manager.subscribe(listener)
    await manager.start()
    expect(manager.getStatus()).toBe('error')
    expect(listener).toHaveBeenCalled()
    manager.stop()
  })

  it('stops retrying when the account is over quota', async () => {
    await repository.create({ content: 'grande demais' })
    let pushes = 0
    remote.push = async () => {
      pushes += 1
      throw new QuotaExceededError()
    }
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    await vi.advanceTimersByTimeAsync(30 * 60_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('quotaExceeded'))
    expect(pushes).toBeLessThanOrEqual(2)
    manager.stop()
  })

  it('waits at least a minute before retrying when rate limited', async () => {
    let pulls = 0
    remote.pull = async () => {
      pulls += 1
      throw new RateLimitedError()
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    await vi.advanceTimersByTimeAsync(59_000)
    expect(pulls).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(pulls).toBe(2)
    manager.stop()
  })
})
