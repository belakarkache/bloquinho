import { useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { fromLines } from '../notes/checklist'
import { formatShortcut, insertLink, toggleInline, type FormatAction } from '../notes/formatting'
import {
  breakLine,
  editorLinesFrom,
  formatLineBlock,
  joinWithNext,
  joinWithPrevious,
  pasteLines,
  toggleLineChecked,
  toggleCodeFence,
  toggleLineKind,
  type EditorLine,
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

export function useLineEditor(initialContent: string) {
  const [lines, setLines] = useState(() => editorLinesFrom(initialContent, newLineId))
  const inputs = useRef(new Map<string, HTMLTextAreaElement>())
  const pendingFocus = useRef<Focus | null>(null)
  const activeLineId = useRef<string | null>(null)
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

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
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

  const onPaste = (index: number, event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text/plain')
    if (!/[\r\n]/.test(pasted)) return
    event.preventDefault()
    applyEdit(pasteLines(lines, index, selectionOf(event.currentTarget), pasted, newLineId))
  }

  const pasteText = (index: number, text: string) => {
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
    if (action === 'heading' || action === 'bullet' || action === 'ordered') {
      return applyEdit(formatLineBlock(lines, index, action, start))
    }
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
    registerInput,
    setText,
    onKeyDown,
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
