import { CheckSquareIcon, SquareIcon } from '@phosphor-icons/react'

interface ChecklistBoxProps {
  checked: boolean
  label: string
  onToggle: () => void
  className?: string
}

export function ChecklistBox({ checked, label, onToggle, className = '' }: ChecklistBoxProps) {
  const Box = checked ? CheckSquareIcon : SquareIcon
  return (
    <span className="flex h-[1.625em] shrink-0 items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={`-m-1 inline-flex rounded-md p-1 text-ink-soft transition-colors hover:text-ink ${className}`}
      >
        <Box size={18} weight={checked ? 'fill' : 'bold'} />
      </button>
    </span>
  )
}
