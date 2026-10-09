import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'bloquinho:note-order'
const EMPTY_ORDER: readonly string[] = []
const listeners = new Set<() => void>()

function load(): readonly string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : EMPTY_ORDER
  } catch {
    return EMPTY_ORDER
  }
}

let currentOrder = load()

function notify(): void {
  listeners.forEach((listener) => listener())
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return
  currentOrder = load()
  notify()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function persist(order: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    return
  }
}

export function saveNoteOrder(order: readonly string[]): void {
  currentOrder = order
  persist(order)
  notify()
}

export function useNoteOrder(): readonly string[] {
  return useSyncExternalStore(subscribe, () => currentOrder, () => EMPTY_ORDER)
}

function forget(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function clearNoteOrder(): void {
  currentOrder = EMPTY_ORDER
  forget()
  notify()
}
