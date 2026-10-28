import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'bloquinho:gemini-key'

const listeners = new Set<() => void>()

export function readGeminiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function saveGeminiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } catch {
    return
  }
  notify()
}

export function clearGeminiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useGeminiKey(): string | null {
  return useSyncExternalStore(subscribe, readGeminiKey, () => null)
}
