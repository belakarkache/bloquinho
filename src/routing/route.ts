import { useSyncExternalStore } from 'react'

export type Route = 'notes' | 'kanbaninho'

const PATHS: Record<Route, string> = {
  notes: '/',
  kanbaninho: '/kanbaninho',
}

const listeners = new Set<() => void>()

export function routeFromPath(pathname: string): Route {
  return pathname.replace(/\/+$/, '') === PATHS.kanbaninho ? 'kanbaninho' : 'notes'
}

function currentRoute(): Route {
  return routeFromPath(location.pathname)
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('popstate', notify)
  }
}

export function navigate(route: Route): void {
  if (currentRoute() === route) return
  history.pushState(null, '', PATHS[route])
  notify()
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute, () => 'notes')
}
