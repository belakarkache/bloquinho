import { useMemo, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { codeLineStates, lineSpan, type LineSpan } from '../notes/lineEditing'
import { unlinkInline, unlinkInLine } from '../notes/links'
import { ChecklistBox } from './ChecklistBox'
import { useContextMenu } from './contextMenu'
import { richTextGroups } from './contextMenuEntries'
import { lineStyle } from './lineStyle'
import { HighlightedInline, HighlightedLine } from './MarkdownHighlight'
import { linkIndexIn, useOverlayLinkClick } from './overlayLinks'
import type { LineEditorState } from './useLineEditor'

interface LineEditorProps {
  editor: LineEditorState
  className?: string
}

function SelectionLayer({ text, span }: { text: string; span: LineSpan }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none break-words whitespace-pre-wrap text-transparent [grid-area:1/1]"
    >
      {text.slice(0, span.from)}
      <span className="bg-selection">{text.slice(span.from, span.to)}</span>
      {span.lineBreak && <span className="inline-block h-[1lh] w-[0.4em] bg-selection align-top" />}
    </div>
  )
}

export function LineEditor({ editor, className = 'px-6 pt-6 sm:px-8 sm:pt-8' }: LineEditorProps) {
  const { t } = useTranslation()
  const { lines, selection } = editor
  const showPlaceholder = lines.length === 1 && lines[0].text === ''
  const insideCode = useMemo(() => codeLineStates(lines), [lines])
  const openMenu = useContextMenu()
  const linkClick = useOverlayLinkClick()

  const openLineMenu = (index: number, event: MouseEvent<HTMLTextAreaElement>) => {
    const field = event.currentTarget
    const line = lines[index]
    const unlink = (link: HTMLElement) => {
      const linkIndex = linkIndexIn(field.previousElementSibling ?? field, link)
      editor.setText(
        index,
        line.checked === null ? unlinkInLine(line.text, linkIndex) : unlinkInline(line.text, linkIndex),
      )
    }
    openMenu(
      event,
      richTextGroups(
        t,
        field,
        { x: event.clientX, y: event.clientY },
        {
          format: editor.format,
          toggleChecklist: editor.toggleActiveLine,
          paste: (text) => editor.pasteText(index, text),
          selectAll: editor.selectAll,
          hasSelection: selection !== null,
          unlink,
        },
      ),
    )
  }

  return (
    <div
      onPointerDown={(event) => {
        if (event.button === 0 && selection) editor.clearSelection()
      }}
      onCopy={editor.copyDocumentSelection}
      className={`scrollbar-none flex min-h-56 flex-1 flex-col overflow-y-auto pb-3 text-[17px] leading-relaxed ${className}`}
    >
      {lines.map((line, index) => {
        const span = selection && lineSpan(selection, index, line.text.length)
        return (
          <div key={line.id} className="flex items-start gap-2.5">
            {line.checked !== null && (
              <ChecklistBox
                checked={line.checked}
                label={line.text || t('note.emptyItem')}
                onToggle={() => editor.toggleChecked(index)}
              />
            )}
            <div
              className={`grid min-w-0 flex-1 grid-cols-1 ${line.checked === null ? lineStyle(line.text, insideCode[index]) : ''}`}
            >
              {span && <SelectionLayer text={line.text} span={span} />}
              <div
                aria-hidden="true"
                className={`pointer-events-none break-words whitespace-pre-wrap [grid-area:1/1] ${line.checked ? 'text-ink-faint line-through' : 'text-ink'}`}
              >
                {line.checked === null ? (
                  <HighlightedLine text={line.text} insideCode={insideCode[index]} />
                ) : (
                  <HighlightedInline text={line.text} />
                )}
              </div>
              <textarea
                ref={editor.registerInput(line.id)}
                value={line.text}
                rows={1}
                onChange={(event) => editor.setText(index, event.target.value)}
                onKeyDown={(event) => editor.onKeyDown(index, event)}
                onPaste={(event) => editor.onPaste(index, event)}
                onCopy={editor.copySelection}
                onCut={editor.copySelection}
                onPointerDown={(event) => editor.onPointerDown(index, event)}
                onFocus={() => editor.setActiveLine(line.id)}
                onContextMenu={(event) => openLineMenu(index, event)}
                {...linkClick}
                placeholder={showPlaceholder ? t('note.editPlaceholder') : undefined}
                aria-label={line.checked === null ? t('note.editPlaceholder') : t('note.item')}
                className={`field-sizing-content block w-full min-w-0 resize-none overflow-hidden bg-transparent break-words text-transparent outline-none [grid-area:1/1] placeholder:text-ink-soft ${selection ? 'caret-transparent selection:bg-transparent' : 'caret-ink'}`}
              />
            </div>
          </div>
        )
      })}
      <div aria-hidden="true" onClick={editor.focusEnd} className="min-h-6 flex-1 cursor-text" />
    </div>
  )
}
