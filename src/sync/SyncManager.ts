import { liveQuery } from 'dexie'
import type { BloquinhoDB } from '../db/database'
import type { Note } from '../notes/types'
import { QuotaExceededError, RateLimitedError, type NotesRemote } from './remote'
import { pullChanges, pushPending } from './syncNotes'

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'error' | 'quotaExceeded'

const OWNER_KEY = 'ownerId'
const CHANGE_DEBOUNCE_MS = 2_000
const MIN_SYNC_INTERVAL_MS = 5 * 60_000
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 15 * 60_000
const RATE_LIMIT_RETRY_MS = 60_000
const MANUAL_SYNC_COOLDOWN_MS = 60_000

export class SyncManager {
  readonly #db: BloquinhoDB
  readonly #remote: NotesRemote
  readonly #userId: string
  readonly #listeners = new Set<() => void>()
  readonly #cleanups: Array<() => void> = []
  #status: SyncStatus = 'idle'
  #hasPending = false
  #queue: Promise<void> = Promise.resolve()
  #syncTimer: ReturnType<typeof setTimeout> | undefined
  #pushTimer: ReturnType<typeof setTimeout> | undefined
  #retryTimer: ReturnType<typeof setTimeout> | undefined
  #retryDelay = RETRY_BASE_MS
  #lastSyncAt = 0
  #lastManualSyncAt = 0
  #stopped = false
  #generation = 0

  constructor(database: BloquinhoDB, remote: NotesRemote, userId: string) {
    this.#db = database
    this.#remote = remote
    this.#userId = userId
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  getStatus = (): SyncStatus => (this.#status === 'idle' && this.#hasPending ? 'pending' : this.#status)

  manualSyncAvailableAt(): number {
    return this.#lastManualSyncAt + MANUAL_SYNC_COOLDOWN_MS
  }

  syncManually(): Promise<void> {
    if (this.#status === 'syncing' || Date.now() < this.manualSyncAvailableAt()) return Promise.resolve()
    this.#lastManualSyncAt = Date.now()
    return this.syncNow()
  }

  async start(): Promise<void> {
    this.#stopped = false
    const generation = ++this.#generation
    await this.#claimLocalData()
    if (generation !== this.#generation) return

    const pendingCount = liveQuery(() => this.#db.pendingNotes().count())
    const subscription = pendingCount.subscribe((count) => {
      this.#setHasPending(count > 0)
      if (count > 0) this.#scheduleSync()
    })
    this.#cleanups.push(() => subscription.unsubscribe())

    const onNoteCreated = (_id: string, note: Note) => {
      if (note.syncState === 'pending') this.#schedulePush()
    }
    this.#db.notes.hook('creating', onNoteCreated)
    this.#cleanups.push(() => this.#db.notes.hook('creating').unsubscribe(onNoteCreated))

    await this.syncNow()
  }

  stop(): void {
    this.#stopped = true
    this.#generation += 1
    clearTimeout(this.#syncTimer)
    clearTimeout(this.#pushTimer)
    clearTimeout(this.#retryTimer)
    this.#cleanups.splice(0).forEach((cleanup) => cleanup())
  }

  syncNow(): Promise<void> {
    clearTimeout(this.#syncTimer)
    this.#syncTimer = undefined
    return this.#enqueue(async () => {
      this.#lastSyncAt = Date.now()
      await pullChanges(this.#db, this.#remote)
      await this.#push()
    })
  }

  pushNow(): Promise<void> {
    clearTimeout(this.#pushTimer)
    this.#pushTimer = undefined
    return this.#enqueue(() => this.#push())
  }

  async pendingCount(): Promise<number> {
    return this.#db.pendingNotes().count()
  }

  async #claimLocalData(): Promise<void> {
    const owner = await this.#db.getMeta(OWNER_KEY)
    if (owner === this.#userId) return
    if (owner !== null) await this.#db.clearAll()
    await this.#db.setMeta(OWNER_KEY, this.#userId)
  }

  async #push(): Promise<void> {
    await pushPending(this.#db, this.#remote)
    this.#setHasPending((await this.pendingCount()) > 0)
  }

  #schedulePush(): void {
    clearTimeout(this.#pushTimer)
    this.#pushTimer = setTimeout(() => void this.pushNow(), CHANGE_DEBOUNCE_MS)
  }

  #scheduleSync(): void {
    const nextAllowedAt = this.#lastSyncAt + MIN_SYNC_INTERVAL_MS
    if (this.#syncTimer !== undefined && nextAllowedAt > Date.now()) return
    clearTimeout(this.#syncTimer)
    const delay = Math.max(CHANGE_DEBOUNCE_MS, nextAllowedAt - Date.now())
    this.#syncTimer = setTimeout(() => void this.syncNow(), delay)
  }

  #enqueue(task: () => Promise<void>): Promise<void> {
    const run = async () => {
      if (this.#stopped) return
      if (!navigator.onLine) {
        this.#setStatus('offline')
        return
      }
      this.#setStatus('syncing')
      try {
        await task()
        this.#retryDelay = RETRY_BASE_MS
        clearTimeout(this.#retryTimer)
        this.#setStatus('idle')
      } catch (error) {
        this.#handleFailure(error)
      }
    }
    this.#queue = this.#queue.then(run)
    return this.#queue
  }

  #handleFailure(error: unknown): void {
    if (error instanceof QuotaExceededError) {
      this.#setStatus('quotaExceeded')
      return
    }
    console.error('Sync failed', error)
    this.#setStatus('error')
    const delay = error instanceof RateLimitedError ? Math.max(RATE_LIMIT_RETRY_MS, this.#retryDelay) : this.#retryDelay
    this.#retryDelay = Math.min(this.#retryDelay * 2, RETRY_MAX_MS)
    clearTimeout(this.#retryTimer)
    this.#retryTimer = setTimeout(() => void this.syncNow(), delay)
  }

  #setStatus(status: SyncStatus): void {
    if (this.#stopped || this.#status === status) return
    this.#status = status
    this.#notify()
  }

  #setHasPending(hasPending: boolean): void {
    if (this.#stopped || this.#hasPending === hasPending) return
    this.#hasPending = hasPending
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
