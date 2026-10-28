import { useEffect, useRef, type PointerEvent } from 'react'
import { onRelease, openMenuAt, releasedInPlace, waitForHold } from './longPress'

const BACKGROUND_PRESS_MS = 500
const INTERACTIVE = 'a, button, input, textarea, select, label, dialog, [contenteditable], [role="menu"], [data-measure-id]'

function hasSelection(): boolean {
  return window.getSelection()?.isCollapsed === false
}

export function useBackgroundMenu() {
  const cancelPress = useRef<(() => void) | null>(null)

  useEffect(() => () => cancelPress.current?.(), [])

  return (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    if ((event.target as Element).closest(INTERACTIVE)) return
    const origin = event.nativeEvent
    const hold = () => {
      navigator.vibrate?.(10)
      onRelease((release) => {
        if (releasedInPlace(release, origin) && !hasSelection()) openMenuAt(origin, release)
      })
    }
    cancelPress.current?.()
    cancelPress.current = waitForHold(origin, BACKGROUND_PRESS_MS, hold, () => {
      cancelPress.current = null
    })
  }
}
