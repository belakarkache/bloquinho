import { motion } from 'motion/react'
import { bouncy } from '../components/motion'

export function KanbaninhoLogo({ className = 'size-9' }: { className?: string }) {
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
      <rect x="6" y="4" width="36" height="38" rx="6" fill="var(--accent)" />
      <rect x="11" y="10" width="7" height="9" rx="2" fill="#0b0c0e" />
      <rect x="11" y="22" width="7" height="6" rx="2" fill="#0b0c0e" />
      <rect x="20.5" y="10" width="7" height="13" rx="2" fill="#0b0c0e" />
      <rect x="30" y="10" width="7" height="6" rx="2" fill="#9fc41a" stroke="#0b0c0e" strokeWidth="2" />
    </motion.svg>
  )
}
