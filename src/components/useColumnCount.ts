import { useSyncExternalStore } from 'react'

const BREAKPOINTS = [
  { query: '(min-width: 1024px)', columns: 4 },
  { query: '(min-width: 720px)', columns: 3 },
]
const BASE_COLUMNS = 2

function readColumns(): number {
  return BREAKPOINTS.find(({ query }) => window.matchMedia(query).matches)?.columns ?? BASE_COLUMNS
}

function subscribe(onChange: () => void): () => void {
  const queries = BREAKPOINTS.map(({ query }) => window.matchMedia(query))
  queries.forEach((query) => query.addEventListener('change', onChange))
  return () => queries.forEach((query) => query.removeEventListener('change', onChange))
}

export function useColumnCount(): number {
  return useSyncExternalStore(subscribe, readColumns, () => BASE_COLUMNS)
}
