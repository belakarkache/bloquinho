import type { Icon, IconWeight } from '@phosphor-icons/react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { bouncy, pressable } from './motion'

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: Icon
  label: string
  active?: boolean
  weight?: IconWeight
  size?: 'md' | 'sm'
  iconClassName?: string
}

const SIZES = {
  md: { button: 'size-11', icon: 20 },
  sm: { button: 'size-9', icon: 18 },
}

export function IconButton({
  icon: IconGlyph,
  label,
  active = false,
  weight = 'bold',
  size = 'md',
  iconClassName = '',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      {...pressable}
      className={`group/icon relative inline-flex shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-ink/8 hover:text-ink ${active ? 'text-ink' : ''} ${SIZES[size].button} ${className}`}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(active)}
          initial={{ scale: 0.4, rotate: -35, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.1 } }}
          transition={bouncy}
          className={`inline-flex ${iconClassName}`}
        >
          <IconGlyph size={SIZES[size].icon} weight={active ? 'fill' : weight} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
