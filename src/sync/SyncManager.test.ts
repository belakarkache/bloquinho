import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BloquinhoDB } from '../db/database'
import { NotesRepository } from '../notes/repository'
import { FakeRemote } from '../test/fakeRemote'
import { QuotaExceededError, RateLimitedError } from './remote'
import { SyncManager } from './SyncManager'

function countCalls(remote: FakeRemote) {
  const calls = { pulls: 0, pushes: 0 }
  const pull = remote.pull.bind(remote)
  const push = remote.push.bind(remote)
  remote.pull = async (since) => {
    calls.pulls += 1
    return pull(since)
  }
  remote.push = async (notes) => {
    calls.pushes += 1
    return push(notes)
  }
  return calls
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

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
    setVisibility('visible')
  })

  it('uploads notes created while signed out on first start', async () => {
    const note = await repository.create({ content: 'antes do login' })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    expect(remote.rows.get(note.id)?.note.content).toBe('antes do login')
    expect(manager.getStatus()).toBe('synced')
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

  it('saves changes shortly after the user stops typing, without pulling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const calls = countCalls(remote)
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    const note = await repository.create({ content: 'p' })
    await vi.advanceTimersByTimeAsync(1_000)
    await repository.update(note.id, { content: 'primeira' })
    expect(manager.getStatus()).toBe('saving')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(remote.rows.has(note.id)).toBe(false)
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('synced'))
    expect(remote.rows.get(note.id)?.note.content).toBe('primeira')
    expect(calls).toEqual({ pulls: 1, pushes: 1 })
    manager.stop()
  })

  it('saves at least every ten seconds while the user keeps typing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const note = await repository.create({ content: '' })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    for (let second = 1; second <= 10; second += 1) {
      await repository.update(note.id, { content: `${second}` })
      await vi.advanceTimersByTimeAsync(1_000)
    }
    await vi.waitFor(() => expect(remote.rows.get(note.id)?.note.content).toBe('10'))
    manager.stop()
  })

  it('keeps pushes under the server rate limit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const calls = countCalls(remote)
    const note = await repository.create({ content: '' })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    for (let step = 0; step < 30; step += 1) {
      await repository.update(note.id, { content: `${step}` })
      await vi.advanceTimersByTimeAsync(2_000)
    }
    expect(calls.pushes).toBeLessThanOrEqual(16)
    manager.stop()
  })

  it('saves right away when the app goes to the background', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    await vi.advanceTimersByTimeAsync(5_000)
    const note = await repository.create({ content: 'fechando' })
    setVisibility('hidden')
    await vi.waitFor(() => expect(remote.rows.has(note.id)).toBe(true))
    expect(manager.getStatus()).toBe('synced')
    manager.stop()
  })

  it('pulls when the app comes back to the foreground at most once a minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const calls = countCalls(remote)
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.pulls).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    setVisibility('visible')
    await vi.waitFor(() => expect(calls.pulls).toBe(2))
    manager.stop()
  })

  it('warns before closing only while changes are not saved', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    const closing = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(closing()).toBe(false)
    await repository.create({ content: 'nova' })
    expect(closing()).toBe(true)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.waitFor(() => expect(manager.getStatus()).toBe('synced'))
    expect(closing()).toBe(false)
    manager.stop()
  })

  it('syncs when the connection comes back', async () => {
    const manager = new SyncManager(db, remote, 'user-1')
    await manager.start()
    window.dispatchEvent(new Event('offline'))
    expect(manager.getStatus()).toBe('offline')
    const note = await repository.create({ content: 'offline' })
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(remote.rows.has(note.id)).toBe(true))
    expect(manager.getStatus()).toBe('synced')
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
    await vi.waitFor(() => expect(pulls).toBe(2))
    manager.stop()
  })
})
