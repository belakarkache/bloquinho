import { useDragControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 300
const TOUCH_SLOP = 8

function preventScroll(event: TouchEvent): void {
  event.preventDefault()
}

function lockScrollUntilRelease(onRelease: () => void): void {
  const release = () => {
    window.removeEventListener('touchmove', preventScroll)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    onRelease()
  }
  window.addEventListener('touchmove', preventScroll, { passive: false })
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

export function useCardDrag() {
  const controls = useDragControls()
  const [armed, setArmed] = useState(false)
  const dragged = useRef(false)
  const pressing = useRef(false)
  const cancelPress = useRef<(() => void) | null>(null)

  useEffect(() => () => cancelPress.current?.(), [])

  const waitForLongPress = useCallback(
    (origin: globalThis.PointerEvent) => {
      const cancel = () => {
        clearTimeout(timer)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', cancel)
        window.removeEventListener('pointercancel', cancel)
        cancelPress.current = null
        pressing.current = false
      }
      const onMove = (event: globalThis.PointerEvent) => {
        if (Math.hypot(event.clientX - origin.clientX, event.clientY - origin.clientY) > TOUCH_SLOP) cancel()
      }
      const timer = setTimeout(() => {
        cancel()
        setArmed(true)
        navigator.vibrate?.(10)
        lockScrollUntilRelease(() => setArmed(false))
        controls.start(origin, { distanceThreshold: 0 })
      }, LONG_PRESS_MS)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', cancel)
      window.addEventListener('pointercancel', cancel)
      cancelPress.current = cancel
      pressing.current = true
    },
    [controls],
  )

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    dragged.current = false
    if (event.pointerType !== 'mouse') waitForLongPress(event.nativeEvent)
    else if (event.button === 0) controls.start(event)
  }

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (pressing.current || armed) event.preventDefault()
  }

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!dragged.current) return
    dragged.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const markDragged = () => {
    dragged.current = true
  }

  return { controls, armed, onPointerDown, onContextMenu, onClickCapture, markDragged }
}
