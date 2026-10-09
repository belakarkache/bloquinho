import { useState } from 'react'

export function useCardElevation(armed: boolean) {
  const [lifted, setLifted] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [returning, setReturning] = useState(false)

  const raised = lifted || armed
  const layer = raised ? 'z-30 cursor-grabbing' : hovered || returning ? 'z-10' : 'focus-within:z-10'

  return {
    raised,
    layer,
    handlers: {
      onHoverStart: () => {
        setHovered(true)
        setReturning(false)
      },
      onHoverEnd: () => {
        setHovered(false)
        setReturning(true)
      },
      onAnimationComplete: () => {
        if (!hovered) setReturning(false)
      },
    },
    lift: () => setLifted(true),
    land: () => setLifted(false),
  }
}
