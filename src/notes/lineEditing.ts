import { fromLines, parseItem, toLines, type NoteLine } from './checklist'
import { blockBody, blockFormatOf, blockMarker, nextOrderedNumber, type BlockFormat } from './formatting'
import { classifyLine, FENCE_MARKER, fenceStates, isFence, nextListMarker } from './markdown'

export interface EditorLine extends NoteLine {
  id: string
}

export interface LinesEdit {
  lines: EditorLine[]
  focus: { id: string; caret: number; end?: number }
}

export type NewId = () => string

function replaceRange(lines: EditorLine[], start: number, end: number, ...inserted: EditorLine[]): EditorLine[] {
  return [...lines.slice(0, start), ...inserted, ...lines.slice(end)]
}

export function breakLine(
  lines: EditorLine[],
  index: number,
  selection: { start: number; end: number },
  newId: NewId,
): LinesEdit {
  const line = lines[index]
  if (line.checked !== null && line.text === '') {
    return {
      lines: replaceRange(lines, index, index + 1, { ...line, checked: null }),
      focus: { id: line.id, caret: 0 },
    }
  }
  if (line.checked === null && !insideCode(lines, index)) {
    const kind = classifyLine(line.text)
    const next = nextListMarker(kind)
    if (next && selection.start >= kind.marker.length) return continueListLine(lines, index, selection, next, newId)
  }
  return pasteLines(lines, index, selection, '\n', newId)
}

function continueListLine(
  lines: EditorLine[],
  index: number,
  selection: { start: number; end: number },
  next: string,
  newId: NewId,
): LinesEdit {
  const line = lines[index]
  if (!blockBody(line.text).trim()) {
    return { lines: replaceRange(lines, index, index + 1, { ...line, text: '' }), focus: { id: line.id, caret: 0 } }
  }
  const edit = pasteLines(lines, index, selection, `\n${next}`, newId)
  return { ...edit, focus: { id: edit.focus.id, caret: next.length } }
}

function plainText(line: EditorLine): string {
  return line.checked === null ? line.text : ''
}

export function codeLineStates(lines: EditorLine[]): boolean[] {
  return fenceStates(lines.map(plainText))
}

function insideCode(lines: EditorLine[], index: number): boolean {
  return codeLineStates(lines)[index] ?? false
}

export function joinWithPrevious(lines: EditorLine[], index: number): LinesEdit | null {
  const line = lines[index]
  if (line.checked !== null) {
    return {
      lines: replaceRange(lines, index, index + 1, { ...line, checked: null }),
      focus: { id: line.id, caret: 0 },
    }
  }
  if (index === 0) return null
  const previous = lines[index - 1]
  return {
    lines: replaceRange(lines, index - 1, index + 1, { ...previous, text: previous.text + line.text }),
    focus: { id: previous.id, caret: previous.text.length },
  }
}

export function joinWithNext(lines: EditorLine[], index: number): LinesEdit | null {
  if (index >= lines.length - 1) return null
  const line = lines[index]
  const next = lines[index + 1]
  return {
    lines: replaceRange(lines, index, index + 2, { ...line, text: line.text + next.text }),
    focus: { id: line.id, caret: line.text.length },
  }
}

export function pasteLines(
  lines: EditorLine[],
  index: number,
  selection: { start: number; end: number },
  pasted: string,
  newId: NewId,
): LinesEdit {
  const line = lines[index]
  const before = line.text.slice(0, selection.start)
  const after = line.text.slice(selection.end)
  const [first, ...rest] = pasted.replace(/\r\n?/g, '\n').split('\n')
  const kindForPlain = line.checked === null ? null : false
  const added = rest.map((text) => ({ id: newId(), ...(parseItem(text) ?? { checked: kindForPlain, text }) }))
  const inserted = [{ ...line, text: before + first }, ...added]
  const last = inserted[inserted.length - 1]
  inserted[inserted.length - 1] = { ...last, text: last.text + after }
  return {
    lines: replaceRange(lines, index, index + 1, ...inserted),
    focus: { id: last.id, caret: last.text.length },
  }
}

export function toggleLineKind(lines: EditorLine[], index: number): LinesEdit {
  const line = lines[index]
  const toggled = { ...line, checked: line.checked === null ? false : null }
  return {
    lines: replaceRange(lines, index, index + 1, toggled),
    focus: { id: line.id, caret: line.text.length },
  }
}

export function toggleLineChecked(lines: EditorLine[], index: number): EditorLine[] {
  const line = lines[index]
  if (line.checked === null) return lines
  return replaceRange(lines, index, index + 1, { ...line, checked: !line.checked })
}

export function editorLinesFrom(content: string, newId: NewId): EditorLine[] {
  return toLines(content).map((line) => ({ ...line, id: newId() }))
}

export function formatLineBlock(lines: EditorLine[], index: number, format: BlockFormat, caret: number): LinesEdit {
  const line = lines[index]
  const isPlain = line.checked === null
  const body = isPlain ? blockBody(line.text) : line.text
  const oldMarker = isPlain ? line.text.length - body.length : 0
  const removing = isPlain && blockFormatOf(line.text) === format
  const marker = removing ? '' : blockMarker(format, nextOrderedNumber(lines[index - 1] && plainText(lines[index - 1])))
  return {
    lines: replaceRange(lines, index, index + 1, { ...line, checked: null, text: marker + body }),
    focus: { id: line.id, caret: Math.max(marker.length, caret - oldMarker + marker.length) },
  }
}

export function toggleCodeFence(lines: EditorLine[], index: number, caret: number, newId: NewId): LinesEdit {
  const line = lines[index]
  const previous = lines[index - 1]
  const next = lines[index + 1]
  if (previous && next && isFence(plainText(previous)) && isFence(plainText(next))) {
    return { lines: replaceRange(lines, index - 1, index + 2, line), focus: { id: line.id, caret } }
  }
  const fence = () => ({ id: newId(), checked: null, text: FENCE_MARKER })
  const code = { ...line, checked: null, text: fromLines([line]) }
  return {
    lines: replaceRange(lines, index, index + 1, fence(), code, fence()),
    focus: { id: line.id, caret: caret + code.text.length - line.text.length },
  }
}
