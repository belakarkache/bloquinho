import type { FocusEvent, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { linkAt } from '../editor/markdownDecorations'
import type { MarkdownEditorState } from '../editor/useMarkdownEditor'
import { unlinkInContent } from '../notes/links'
import { useContextMenu } from './contextMenu'
import { richTextGroups } from './contextMenuEntries'
import { linkElementAt, useEditorLinkClick } from './editorLinks'

interface MarkdownEditorProps {
  editor: MarkdownEditorState
  className?: string
  onFocus?: (event: FocusEvent<HTMLDivElement>) => void
}

function runClipboardCommand(editor: MarkdownEditorState, command: 'cut' | 'copy') {
  editor.focus()
  document.execCommand(command)
}

export function MarkdownEditor({ editor, className = '', onFocus }: MarkdownEditorProps) {
  const { t } = useTranslation()
  const openMenu = useContextMenu()
  const linkClick = useEditorLinkClick()
  const { mount } = editor

  const linkMenu = (element: HTMLElement | null) => {
    const view = editor.view()
    if (!element || !view) return null
    const found = linkAt(view.state, view.posAtDOM(element))
    if (!found) return null
    const { linkIndex, line } = found
    const unlink =
      linkIndex === undefined
        ? undefined
        : () => editor.replaceContent(unlinkInContent(view.state.doc.toString(), line, linkIndex))
    return { href: found.href, unlink }
  }

  const openTextMenu = (event: MouseEvent<HTMLDivElement>) => {
    openMenu(
      event,
      richTextGroups(t, {
        link: linkMenu(linkElementAt(event.target)),
        clipboard: {
          hasSelection: editor.hasSelection(),
          editable: true,
          cut: () => runClipboardCommand(editor, 'cut'),
          copy: () => runClipboardCommand(editor, 'copy'),
          paste: editor.insertText,
          selectAll: editor.selectAll,
        },
        format: editor.format,
        toggleChecklist: editor.toggleChecklist,
      }),
    )
  }

  return (
    <div
      ref={mount}
      onContextMenu={openTextMenu}
      onFocus={onFocus}
      {...linkClick}
      className={`flex flex-col ${className}`}
    />
  )
}
