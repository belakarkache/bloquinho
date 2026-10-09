import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { toggleChecklist, type TextEdit } from '../notes/checklist'
import { continueList, formatShortcut, formatText, type FormatAction } from '../notes/formatting'
import { NOTE_MAX_LENGTH } from '../notes/types'
import { insertTranscript } from '../voice/transcript'

export function useChecklistTextarea(content: string, setContent: (content: string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<TextEdit | null>(null)

  useLayoutEffect(() => {
    const edit = pendingSelection.current
    if (!edit || edit.content !== content) return
    pendingSelection.current = null
    textareaRef.current?.setSelectionRange(edit.selectionStart, edit.selectionEnd)
  }, [content])

  const apply = (edit: TextEdit | null): boolean => {
    if (!edit || edit.content.length > NOTE_MAX_LENGTH) return false
    pendingSelection.current = edit
    setContent(edit.content)
    return true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    const { selectionStart, selectionEnd } = event.currentTarget
    const shortcut = formatShortcut(event)
    if (shortcut) {
      event.preventDefault()
      apply(formatText(content, selectionStart, selectionEnd, shortcut))
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    if (selectionStart !== selectionEnd) return
    if (apply(continueList(content, selectionStart))) event.preventDefault()
  }

  const format = (action: FormatAction) => {
    const textarea = textareaRef.current
    if (!textarea) return
    apply(formatText(content, textarea.selectionStart, textarea.selectionEnd, action))
    textarea.focus()
  }

  const toggle = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    apply(toggleChecklist(content, textarea.selectionStart, textarea.selectionEnd))
    textarea.focus()
  }

  const insertSpoken = (transcript: string): boolean => {
    const textarea = textareaRef.current
    const focused = textarea !== null && document.activeElement === textarea
    const selection = focused
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : { start: content.length, end: content.length }
    const insertion = insertTranscript(content, selection, transcript)
    if (!insertion) return true
    return apply({ content: insertion.content, selectionStart: insertion.caret, selectionEnd: insertion.caret })
  }

  return { textareaRef, onKeyDown, toggleChecklist: toggle, format, insertTranscript: insertSpoken }
}
