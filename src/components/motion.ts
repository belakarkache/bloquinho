import type { Transition, Variants } from 'motion/react'

export const snappy: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 }
export const bouncy: Transition = { type: 'spring', stiffness: 380, damping: 18, mass: 0.8 }
export const gentle: Transition = { type: 'spring', stiffness: 260, damping: 28 }
export const reveal: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
export const quickFade: Transition = { duration: 0.16, ease: [0.4, 0, 1, 1] }

export const sheet: Variants = {
  closed: { opacity: 0, transform: 'translateY(8px) scale(0.92)', transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
  open: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
}

export const pressable = {
  whileHover: { scale: 1.06 },
  whileTap: { scale: 0.9 },
  transition: snappy,
}
