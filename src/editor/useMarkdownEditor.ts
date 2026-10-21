import { history, historyKeymap, insertNewline, selectAll, standardKeymap } from '@codemirror/commands'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder, type KeyBinding } from '@codemirror/view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextEdit } from '../notes/checklist'
import { continueList, formatText, toggleList, type FormatAction } from '../notes/formatting'
import { NOTE_MAX_LENGTH } from '../notes/types'
import { insertTranscript as transcriptEdit } from '../voice/transcript'
import { EMPTY_ITEM_PHRASE, markdownDecorations } from './markdownDecorations'

const FORMAT_KEYS: [string, FormatAction][] = [
  ['Mod-b', 'bold'],
  ['Mod-i', 'italic'],
  ['Mod-e', 'code'],
  ['Mod-Shift-x', 'strike'],
]

const editorTheme = EditorView.theme({
  '&': { flex: '1 1 auto', minHeight: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'visible' },
  '.cm-content': { padding: '0', caretColor: 'var(--ink)' },
  '.cm-line': { padding: '0' },
  '.cm-line.md-code': { padding: '0 0.75rem' },
  '.cm-line.md-item': { paddingLeft: '1.75em', textIndent: '-1.75em' },
  '.cm-placeholder': { color: 'var(--ink-soft)' },
})

function changeBetween(previous: string, next: string) {
  const limit = Math.min(previous.length, next.length)
  let start = 0
  while (start < limit && previous[start] === next[start]) start += 1
  let end = 0
  while (end < limit - start && previous[previous.length - 1 - end] === next[next.length - 1 - end]) end += 1
  return { from: start, to: previous.length - end, insert: next.slice(start, next.length - end) }
}

export function applyEdit(view: EditorView, edit: TextEdit | null): boolean {
  if (!edit || edit.content.length > NOTE_MAX_LENGTH) return false
  view.dispatch({
    changes: changeBetween(view.state.doc.toString(), edit.content),
    selection: { anchor: edit.selectionStart, head: edit.selectionEnd },
    scrollIntoView: true,
  })
  return true
}

function formatSelection(view: EditorView, action: FormatAction): boolean {
  const { from, to } = view.state.selection.main
  applyEdit(view, formatText(view.state.doc.toString(), from, to, action))
  return true
}

const continueListOrBreak = (view: EditorView): boolean => {
  const { main } = view.state.selection
  const edit = main.empty ? continueList(view.state.doc.toString(), main.head) : null
  return applyEdit(view, edit) || insertNewline(view)
}

const editingKeymap: KeyBinding[] = [
  { key: 'Enter', run: continueListOrBreak, shift: insertNewline },
  ...FORMAT_KEYS.map(([key, action]) => ({ key, run: (view: EditorView) => formatSelection(view, action) })),
]

const withinLimit = EditorState.transactionFilter.of((transaction) =>
  transaction.docChanged && transaction.newDoc.length > NOTE_MAX_LENGTH ? [] : transaction,
)

function localized(label: string, emptyItem: string): Extension {
  return [
    placeholder(label),
    EditorView.contentAttributes.of({ 'aria-label': label }),
    EditorState.phrases.of({ [EMPTY_ITEM_PHRASE]: emptyItem }),
  ]
}

export function useMarkdownEditor(initialContent: string, label: string) {
  const { t } = useTranslation()
  const emptyItem = t('note.emptyItem')
  const viewRef = useRef<EditorView | null>(null)
  const [initialDoc] = useState(initialContent)
  const [content, setContent] = useState(initialContent)
  const [language] = useState(() => new Compartment())
  const settings = useRef({ label, emptyItem })

  const extensions = useCallback(
    (): Extension => [
      history(),
      keymap.of([...editingKeymap, ...historyKeymap, ...standardKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences' }),
      withinLimit,
      markdownDecorations,
      editorTheme,
      language.of(localized(settings.current.label, settings.current.emptyItem)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) setContent(update.state.doc.toString())
      }),
    ],
    [language],
  )

  const mount = useCallback(
    (parent: HTMLDivElement | null) => {
      if (!parent) return
      const view = new EditorView({
        parent,
        state: EditorState.create({ doc: viewRef.current?.state.doc ?? initialDoc, extensions: extensions() }),
      })
      viewRef.current = view
      return () => {
        view.destroy()
      }
    },
    [extensions, initialDoc],
  )

  useEffect(() => {
    settings.current = { label, emptyItem }
    viewRef.current?.dispatch({ effects: language.reconfigure(localized(label, emptyItem)) })
  }, [language, label, emptyItem])

  const withView = <T>(run: (view: EditorView) => T, fallback: T): T => {
    const view = viewRef.current
    return view ? run(view) : fallback
  }

  const focus = (options?: FocusOptions) =>
    withView((view) => {
      if (options?.preventScroll) view.contentDOM.focus({ preventScroll: true })
      else view.focus()
    }, undefined)

  const focusEnd = () =>
    withView((view) => {
      view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true })
      view.focus()
    }, undefined)

  const refresh = () =>
    withView((view) => {
      view.requestMeasure()
      if (view.hasFocus) view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) })
    }, undefined)

  const format = (action: FormatAction) =>
    withView((view) => {
      formatSelection(view, action)
      view.focus()
    }, undefined)

  const toggleChecklist = () =>
    withView((view) => {
      const { from, to } = view.state.selection.main
      applyEdit(view, toggleList(view.state.doc.toString(), from, to))
      view.focus()
    }, undefined)

  const insertTranscript = (transcript: string): boolean =>
    withView((view) => {
      const doc = view.state.doc.toString()
      const { from, to } = view.hasFocus ? view.state.selection.main : { from: doc.length, to: doc.length }
      const insertion = transcriptEdit(doc, { start: from, end: to }, transcript)
      if (!insertion) return true
      return applyEdit(view, { content: insertion.content, selectionStart: insertion.caret, selectionEnd: insertion.caret })
    }, false)

  const replaceContent = (next: string) =>
    withView((view) => {
      view.dispatch({ changes: changeBetween(view.state.doc.toString(), next) })
    }, undefined)

  const reset = () =>
    withView((view) => {
      view.setState(EditorState.create({ doc: '', extensions: extensions() }))
      setContent('')
    }, undefined)

  const runSelectAll = () => withView((view) => selectAll(view), false)

  const hasSelection = () => withView((view) => !view.state.selection.main.empty, false)

  const insertText = (text: string) =>
    withView((view) => {
      view.dispatch(view.state.replaceSelection(text))
      view.focus()
    }, undefined)

  return {
    content,
    mount,
    view: () => viewRef.current,
    focus,
    focusEnd,
    refresh,
    format,
    toggleChecklist,
    insertTranscript,
    replaceContent,
    reset,
    selectAll: runSelectAll,
    hasSelection,
    insertText,
  }
}

export type MarkdownEditorState = ReturnType<typeof useMarkdownEditor>
