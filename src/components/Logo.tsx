import { motion } from 'motion/react'
import { bouncy } from './motion'

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      initial={{ rotate: -6 }}
      whileHover={{ rotate: [-6, 8, -10, -6], scale: 1.08 }}
      transition={bouncy}
    >
      <rect x="7" y="9" width="34" height="34" rx="7" fill="var(--ink)" transform="rotate(8 24 26)" />
      <path d="M6 10a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v18L28 42H12a6 6 0 0 1-6-6z" fill="var(--accent)" />
      <path d="M28 42V33a5 5 0 0 1 5-5h9z" fill="#9fc41a" />
      <path d="M13 15h20M13 21h15M13 27h10" stroke="#0b0c0e" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  )
}
