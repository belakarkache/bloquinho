import { useMemo, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { codeLineStates } from '../notes/lineEditing'
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
}

export function LineEditor({ editor }: LineEditorProps) {
  const { t } = useTranslation()
  const { lines } = editor
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
          unlink,
        },
      ),
    )
  }

  return (
    <div className="flex min-h-56 flex-1 flex-col overflow-y-auto px-6 pt-6 pb-3 text-[17px] leading-relaxed sm:px-8 sm:pt-8">
      {lines.map((line, index) => (
        <div key={line.id} className="flex items-start gap-2.5">
          {line.checked !== null && (
            <ChecklistBox
              checked={line.checked}
              label={line.text || t('note.emptyItem')}
              onToggle={() => editor.toggleChecked(index)}
            />
          )}
          <div
            className={`grid min-w-0 flex-1 ${line.checked === null ? lineStyle(line.text, insideCode[index]) : ''}`}
          >
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
              onFocus={() => editor.setActiveLine(line.id)}
              onContextMenu={(event) => openLineMenu(index, event)}
              {...linkClick}
              placeholder={showPlaceholder ? t('note.editPlaceholder') : undefined}
              aria-label={line.checked === null ? t('note.editPlaceholder') : t('note.item')}
              className="field-sizing-content block w-full min-w-0 resize-none overflow-hidden bg-transparent break-words text-transparent caret-ink outline-none [grid-area:1/1] placeholder:text-ink-soft"
            />
          </div>
        </div>
      ))}
      <div aria-hidden="true" onClick={editor.focusEnd} className="min-h-6 flex-1 cursor-text" />
    </div>
  )
}
