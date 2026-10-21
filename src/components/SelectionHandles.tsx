import { useLayoutEffect, useState, type PointerEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { LineEditorState } from './useLineEditor'

type Edge = 'start' | 'end'

interface Caret {
  top: number
  left: number
  height: number
}

const TOOLBAR_CLEARANCE = 56
const KNOB_CLEARANCE = 28

function caretOf(container: HTMLElement, edge: Edge): Caret | null {
  const marker = container.querySelector(`[data-selection-edge="${edge}"]`)
  if (!marker) return null
  const rect = marker.getBoundingClientRect()
  const bounds = container.getBoundingClientRect()
  const lineHeight = Number.parseFloat(getComputedStyle(marker).lineHeight) || rect.height
  return {
    top: rect.top + rect.height / 2 - lineHeight / 2 - bounds.top + container.scrollTop,
    left: rect.left - bounds.left + container.scrollLeft,
    height: lineHeight,
  }
}

function Handle({ edge, caret, editor }: { edge: Edge; caret: Caret; editor: LineEditorState }) {
  return (
    <div
      aria-hidden="true"
      onPointerDown={(event) => editor.onHandlePointerDown(edge, event)}
      style={{ top: caret.top, left: caret.left, height: caret.height }}
      className="absolute z-10 w-0.5 -translate-x-1/2 touch-none bg-ink"
    >
      <span
        className={`absolute left-1/2 size-3.5 -translate-x-1/2 rounded-full bg-ink before:absolute before:-inset-3 before:content-[''] ${edge === 'start' ? 'bottom-full' : 'top-full'}`}
      />
    </div>
  )
}

export function SelectionHandles({
  editor,
  containerRef,
}: {
  editor: LineEditorState
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const [carets, setCarets] = useState<(Record<Edge, Caret> & { roomAbove: boolean }) | null>(null)
  const { touchSelection, selection, lines } = editor

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!touchSelection || !container) {
      setCarets(null)
      return
    }
    const measure = () => {
      const start = caretOf(container, 'start')
      const end = caretOf(container, 'end')
      const roomAbove = start !== null && start.top - container.scrollTop > TOOLBAR_CLEARANCE
      setCarets(start && end ? { start, end, roomAbove } : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, touchSelection, selection, lines])

  if (!carets) return null

  const { roomAbove } = carets
  const toolbarTop = roomAbove ? carets.start.top : carets.end.top + carets.end.height + KNOB_CLEARANCE
  const keepSelection = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const actions = [
    { label: t('contextMenu.cut'), run: editor.cutSelected },
    { label: t('contextMenu.copy'), run: editor.copySelected },
    {
      label: t('contextMenu.paste'),
      run: () => void navigator.clipboard?.readText().then(editor.replaceSelected, () => {}),
    },
    { label: t('contextMenu.selectAll'), run: editor.selectAll },
  ]

  return (
    <>
      <Handle edge="start" caret={carets.start} editor={editor} />
      <Handle edge="end" caret={carets.end} editor={editor} />
      {!editor.draggingHandle && (
        <div
          role="toolbar"
          onPointerDown={keepSelection}
          style={{ top: toolbarTop }}
          className={`absolute left-1/2 z-20 flex -translate-x-1/2 overflow-hidden rounded-full bg-toast text-[13.5px] font-medium whitespace-nowrap text-on-toast shadow-lg ${roomAbove ? '-translate-y-[calc(100%+12px)]' : ''}`}
        >
          {actions.map(({ label, run }) => (
            <button key={label} type="button" onClick={run} className="px-3.5 py-2.5 active:bg-on-toast/15">
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
