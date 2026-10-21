import { ListChecksIcon } from '@phosphor-icons/react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormatAction } from '../notes/formatting'
import { BLOCK_ACTIONS, FORMAT_ICONS, INLINE_ACTIONS } from './formatActions'
import { IconButton } from './IconButton'

const keepFocus = (event: MouseEvent) => event.preventDefault()

interface FormatToolbarProps {
  onFormat: (action: FormatAction) => void
  onToggleChecklist: () => void
  className?: string
}

export function FormatToolbar({ onFormat, onToggleChecklist, className = '' }: FormatToolbarProps) {
  const { t } = useTranslation()
  return (
    <div
      role="toolbar"
      aria-label={t('format.toolbar')}
      className={`flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] ${className}`}
    >
      {[...INLINE_ACTIONS, ...BLOCK_ACTIONS].map((action) => (
        <IconButton
          key={action}
          icon={FORMAT_ICONS[action]}
          size="sm"
          label={t(`format.${action}`)}
          onMouseDown={keepFocus}
          onClick={() => onFormat(action)}
        />
      ))}
      <IconButton
        icon={ListChecksIcon}
        size="sm"
        label={t('note.checklist')}
        onMouseDown={keepFocus}
        onClick={onToggleChecklist}
      />
      <IconButton
        icon={FORMAT_ICONS.clear}
        size="sm"
        label={t('format.clear')}
        onMouseDown={keepFocus}
        onClick={() => onFormat('clear')}
      />
    </div>
  )
}
