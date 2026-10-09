import type { Note } from './types'

export function applyOrder(notes: Note[], order: readonly string[]): Note[] {
  const rank = new Map(order.map((id, index) => [id, index]))
  const unranked = notes.filter((note) => !rank.has(note.id)).sort((a, b) => b.createdAt - a.createdAt)
  const ranked = notes.filter((note) => rank.has(note.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  return [...unranked, ...ranked]
}

export function moveBetween(ids: readonly string[], id: string, previous: string | null, next: string | null): string[] {
  const rest = ids.filter((other) => other !== id)
  const nextIndex = next === null ? -1 : rest.indexOf(next)
  const previousIndex = previous === null ? -1 : rest.indexOf(previous)
  const index = nextIndex >= 0 ? nextIndex : previousIndex >= 0 ? previousIndex + 1 : 0
  return [...rest.slice(0, index), id, ...rest.slice(index)]
}
