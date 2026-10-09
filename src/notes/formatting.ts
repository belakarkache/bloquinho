import { lineEndAt, lineStartAt, parseItem, UNCHECKED_PREFIX, type TextEdit } from './checklist'
import { classifyLine, FENCE_MARKER, isFence, nextListMarker } from './markdown'

export type InlineFormat = 'bold' | 'italic' | 'strike' | 'code'
export type BlockFormat = 'heading' | 'bullet' | 'ordered'
export type FormatAction = InlineFormat | BlockFormat | 'link' | 'codeBlock'

const INLINE_MARKERS: Record<InlineFormat, string> = { bold: '**', italic: '*', strike: '~~', code: '`' }
const URL_ONLY = /^(?:https?:\/\/|mailto:)\S+$/i
const LINK_PLACEHOLDER = 'https://'

function edit(content: string, from: number, to: number, inserted: string, start: number, end = start): TextEdit {
  return { content: content.slice(0, from) + inserted + content.slice(to), selectionStart: start, selectionEnd: end }
}

function runBefore(content: string, position: number, char: string): number {
  let count = 0
  while (content[position - count - 1] === char) count += 1
  return count
}

function runAfter(content: string, position: number, char: string): number {
  let count = 0
  while (content[position + count] === char) count += 1
  return count
}

function hasMarker(before: number, after: number, size: number): boolean {
  if (before < size || after < size) return false
  return size > 1 || (before % 2 === 1 && after % 2 === 1)
}

function wrapLine(segment: string, marker: string): string {
  const core = segment.trim()
  if (!core) return segment
  const start = segment.indexOf(core)
  return segment.slice(0, start) + marker + core + marker + segment.slice(start + core.length)
}

export function toggleInline(content: string, start: number, end: number, format: InlineFormat): TextEdit {
  const marker = INLINE_MARKERS[format]
  const size = marker.length
  const char = marker[0]
  const selected = content.slice(start, end)

  if (hasMarker(runBefore(content, start, char), runAfter(content, end, char), size)) {
    return edit(content, start - size, end + size, selected, start - size, end - size)
  }
  if (
    selected.length > size * 2 &&
    hasMarker(runAfter(selected, 0, char), runBefore(selected, selected.length, char), size)
  ) {
    const inner = selected.slice(size, -size)
    return edit(content, start, end, inner, start, start + inner.length)
  }
  if (!selected.trim()) return edit(content, end, end, marker + marker, end + size)

  const innerStart = start + selected.length - selected.trimStart().length
  const innerEnd = end - (selected.length - selected.trimEnd().length)
  const wrapped = content
    .slice(innerStart, innerEnd)
    .split('\n')
    .map((segment) => wrapLine(segment, marker))
    .join('\n')
  return edit(content, innerStart, innerEnd, wrapped, innerStart + size, innerStart + wrapped.length - size)
}

export function insertLink(content: string, start: number, end: number): TextEdit {
  const selected = content.slice(start, end)
  if (URL_ONLY.test(selected)) return edit(content, start, end, `[](${selected})`, start + 1)
  const inserted = `[${selected}](${LINK_PLACEHOLDER})`
  if (!selected) return edit(content, start, end, inserted, start + 1)
  const urlStart = start + selected.length + 3
  return edit(content, start, end, inserted, urlStart, urlStart + LINK_PLACEHOLDER.length)
}

export function blockFormatOf(line: string): BlockFormat | null {
  if (parseItem(line)) return null
  const { kind } = classifyLine(line)
  return kind === 'heading' || kind === 'bullet' || kind === 'ordered' ? kind : null
}

export function blockBody(line: string): string {
  const item = parseItem(line)
  if (item) return item.text
  const kind = classifyLine(line)
  return kind.kind === 'fence' ? line : kind.text
}

export function blockMarker(format: BlockFormat, number: number): string {
  if (format === 'heading') return '# '
  if (format === 'bullet') return '- '
  return `${number}. `
}

export function nextOrderedNumber(previousLine: string | undefined): number {
  const kind = classifyLine(previousLine ?? '')
  return kind.kind === 'ordered' ? kind.number + 1 : 1
}

