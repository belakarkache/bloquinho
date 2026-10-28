import { Annotation, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { checkedLastOrder } from '../notes/checklist'
import { EMPTY_ITEM_PHRASE, markdownDecorations } from './markdownDecorations'
import { changeBetween, editorTheme } from './useMarkdownEditor'

const syncing = Annotation.define<boolean>()

export interface SourcePosition {
  line: number
  column: number
}

function sorted(content: string) {
  const lines = content.split('\n')
  const order = checkedLastOrder(content)
  return { doc: order.map((line) => lines[line]).join('\n'), order }
}

export function useChecklistPreview(content: string, onToggleItem: (line: number) => void) {
  const { t } = useTranslation()
  const emptyItem = t('note.emptyItem')
  const viewRef = useRef<EditorView | null>(null)
  const orderRef = useRef<number[]>([])
  const contentRef = useRef(content)
  const toggleRef = useRef(onToggleItem)

  useEffect(() => {
    toggleRef.current = onToggleItem
  }, [onToggleItem])

  const mount = useCallback(
    (parent: HTMLDivElement | null) => {
      if (!parent) return
      const { doc, order } = sorted(contentRef.current)
      orderRef.current = order
      const toggleInstead = EditorState.transactionFilter.of((transaction) => {
        if (!transaction.docChanged || transaction.annotation(syncing)) return transaction
        transaction.changes.iterChangedRanges((from) => {
          const line = orderRef.current[transaction.startState.doc.lineAt(from).number - 1]
          queueMicrotask(() => toggleRef.current(line))
        })
        return []
      })
      const view = new EditorView({
        parent,
        state: EditorState.create({
          doc,
          extensions: [
            EditorView.lineWrapping,
            EditorView.editable.of(false),
            EditorState.readOnly.of(true),
            EditorState.phrases.of({ [EMPTY_ITEM_PHRASE]: emptyItem }),
            toggleInstead,
            markdownDecorations,
            editorTheme,
          ],
        }),
      })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
    },
    [emptyItem],
  )

  useEffect(() => {
    contentRef.current = content
    const view = viewRef.current
    if (!view) return
    const { doc, order } = sorted(content)
    orderRef.current = order
    view.dispatch({ changes: changeBetween(view.state.doc.toString(), doc), annotations: syncing.of(true) })
  }, [content])

  const sourcePosition = (x: number, y: number): SourcePosition | null => {
    const view = viewRef.current
    const position = view?.posAtCoords({ x, y })
    if (!view || position == null) return null
    const line = view.state.doc.lineAt(position)
    return { line: orderRef.current[line.number - 1], column: position - line.from }
  }

  return { mount, sourcePosition }
}
