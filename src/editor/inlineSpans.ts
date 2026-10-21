import { parseInline, type Inline } from '../notes/markdown'

export type SpanKind = 'marker' | 'strong' | 'em' | 'strike' | 'code' | 'link'

export interface InlineSpan {
  kind: SpanKind
  from: number
  to: number
  href?: string
  linkIndex?: number
}

interface Walk {
  spans: InlineSpan[]
  links: number
}

function marker(walk: Walk, from: number, length: number): number {
  walk.spans.push({ kind: 'marker', from, to: from + length })
  return from + length
}

function walkNodes(nodes: Inline[], from: number, walk: Walk): number {
  return nodes.reduce((position, node) => walkNode(node, position, walk), from)
}

function walkNode(node: Inline, from: number, walk: Walk): number {
  switch (node.kind) {
    case 'text':
      return from + node.text.length
    case 'code': {
      const to = from + node.text.length + 2
      walk.spans.push({ kind: 'code', from, to })
      marker(walk, from, 1)
      return marker(walk, to - 1, 1)
    }
    case 'url': {
      const to = from + node.href.length
      walk.spans.push({ kind: 'link', from, to, href: node.href })
      return to
    }
    case 'link': {
      const span: InlineSpan = { kind: 'link', from: from + 1, to: from + 1, href: node.href, linkIndex: walk.links++ }
      walk.spans.push(span)
      const labelEnd = walkNodes(node.children, marker(walk, from, 1), walk)
      span.to = labelEnd
      return marker(walk, labelEnd, node.href.length + 3)
    }
    default: {
      const span: InlineSpan = { kind: node.kind, from, to: from }
      walk.spans.push(span)
      const innerEnd = walkNodes(node.children, marker(walk, from, node.marker.length), walk)
      span.to = marker(walk, innerEnd, node.marker.length)
      return span.to
    }
  }
}

export function inlineSpans(text: string, offset = 0): InlineSpan[] {
  const walk: Walk = { spans: [], links: 0 }
  walkNodes(parseInline(text), offset, walk)
  return walk.spans
}
