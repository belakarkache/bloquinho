import { EditorView } from '@codemirror/view'

export function editorView(element: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(element.closest<HTMLElement>('.cm-editor') ?? element)
  if (!view) throw new Error('No editor found for element')
  return view
}

export function editorText(element: HTMLElement): string {
  return editorView(element).state.doc.toString()
}

export function selectInEditor(element: HTMLElement, anchor: number, head = anchor): void {
  editorView(element).dispatch({ selection: { anchor, head } })
}
