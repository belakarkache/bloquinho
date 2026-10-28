import { useDragControls } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { LONG_PRESS_MS, onRelease, openMenuAt, releasedInPlace, waitForHold } from './longPress'

function preventScroll(event: TouchEvent): void {
  event.preventDefault()
}

function lockScrollUntilRelease(callback: (event: globalThis.PointerEvent) => void): void {
  window.addEventListener('touchmove', preventScroll, { passive: false })
  onRelease((event) => {
    window.removeEventListener('touchmove', preventScroll)
    callback(event)
  })
}

export function useCardDrag() {
  const controls = useDragControls()
  const [armed, setArmed] = useState(false)
  const swallowClick = useRef(false)
  const pressing = useRef(false)
  const cancelPress = useRef<(() => void) | null>(null)

  useEffect(() => () => cancelPress.current?.(), [])

  const waitForLongPress = useCallback(
    (origin: globalThis.PointerEvent) => {
      const arm = () => {
        setArmed(true)
        navigator.vibrate?.(10)
        lockScrollUntilRelease((release) => {
          setArmed(false)
          if (!releasedInPlace(release, origin)) return
          swallowClick.current = true
          openMenuAt(origin, release)
        })
        controls.start(origin, { distanceThreshold: 0 })
      }
      const settle = () => {
        cancelPress.current = null
        pressing.current = false
      }
      pressing.current = true
      cancelPress.current = waitForHold(origin, LONG_PRESS_MS, arm, settle)
    },
    [controls],
  )

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    swallowClick.current = false
    if (event.pointerType !== 'mouse') waitForLongPress(event.nativeEvent)
    else if (event.button === 0) controls.start(event)
  }

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (pressing.current || armed) event.preventDefault()
  }

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const markDragged = () => {
    swallowClick.current = true
  }

  return { controls, armed, onPointerDown, onContextMenu, onClickCapture, markDragged }
}
