export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong' | 'em' | 'strike'; marker: string; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'url'; href: string }

export type LineKind =
  | { kind: 'heading'; level: number; marker: string; text: string }
  | { kind: 'bullet'; marker: string; text: string }
  | { kind: 'ordered'; number: number; delimiter: string; marker: string; text: string }
  | { kind: 'fence'; marker: string; text: string }
  | { kind: 'paragraph'; marker: ''; text: string }

const HEADING_PATTERN = /^(#{1,3}) (.*)$/
const BULLET_PATTERN = /^([-*+]) (.*)$/
const ORDERED_PATTERN = /^(\d{1,9})([.)]) (.*)$/
export const FENCE_MARKER = '```'
const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s()]+$/i
const BARE_URL = /^https?:\/\/[^\s<>]+/i
const TRAILING_PUNCTUATION = /[.,;:!?'")\]]+$/

const EMPHASIS = [
  { marker: '**', kind: 'strong' },
  { marker: '__', kind: 'strong' },
  { marker: '~~', kind: 'strike' },
  { marker: '*', kind: 'em' },
  { marker: '_', kind: 'em' },
] as const

interface Match {
  node: Inline
  end: number
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char)
const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char)

function findClosing(text: string, marker: string, from: number): number {
  for (let index = text.indexOf(marker, from + 1); index !== -1; index = text.indexOf(marker, index + 1)) {
    if (isSpace(text[index - 1])) continue
    if (marker.length === 1 && (text[index - 1] === marker || text[index + 1] === marker)) continue
    let close = index
    while (marker.length > 1 && text[close + marker.length] === marker[0]) close += 1
    if (marker.startsWith('_') && isWordChar(text[close + marker.length])) continue
    return close
  }
  return -1
}

function matchEmphasis(text: string, start: number): Match | null {
  for (const { marker, kind } of EMPHASIS) {
    if (!text.startsWith(marker, start)) continue
    const innerStart = start + marker.length
    if (isSpace(text[innerStart]) || (marker.length === 1 && text[innerStart] === marker)) continue
    if (marker.startsWith('_') && isWordChar(text[start - 1])) continue
    const close = findClosing(text, marker, innerStart)
    if (close === -1) continue
    return { node: { kind, marker, children: parseInline(text.slice(innerStart, close)) }, end: close + marker.length }
  }
  return null
}

function matchCode(text: string, start: number): Match | null {
  const close = text.indexOf('`', start + 1)
  if (close <= start + 1) return null
  return { node: { kind: 'code', text: text.slice(start + 1, close) }, end: close + 1 }
}

function matchLink(text: string, start: number): Match | null {
  const labelEnd = text.indexOf('](', start + 1)
  if (labelEnd <= start + 1) return null
  const hrefEnd = text.indexOf(')', labelEnd + 2)
  if (hrefEnd === -1) return null
  const href = text.slice(labelEnd + 2, hrefEnd)
  if (!SAFE_HREF.test(href)) return null
  return { node: { kind: 'link', href, children: parseInline(text.slice(start + 1, labelEnd)) }, end: hrefEnd + 1 }
}

function matchUrl(text: string, start: number): Match | null {
  if (isWordChar(text[start - 1])) return null
  const found = BARE_URL.exec(text.slice(start))
  if (!found) return null
  const href = found[0].replace(TRAILING_PUNCTUATION, '')
  if (!SAFE_HREF.test(href)) return null
  return { node: { kind: 'url', href }, end: start + href.length }
}

function matchAt(text: string, start: number): Match | null {
  const char = text[start]
  if (char === '`') return matchCode(text, start)
  if (char === '[') return matchLink(text, start)
  if (char === 'h' || char === 'H') return matchUrl(text, start)
  return matchEmphasis(text, start)
}

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = []
  let plain = ''
  let index = 0
  while (index < text.length) {
    const match = matchAt(text, index)
    if (!match) {
      plain += text[index]
      index += 1
      continue
    }
    if (plain) nodes.push({ kind: 'text', text: plain })
    plain = ''
    nodes.push(match.node)
    index = match.end
  }
  if (plain) nodes.push({ kind: 'text', text: plain })
  return nodes
}

function nodeSource(node: Inline): string {
  switch (node.kind) {
    case 'text':
      return node.text
    case 'code':
      return `\`${node.text}\``
    case 'url':
      return node.href
    case 'link':
      return `[${toSource(node.children)}](${node.href})`
    default:
      return node.marker + toSource(node.children) + node.marker
  }
}

export function toSource(nodes: Inline[]): string {
  return nodes.map(nodeSource).join('')
}

function nodePlain(node: Inline): string {
  switch (node.kind) {
    case 'text':
    case 'code':
      return node.text
    case 'url':
      return node.href
    default:
      return inlinePlain(node.children)
  }
}

function inlinePlain(nodes: Inline[]): string {
  return nodes.map(nodePlain).join('')
}

export function plainInline(text: string): string {
  return inlinePlain(parseInline(text))
}

export function classifyLine(line: string): LineKind {
  if (line.startsWith(FENCE_MARKER)) return { kind: 'fence', marker: line, text: '' }
  const heading = HEADING_PATTERN.exec(line)
  if (heading) return { kind: 'heading', level: heading[1].length, marker: `${heading[1]} `, text: heading[2] }
  const bullet = BULLET_PATTERN.exec(line)
  if (bullet) return { kind: 'bullet', marker: `${bullet[1]} `, text: bullet[2] }
  const ordered = ORDERED_PATTERN.exec(line)
  if (ordered) {
    return {
      kind: 'ordered',
      number: Number(ordered[1]),
      delimiter: ordered[2],
      marker: `${ordered[1]}${ordered[2]} `,
      text: ordered[3],
    }
  }
  return { kind: 'paragraph', marker: '', text: line }
}

export function isFence(line: string): boolean {
  return line.startsWith(FENCE_MARKER)
}

export function fenceStates(lines: string[]): boolean[] {
  let open = false
  return lines.map((line) => {
    if (isFence(line)) {
      open = !open
      return false
    }
    return open
  })
}

export function nextListMarker(kind: LineKind): string | null {
  if (kind.kind === 'bullet') return kind.marker
  if (kind.kind === 'ordered') return `${kind.number + 1}${kind.delimiter} `
  return null
}
