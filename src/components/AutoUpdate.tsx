import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000

function checkForUpdates(_url: string, registration: ServiceWorkerRegistration | undefined) {
  if (!registration) return
  const check = () => {
    if (navigator.onLine) void registration.update()
  }
  setInterval(check, UPDATE_CHECK_MS)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

export function AutoUpdate({ busy }: { busy: boolean }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: checkForUpdates })

  useEffect(() => {
    if (needRefresh && !busy) void updateServiceWorker(true)
  }, [needRefresh, busy, updateServiceWorker])

  return null
}
