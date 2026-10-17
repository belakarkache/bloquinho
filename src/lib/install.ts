import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'macSafari' | 'unsupported'

interface InstallState {
  installed: boolean
  canPrompt: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let state: InstallState = { installed: isStandalone(), canPrompt: false }
const listeners = new Set<() => void>()

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  setState({ canPrompt: true })
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  setState({ installed: true, canPrompt: false })
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, () => state)
}

export async function promptInstall() {
  const event = deferredPrompt
  if (!event) return false
  deferredPrompt = null
  setState({ canPrompt: false })
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

export function detectPlatform(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  if (/Firefox\//.test(userAgent)) return 'unsupported'
  if (/Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent)) return 'macSafari'
  return 'desktop'
}
