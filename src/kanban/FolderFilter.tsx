import { SquaresFourIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { snappy } from '../components/motion'
import { folderColorOf, type FolderColors } from './folders'
import type { FolderColor } from './types'

interface FolderFilterProps {
  folders: string[]
  colors: FolderColors
  value: string | null
  onChange: (folder: string | null) => void
}

function SelectedHalo() {
  return (
    <motion.span
      layoutId="folder-filter-halo"
      transition={snappy}
      className="absolute inset-0 rounded-full border-2 border-ink bg-surface shadow-[0_6px_16px_-8px_rgb(var(--shadow-ink)/0.5)]"
    />
  )
}

function FolderOption({
  selected,
  color,
  label,
  onSelect,
}: {
  selected: boolean
  color?: FolderColor
  label: string
  onSelect: () => void
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      whileTap={{ scale: 0.92 }}
      transition={snappy}
      className={`relative flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${selected ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
    >
      {selected && <SelectedHalo />}
      {color ? (
        <span
          data-color={color}
          className={`note-swatch relative size-3.5 shrink-0 rounded-full border-2 transition-transform duration-200 ${selected ? 'scale-115 border-ink/40' : 'border-ink/15'}`}
        />
      ) : (
        <SquaresFourIcon size={18} weight={selected ? 'fill' : 'bold'} className="relative shrink-0" />
      )}
      <span className="relative max-w-40 truncate">{label}</span>
    </motion.button>
  )
}

export function FolderFilter({ folders, colors, value, onChange }: FolderFilterProps) {
  const { t } = useTranslation()

  if (folders.length === 0) return null

  return (
    <div className="-mx-4 -mt-2 mb-2 overflow-x-auto px-4 py-2 scrollbar-none">
      <div role="radiogroup" aria-label={t('kanban.folders')} className="mx-auto flex w-max items-center gap-1">
        <FolderOption
          selected={value === null}
          label={t('kanban.allFolders')}
          onSelect={() => onChange(null)}
        />
        {folders.map((folder) => (
          <FolderOption
            key={folder}
            selected={value === folder}
            color={folderColorOf(colors, folder)}
            label={folder}
            onSelect={() => onChange(value === folder ? null : folder)}
          />
        ))}
      </div>
    </div>
  )
}
