import { PushPinIcon, TrashIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { IconButton } from './IconButton'

interface PinButtonProps {
  pinned: boolean
  onToggle: () => void
  iconClassName?: string
}

export function PinButton({ pinned, onToggle, iconClassName }: PinButtonProps) {
  const { t } = useTranslation()
  return (
    <IconButton
      icon={PushPinIcon}
      label={pinned ? t('note.unpin') : t('note.pin')}
      aria-pressed={pinned}
      active={pinned}
      iconClassName={iconClassName}
      onClick={onToggle}
    />
  )
}

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <IconButton
      icon={TrashIcon}
      label={t('note.delete')}
      iconClassName="group-hover/icon:animate-wiggle"
      className="hover:bg-danger/12 hover:text-danger"
      onClick={onDelete}
    />
  )
}
