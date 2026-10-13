import type { BloquinhoDB } from '../db/database'
import type { Note } from '../notes/types'
import { QuotaExceededError, RateLimitedError, type NotesRemote } from './remote'
import { pullChanges, pushPending } from './syncNotes'

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error' | 'quotaExceeded'

const OWNER_KEY = 'ownerId'
const PUSH_DEBOUNCE_MS = 1_500
const PUSH_MAX_WAIT_MS = 10_000
const MIN_PUSH_GAP_MS = 4_000
const MIN_PULL_GAP_MS = 60_000
const RETRY_BASE_MS = 15_000
const RETRY_MAX_MS = 5 * 60_000
const RATE_LIMIT_RETRY_MS = 60_000

export class SyncManager {
  readonly #db: BloquinhoDB
  readonly #remote: NotesRemote
  readonly #userId: string
  readonly #listeners = new Set<() => void>()
  readonly #cleanups: Array<() => void> = []
  #status: SyncStatus = 'saving'
  #hasPending = false
  #queue: Promise<void> = Promise.resolve()
  #pushTimer: ReturnType<typeof setTimeout> | undefined
  #retryTimer: ReturnType<typeof setTimeout> | undefined
  #retryDelay = RETRY_BASE_MS
  #firstPendingAt: number | null = null
  #lastPushAt = 0
  #lastPullAt = 0
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

  getStatus = (): SyncStatus => (this.#status === 'synced' && this.#hasPending ? 'saving' : this.#status)

  async start(): Promise<void> {
    this.#stopped = false
    const generation = ++this.#generation
    await this.#claimLocalData()
    const pending = await this.pendingCount()
    if (generation !== this.#generation) return

    this.#setHasPending(pending > 0)
    this.#watchLocalChanges()
    this.#watchPageLifecycle()
    await this.syncNow()
  }

  stop(): void {
    this.#stopped = true
    this.#generation += 1
    clearTimeout(this.#pushTimer)
    clearTimeout(this.#retryTimer)
    this.#cleanups.splice(0).forEach((cleanup) => cleanup())
  }

  syncNow(): Promise<void> {
    return this.#run(async () => {
      await this.#pull()
      await this.#push()
    })
  }

  pushNow(): Promise<void> {
    return this.#run(() => this.#push())
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

  #watchLocalChanges(): void {
    const onCreating = (_id: string, note: Note) => {
      if (note.syncState === 'pending') this.#onLocalChange()
    }
    const onUpdating = (changes: Partial<Note>, _id: string, note: Note) => {
      if ((changes.syncState ?? note.syncState) === 'pending') this.#onLocalChange()
    }
    this.#db.notes.hook('creating', onCreating)
    this.#db.notes.hook('updating', onUpdating)
    this.#cleanups.push(() => {
      this.#db.notes.hook('creating').unsubscribe(onCreating)
      this.#db.notes.hook('updating').unsubscribe(onUpdating)
    })
  }

  #watchPageLifecycle(): void {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') this.#flush()
      else if (Date.now() - this.#lastPullAt >= MIN_PULL_GAP_MS) void this.syncNow()
    }
    const onOnline = () => void this.syncNow()
    const onOffline = () => this.#setStatus('offline')
    const onPageHide = () => this.#flush()
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.#hasPending) event.preventDefault()
    }
    const listeners: Array<[EventTarget, string, EventListener]> = [
      [document, 'visibilitychange', onVisibilityChange],
      [window, 'online', onOnline],
      [window, 'offline', onOffline],
      [window, 'pagehide', onPageHide],
      [window, 'beforeunload', onBeforeUnload as EventListener],
    ]
    listeners.forEach(([target, type, listener]) => target.addEventListener(type, listener))
    this.#cleanups.push(() =>
      listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener)),
    )
  }

  #onLocalChange(): void {
    this.#setHasPending(true)
    this.#firstPendingAt ??= Date.now()
    this.#schedulePush()
  }

  #schedulePush(): void {
    const now = Date.now()
    const debounced = now + PUSH_DEBOUNCE_MS
    const deadline = (this.#firstPendingAt ?? now) + PUSH_MAX_WAIT_MS
    const earliest = this.#lastPushAt + MIN_PUSH_GAP_MS
    const runAt = Math.max(Math.min(debounced, deadline), earliest)
    clearTimeout(this.#pushTimer)
    this.#pushTimer = setTimeout(() => void this.pushNow(), runAt - now)
  }

  #flush(): void {
    if (this.#hasPending && this.#status !== 'quotaExceeded') void this.pushNow()
  }

  async #pull(): Promise<void> {
    this.#lastPullAt = Date.now()
    await pullChanges(this.#db, this.#remote)
  }

  async #push(): Promise<void> {
    this.#lastPushAt = Date.now()
    this.#firstPendingAt = null
    await pushPending(this.#db, this.#remote)
    this.#setHasPending((await this.pendingCount()) > 0)
  }

  #run(task: () => Promise<void>): Promise<void> {
    clearTimeout(this.#pushTimer)
    clearTimeout(this.#retryTimer)
    const run = async () => {
      if (this.#stopped) return
      if (!navigator.onLine) {
        this.#setStatus('offline')
        return
      }
      this.#setStatus('saving')
      try {
        await task()
        this.#retryDelay = RETRY_BASE_MS
        this.#setStatus('synced')
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
