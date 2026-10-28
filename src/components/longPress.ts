export const LONG_PRESS_MS = 300
export const TOUCH_SLOP = 8

function distance(a: PointerEvent, b: PointerEvent): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function waitForHold(origin: PointerEvent, delay: number, onHold: () => void, onSettle: () => void): () => void {
  const cancel = () => {
    clearTimeout(timer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', cancel)
    window.removeEventListener('pointercancel', cancel)
    onSettle()
  }
  const onMove = (event: PointerEvent) => {
    if (distance(event, origin) > TOUCH_SLOP) cancel()
  }
  const timer = setTimeout(() => {
    cancel()
    onHold()
  }, delay)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', cancel)
  window.addEventListener('pointercancel', cancel)
  return cancel
}

export function onRelease(callback: (event: PointerEvent) => void): void {
  const release = (event: PointerEvent) => {
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    callback(event)
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

export function releasedInPlace(release: PointerEvent, origin: PointerEvent): boolean {
  return release.type === 'pointerup' && distance(release, origin) <= TOUCH_SLOP
}

export function openMenuAt(origin: PointerEvent, release: PointerEvent): void {
  const target = origin.target instanceof Element ? origin.target : null
  target?.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: release.clientX, clientY: release.clientY }),
  )
}
