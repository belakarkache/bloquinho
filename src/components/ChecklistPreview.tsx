import type { MouseEvent } from 'react'
import { useChecklistPreview, type SourcePosition } from '../editor/useChecklistPreview'

interface ChecklistPreviewProps {
  content: string
  className?: string
  onToggleItem: (line: number) => void
  onEdit: (position: SourcePosition | null) => void
}

export function ChecklistPreview({ content, className = '', onToggleItem, onEdit }: ChecklistPreviewProps) {
  const { mount, sourcePosition } = useChecklistPreview(content, onToggleItem)

  const edit = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('button')) return
    if (!document.getSelection()?.isCollapsed) return
    onEdit(sourcePosition(event.clientX, event.clientY))
  }

  return <div ref={mount} onClick={edit} className={`flex cursor-text flex-col ${className}`} />
}
