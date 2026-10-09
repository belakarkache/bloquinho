import { classifyLine, isFence, plainInline } from './markdown'

const ITEM_PATTERN = /^- \[([ xX])\](?: (.*))?$/
export const UNCHECKED_PREFIX = '- [ ] '

export interface ChecklistItem {
  checked: boolean
  text: string
}

export type NoteBlock =
  | { kind: 'text'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'ordered'; number: number; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'item'; text: string; checked: boolean; line: number }

export interface NoteView {
  title: string
  blocks: NoteBlock[]
}

export interface TextEdit {
  content: string
  selectionStart: number
  selectionEnd: number
}

export function parseItem(line: string): ChecklistItem | null {
  const match = ITEM_PATTERN.exec(line)
  if (!match) return null
  return { checked: match[1] !== ' ', text: match[2] ?? '' }
}

function formatItem({ checked, text }: ChecklistItem): string {
  return `- [${checked ? 'x' : ' '}] ${text}`
}

function plainLine(line: string): string {
  const item = parseItem(line)
  if (item) return plainInline(item.text)
  const kind = classifyLine(line)
  return kind.kind === 'fence' ? '' : plainInline(kind.text)
}

export function toPlainText(content: string): string {
  let insideCode = false
  return content
    .split('\n')
    .map((line) => {
      if (isFence(line)) {
        insideCode = !insideCode
        return ''
      }
      return insideCode ? line : plainLine(line)
    })
    .join('\n')
}

export function toggleItem(content: string, line: number): string {
  const lines = content.split('\n')
  const item = parseItem(lines[line] ?? '')
  if (!item) return content
  lines[line] = formatItem({ ...item, checked: !item.checked })
  return lines.join('\n')
}

export function lineStartAt(content: string, position: number): number {
  return content.lastIndexOf('\n', position - 1) + 1
}

export function lineEndAt(content: string, position: number): number {
  const lineBreak = content.indexOf('\n', position)
  return lineBreak === -1 ? content.length : lineBreak
}

export function toggleChecklist(content: string, selectionStart: number, selectionEnd: number): TextEdit {
  const blockStart = lineStartAt(content, selectionStart)
  const blockEnd = lineEndAt(content, selectionEnd)
  const lines = content.slice(blockStart, blockEnd).split('\n')
  const removing = lines.every((line) => parseItem(line) !== null)
  const updated = lines.map((line) => {
    const item = parseItem(line)
    if (removing) return item?.text ?? line
    return item ? line : UNCHECKED_PREFIX + line
  })
  const block = updated.join('\n')
  const next = content.slice(0, blockStart) + block + content.slice(blockEnd)

  if (selectionStart !== selectionEnd) {
    return { content: next, selectionStart: blockStart, selectionEnd: blockStart + block.length }
  }
  const caret = Math.max(blockStart, selectionStart + updated[0].length - lines[0].length)
  return { content: next, selectionStart: caret, selectionEnd: caret }
}

function lineBlock(text: string, line: number): NoteBlock {
  const item = parseItem(text)
  if (item) return { kind: 'item', ...item, line }
  const kind = classifyLine(text)
  if (kind.kind === 'heading') return { kind: 'heading', level: kind.level, text: kind.text.trim() }
  if (kind.kind === 'bullet') return { kind: 'bullet', text: kind.text }
  if (kind.kind === 'ordered') return { kind: 'ordered', number: kind.number, text: kind.text }
  return { kind: 'text', text }
}

function groupBlocks(lines: { text: string; line: number }[]): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let code: string[] | null = null
  for (const { text, line } of lines) {
    if (isFence(text)) {
      if (code) blocks.push({ kind: 'code', text: code.join('\n') })
      code = code ? null : []
      continue
    }
    if (code) {
      code.push(text)
      continue
    }
    const block = lineBlock(text, line)
    const previous = blocks.at(-1)
    if (block.kind === 'text' && previous?.kind === 'text') previous.text += `\n${block.text}`
    else blocks.push(block)
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n') })
  return blocks
}

function toBlocks(lines: { text: string; line: number }[]): NoteBlock[] {
  return groupBlocks(lines).flatMap<NoteBlock>((block) => {
    if (block.kind === 'text' || block.kind === 'heading') {
      const text = block.text.trim()
      return text ? [{ ...block, text }] : []
    }
    if (block.kind === 'code') return block.text.trim() ? [block] : []
    return [block]
  })
}

export function toNoteView(content: string): NoteView {
  const lines = content.split('\n').map((text, line) => ({ text, line }))
  const first = lines.findIndex(({ text }) => text.trim() !== '')
  if (first === -1) return { title: '', blocks: [] }
  const last = lines.findLastIndex(({ text }) => text.trim() !== '')
  const [head, ...rest] = lines.slice(first, last + 1)
  const kind = parseItem(head.text) ? null : classifyLine(head.text)
  if (kind?.kind !== 'heading') return { title: '', blocks: toBlocks([head, ...rest]) }
  return { title: kind.text.trim(), blocks: toBlocks(rest) }
}

export interface NoteLine {
  checked: boolean | null
  text: string
}

export function toLines(content: string): NoteLine[] {
  return content.split('\n').map((line) => parseItem(line) ?? { checked: null, text: line })
}

export function fromLines(lines: NoteLine[]): string {
  return lines
    .map(({ checked, text }) => (checked === null ? text : formatItem({ checked, text })))
    .join('\n')
}

export function hasChecklist(content: string): boolean {
  return content.split('\n').some((line) => parseItem(line) !== null)
}

export function isBlankNote(content: string): boolean {
  return toPlainText(content).trim() === ''
}
