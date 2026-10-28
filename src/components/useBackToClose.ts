import { useEffect, useEffectEvent } from 'react'

const closers: (() => void)[] = []
let entries = 0
let traversing = false
let listening = false

function sync(): void {
  if (traversing) return
  while (entries < closers.length) {
    history.pushState({ overlay: true }, '')
    entries += 1
  }
  if (entries > closers.length) {
    traversing = true
    entries -= 1
    history.back()
  }
}

function onPopState(): void {
  if (traversing) traversing = false
  else if (entries > 0) {
    entries -= 1
    closers.pop()?.()
  }
  sync()
}

export function useBackToClose(active: boolean, onClose: () => void): void {
  const close = useEffectEvent(onClose)

  useEffect(() => {
    if (!active) return
    const closer = () => close()
    closers.push(closer)
    if (!listening) {
      window.addEventListener('popstate', onPopState)
      listening = true
    }
    sync()
    return () => {
      const index = closers.indexOf(closer)
      if (index !== -1) closers.splice(index, 1)
      sync()
    }
  }, [active])
}
