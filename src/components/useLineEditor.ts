import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { fromLines } from '../notes/checklist'
import { formatShortcut, insertLink, toggleInline, type FormatAction } from '../notes/formatting'
import {
  breakLine,
  editorLinesFrom,
  extendSelection,
  isCollapsed,
  orderedRange,
  replaceSelection,
  selectAllLines,
  selectedText,
  formatLineBlock,
  joinWithNext,
  joinWithPrevious,
  pasteLines,
  toggleLineChecked,
  convertListBlock,
  toggleCodeFence,
  toggleLineKind,
  type EditorLine,
  type LinePoint,
  type LineSelection,
  type LinesEdit,
} from '../notes/lineEditing'
import { NOTE_MAX_LENGTH } from '../notes/types'
import { transcriptInsertion } from '../voice/transcript'

type Focus = LinesEdit['focus']

const newLineId = () => crypto.randomUUID()

function isSingleRow(input: HTMLTextAreaElement): boolean {
  const lineHeight = Number.parseFloat(getComputedStyle(input).lineHeight)
  return Number.isNaN(lineHeight) || input.scrollHeight < lineHeight * 1.5
}

function selectionOf(input: HTMLTextAreaElement) {
  return { start: input.selectionStart, end: input.selectionEnd }
}

function anchorOf(input: HTMLTextAreaElement): number {
  return input.selectionDirection === 'backward' ? input.selectionEnd : input.selectionStart
}

function offsetAtPoint(element: Element, x: number, y: number): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let offset = 0
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0
    for (let position = 0; position < length; position++) {
      range.setStart(node, position)
      range.setEnd(node, position + 1)
      const rect = range.getBoundingClientRect()
      const dy = Math.max(rect.top - y, 0, y - rect.bottom)
      const dx = Math.max(rect.left - x, 0, x - rect.right)
      const distance = dy * 10_000 + dx
      if (distance < bestDistance) {
        bestDistance = distance
        best = offset + position + (x > rect.left + rect.width / 2 ? 1 : 0)
      }
    }
    offset += length
  }
  return best
}

function offsetWithin(overlay: Element | null | undefined, node: Node, offset: number, length: number): number {
  if (!overlay) return 0
  const range = document.createRange()
  range.selectNodeContents(overlay)
  const position = range.comparePoint(node, offset)
  if (position !== 0) return position < 0 ? 0 : length
  range.setEnd(node, offset)
  return Math.min(range.toString().length, length)
}

