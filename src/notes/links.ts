import { parseItem } from './checklist'
import { classifyLine, fenceStates, parseInline, toSource, type Inline } from './markdown'

function unwrapLink(nodes: Inline[], target: number, counter: { seen: number }): Inline[] {
  return nodes.flatMap((node): Inline[] => {
    if (node.kind === 'link') {
      if (counter.seen++ === target) return node.children
      return [{ ...node, children: unwrapLink(node.children, target, counter) }]
    }
    if (node.kind === 'strong' || node.kind === 'em' || node.kind === 'strike') {
      return [{ ...node, children: unwrapLink(node.children, target, counter) }]
    }
    return [node]
  })
}

export function unlinkInline(text: string, index: number): string {
  return toSource(unwrapLink(parseInline(text), index, { seen: 0 }))
}

function markerLength(line: string): number | null {
  const item = parseItem(line)
  if (item) return line.length - item.text.length
  const kind = classifyLine(line)
  return kind.kind === 'fence' ? null : kind.marker.length
}

export function unlinkInLine(line: string, index: number): string {
  const marker = markerLength(line)
  if (marker === null) return line
  return line.slice(0, marker) + unlinkInline(line.slice(marker), index)
}

export function unlinkInContent(content: string, lineIndex: number, index: number): string {
  const lines = content.split('\n')
  if (fenceStates(lines)[lineIndex] || lines[lineIndex] === undefined) return content
  lines[lineIndex] = unlinkInLine(lines[lineIndex], index)
  return lines.join('\n')
}
