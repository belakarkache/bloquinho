import { useEffect, useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'bloquinho:theme'
export const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function savePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    return
  }
}

function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
}

const listeners = new Set<() => void>()
let current: ThemePreference | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function currentPreference(): ThemePreference {
  current ??= readPreference()
  return current
}

function setTheme(next: ThemePreference): void {
  savePreference(next)
  current = next
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, currentPreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    const query = darkQuery()
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  return { preference, setTheme }
}