const COLLAPSE_TO_START = new Set(['ArrowUp', 'ArrowLeft', 'Home', 'PageUp'])
const COLLAPSE_TO_END = new Set(['ArrowDown', 'ArrowRight', 'End', 'PageDown'])
const EXTEND_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export function useLineEditor(initialContent: string) {
  const [lines, setLines] = useState(() => editorLinesFrom(initialContent, newLineId))
  const inputs = useRef(new Map<string, HTMLTextAreaElement>())
  const pendingFocus = useRef<Focus | null>(null)
  const activeLineId = useRef<string | null>(null)
  const [selection, setSelection] = useState<LineSelection | null>(null)
  const content = useMemo(() => fromLines(lines), [lines])

  const focusLine = ({ id, caret, end = caret }: Focus) => {
    const input = inputs.current.get(id)
    if (!input) return false
    input.focus()
    input.setSelectionRange(caret, end)
    return true
  }

  useLayoutEffect(() => {
    const focus = pendingFocus.current
    if (focus && focusLine(focus)) pendingFocus.current = null
  }, [lines])

  const commit = (next: EditorLine[], focus: Focus | null = null): boolean => {
    if (fromLines(next).length > NOTE_MAX_LENGTH) return false
    pendingFocus.current = focus
    setSelection(null)
    setLines(next)
    return true
  }

  const applyEdit = (edit: LinesEdit | null): boolean => (edit ? commit(edit.lines, edit.focus) : false)

  const registerInput = (id: string) => (input: HTMLTextAreaElement | null) => {
    if (!input) return
    inputs.current.set(id, input)
    return () => {
      inputs.current.delete(id)
    }
  }

  const setText = (index: number, text: string) => {
    commit(lines.map((line, position) => (position === index ? { ...line, text } : line)))
  }

  const moveTo = (index: number, caret: number) => {
    const line = lines[index]
    return line ? focusLine({ id: line.id, caret: Math.min(caret, line.text.length) }) : false
  }

  const pointFocus = ({ index, offset }: LinePoint): Focus => ({ id: lines[index].id, caret: offset })

  const replaceSelected = (text: string) => selection !== null && applyEdit(replaceSelection(lines, selection, text, newLineId))

  const collapseTo = (point: LinePoint) => {
    setSelection(null)
    focusLine(pointFocus(point))
  }

  const selectAll = () => {
    if (lines.length === 1) {
      inputs.current.get(lines[0].id)?.select()
      return
    }
    setSelection(selectAllLines(lines))
  }

  const startLineSelection = (index: number, event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    const input = event.currentTarget
    const down = event.key === 'ArrowDown'
    const target = lines[down ? index + 1 : index - 1]
    const atEdge = down ? input.selectionEnd === input.value.length : input.selectionStart === 0
    if (!target || !(atEdge || isSingleRow(input))) return false
    const moving = anchorOf(input) === input.selectionStart ? input.selectionEnd : input.selectionStart
    setSelection({
      anchor: { index, offset: anchorOf(input) },
      focus: { index: down ? index + 1 : index - 1, offset: Math.min(moving, target.text.length) },
    })
    return true
  }

  const onSelectionKeyDown = (current: LineSelection, event: KeyboardEvent<HTMLTextAreaElement>) => {
    const { key } = event
    const { start, end } = orderedRange(current)
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const lower = key.toLowerCase()
      if (lower === 'a') selectAll()
      if (['c', 'x', 'v', 's'].includes(lower)) return
    } else if (key === 'Escape') {
      event.stopPropagation()
      collapseTo(current.focus)
    } else if (event.shiftKey && EXTEND_KEYS.has(key)) {
      const next = extendSelection(lines, current, key)
      if (isCollapsed(next)) collapseTo(next.focus)
      else setSelection(next)
    } else if (COLLAPSE_TO_START.has(key)) collapseTo(start)
    else if (COLLAPSE_TO_END.has(key)) collapseTo(end)
    else if (key === 'Backspace' || key === 'Delete') replaceSelected('')
    else if (key === 'Enter') replaceSelected('\n')
    else if (key.length === 1) replaceSelected(key)
    else if (key === 'Dead' || key === 'Process') {
      replaceSelected('')
      return
    } else if (key === 'Tab') {
      setSelection(null)
      return
    } else return
    event.preventDefault()
  }

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (selection) {
      onSelectionKeyDown(selection, event)
      return
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a' && lines.length > 1) {
      event.preventDefault()
      selectAll()
      return
    }
    if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && startLineSelection(index, event)) {
      event.preventDefault()
      return
    }
    const shortcut = formatShortcut(event)
    if (shortcut) {
      event.preventDefault()
      formatLine(index, shortcut, selectionOf(event.currentTarget))
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const input = event.currentTarget
    const { start, end } = selectionOf(input)
    if (event.key === 'Enter') {
      event.preventDefault()
      applyEdit(breakLine(lines, index, { start, end }, newLineId))
      return
    }

    const collapsed = start === end
    let handled = false
    if (event.key === 'Backspace' && collapsed && start === 0) handled = applyEdit(joinWithPrevious(lines, index))
    else if (event.key === 'Delete' && collapsed && end === input.value.length) {
      handled = applyEdit(joinWithNext(lines, index))
    } else if (event.key === 'ArrowUp' && collapsed && (start === 0 || isSingleRow(input))) {
      handled = moveTo(index - 1, start)
    } else if (event.key === 'ArrowDown' && collapsed && (end === input.value.length || isSingleRow(input))) {
      handled = moveTo(index + 1, start)
    }
    if (handled) event.preventDefault()
  }

  const copySelection = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!selection) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', selectedText(lines, selection))
    if (event.type === 'cut') replaceSelected('')
  }

  const documentSelection = (): LineSelection | null => {
    const native = window.getSelection()
    const range = native?.rangeCount ? native.getRangeAt(0) : null
    if (!range || range.collapsed) return null
    const touched = lines.flatMap((line, index) => {
      const row = inputs.current.get(line.id)?.parentElement
      return row && range.intersectsNode(row) ? [index] : []
    })
    if (touched.length === 0) return null
    const first = touched[0]
    const last = touched[touched.length - 1]
    const overlayOf = (index: number) => inputs.current.get(lines[index].id)?.previousElementSibling
    return {
      anchor: {
        index: first,
        offset: offsetWithin(overlayOf(first), range.startContainer, range.startOffset, lines[first].text.length),
      },
      focus: {
        index: last,
        offset: offsetWithin(overlayOf(last), range.endContainer, range.endOffset, lines[last].text.length),
      },
    }
  }

  const copyDocumentSelection = (event: ClipboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.target instanceof HTMLTextAreaElement) return
    const native = documentSelection()
    if (!native) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', selectedText(lines, native))
  }

  const lineAtPoint = (y: number): number => {
    const index = lines.findIndex((line) => {
      const input = inputs.current.get(line.id)
      return input !== undefined && y <= input.getBoundingClientRect().bottom
    })
    return index === -1 ? lines.length - 1 : index
  }

  const offsetInLine = (index: number, x: number, y: number): number => {
    const input = inputs.current.get(lines[index].id)
    const overlay = input?.previousElementSibling
    if (!input || !overlay) return 0
    const bounds = input.getBoundingClientRect()
    if (y < bounds.top) return 0
    if (y > bounds.bottom) return lines[index].text.length
    return Math.min(offsetAtPoint(overlay, x, y), lines[index].text.length)
  }

  const onPointerDown = (index: number, event: PointerEvent<HTMLTextAreaElement>) => {
    if (event.button !== 0 || event.pointerType !== 'mouse' || event.shiftKey) return
    const input = event.currentTarget
    let anchor: LinePoint | null = null
    const move = ({ clientX, clientY }: globalThis.PointerEvent) => {
      const target = lineAtPoint(clientY)
      if (target === index && !anchor) return
      anchor ??= { index, offset: anchorOf(input) }
      setSelection({ anchor, focus: { index: target, offset: offsetInLine(target, clientX, clientY) } })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      setSelection((current) => (current && isCollapsed(current) ? null : current))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const onPaste = (index: number, event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text/plain')
    if (selection) {
      event.preventDefault()
      replaceSelected(pasted)
      return
    }
    if (!/[\r\n]/.test(pasted)) return
    event.preventDefault()
    applyEdit(pasteLines(lines, index, selectionOf(event.currentTarget), pasted, newLineId))
  }

  const pasteText = (index: number, text: string) => {
    if (replaceSelected(text)) return
    const input = inputs.current.get(lines[index].id)
    if (!input) return
    input.focus()
    if (/[\r\n]/.test(text)) applyEdit(pasteLines(lines, index, selectionOf(input), text, newLineId))
    else document.execCommand('insertText', false, text)
  }

  const toggleChecked = (index: number) => {
    commit(toggleLineChecked(lines, index))
  }

  const toggleActiveLine = () => {
    const active = lines.findIndex((line) => line.id === activeLineId.current)
    applyEdit(toggleLineKind(lines, active === -1 ? lines.length - 1 : active))
  }

  const insertTranscript = (transcript: string): boolean => {
    const focusedIndex = lines.findIndex((line) => inputs.current.get(line.id) === document.activeElement)
    const index = focusedIndex === -1 ? lines.length - 1 : focusedIndex
    const line = lines[index]
    const input = inputs.current.get(line.id)
    const selection =
      focusedIndex !== -1 && input ? selectionOf(input) : { start: line.text.length, end: line.text.length }
    const inserted = transcriptInsertion(
      line.text.slice(0, selection.start),
      line.text.slice(selection.end),
      transcript,
    )
    if (inserted === null) return true
    const edit = pasteLines(lines, index, selection, inserted, newLineId)
    const caret = selection.start + inserted.trimEnd().length
    return commit(edit.lines, focusedIndex === -1 ? null : { id: line.id, caret })
  }

  const formatLine = (index: number, action: FormatAction, { start, end }: { start: number; end: number }) => {
    const line = lines[index]
    if (action === 'bullet' || action === 'ordered') {
      return applyEdit(convertListBlock(lines, index, action) ?? formatLineBlock(lines, index, action, start))
    }
    if (action === 'heading') return applyEdit(formatLineBlock(lines, index, action, start))
    if (action === 'codeBlock') return applyEdit(toggleCodeFence(lines, index, start, newLineId))
    const edit = action === 'link' ? insertLink(line.text, start, end) : toggleInline(line.text, start, end, action)
    const next = lines.map((current, position) => (position === index ? { ...current, text: edit.content } : current))
    return commit(next, { id: line.id, caret: edit.selectionStart, end: edit.selectionEnd })
  }

  const format = (action: FormatAction) => {
    const focusedIndex = lines.findIndex((line) => inputs.current.get(line.id) === document.activeElement)
    const activeIndex = lines.findIndex((line) => line.id === activeLineId.current)
    const index = focusedIndex !== -1 ? focusedIndex : activeIndex !== -1 ? activeIndex : lines.length - 1
    const input = inputs.current.get(lines[index].id)
    const caret = lines[index].text.length
    formatLine(index, action, focusedIndex !== -1 && input ? selectionOf(input) : { start: caret, end: caret })
  }

  const focusEnd = () => {
    const last = lines[lines.length - 1]
    focusLine({ id: last.id, caret: last.text.length })
  }

  const setActiveLine = (id: string) => {
    activeLineId.current = id
  }

  return {
    lines,
    content,
    selection,
    clearSelection: () => setSelection(null),
    selectAll,
    registerInput,
    setText,
    onKeyDown,
    onPointerDown,
    copySelection,
    copyDocumentSelection,
    onPaste,
    pasteText,
    toggleChecked,
    toggleActiveLine,
    insertTranscript,
    format,
    focusEnd,
    setActiveLine,
  }
}

export type LineEditorState = ReturnType<typeof useLineEditor>