export function toggleBlock(content: string, start: number, end: number, format: BlockFormat): TextEdit {
  const blockStart = lineStartAt(content, start)
  const blockEnd = lineEndAt(content, end)
  const lines = content.slice(blockStart, blockEnd).split('\n')
  const targets = lines.length > 1 ? lines.filter((line) => line.trim()) : lines
  const removing = targets.every((line) => blockFormatOf(line) === format)
  const previousLine =
    blockStart === 0 ? undefined : content.slice(lineStartAt(content, blockStart - 1), blockStart - 1)
  let number = nextOrderedNumber(previousLine)
  const updated = lines.map((line) => {
    if (lines.length > 1 && !line.trim()) return line
    const body = blockBody(line)
    return removing ? body : blockMarker(format, number++) + body
  })
  const block = updated.join('\n')
  const next = content.slice(0, blockStart) + block + content.slice(blockEnd)

  if (start !== end) return { content: next, selectionStart: blockStart, selectionEnd: blockStart + block.length }
  const caret = Math.max(blockStart, start + updated[0].length - lines[0].length)
  return { content: next, selectionStart: caret, selectionEnd: caret }
}

function lineIndexAt(content: string, position: number): number {
  return content.slice(0, position).split('\n').length - 1
}

export function toggleCodeBlock(content: string, start: number, end: number): TextEdit {
  const lines = content.split('\n')
  const first = lineIndexAt(content, start)
  const last = lineIndexAt(content, end)
  const opening = lines[first - 1]
  if (opening !== undefined && isFence(opening) && isFence(lines[last + 1] ?? '')) {
    const remaining = [...lines.slice(0, first - 1), ...lines.slice(first, last + 1), ...lines.slice(last + 2)]
    const shift = opening.length + 1
    return { content: remaining.join('\n'), selectionStart: start - shift, selectionEnd: end - shift }
  }
  const fenced = [
    ...lines.slice(0, first),
    FENCE_MARKER,
    ...lines.slice(first, last + 1),
    FENCE_MARKER,
    ...lines.slice(last + 1),
  ]
  const shift = FENCE_MARKER.length + 1
  return { content: fenced.join('\n'), selectionStart: start + shift, selectionEnd: end + shift }
}

export function insideCodeBlock(content: string, position: number): boolean {
  return content.slice(0, lineStartAt(content, position)).split('\n').filter(isFence).length % 2 === 1
}

function listMarkerOf(line: string): { length: number; empty: boolean; next: string } | null {
  const item = parseItem(line)
  if (item) return { length: line.length - item.text.length, empty: !item.text.trim(), next: UNCHECKED_PREFIX }
  const kind = classifyLine(line)
  const next = nextListMarker(kind)
  return next ? { length: kind.marker.length, empty: !kind.text.trim(), next } : null
}

export function continueList(content: string, caret: number): TextEdit | null {
  const lineStart = lineStartAt(content, caret)
  const lineEnd = lineEndAt(content, caret)
  if (insideCodeBlock(content, caret)) return null
  const marker = listMarkerOf(content.slice(lineStart, lineEnd))
  if (!marker || caret < lineStart + marker.length) return null
  if (marker.empty) return edit(content, lineStart, lineEnd, '', lineStart)
  const insertion = `\n${marker.next}`
  return edit(content, caret, caret, insertion, caret + insertion.length)
}

export function formatText(content: string, start: number, end: number, action: FormatAction): TextEdit {
  if (action === 'link') return insertLink(content, start, end)
  if (action === 'codeBlock') return toggleCodeBlock(content, start, end)
  if (action === 'heading' || action === 'bullet' || action === 'ordered') {
    return toggleBlock(content, start, end, action)
  }
  return toggleInline(content, start, end, action)
}

export function formatShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): FormatAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (event.shiftKey) return key === 'x' ? 'strike' : null
  if (key === 'b') return 'bold'
  if (key === 'i') return 'italic'
  if (key === 'e') return 'code'
  return null
}
