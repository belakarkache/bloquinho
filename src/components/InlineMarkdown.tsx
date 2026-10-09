import type { MouseEvent, ReactNode } from 'react'
import { parseInline, type Inline } from '../notes/markdown'

const stopPropagation = (event: MouseEvent) => event.stopPropagation()

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopPropagation}
      className="pointer-events-auto font-medium text-ink underline decoration-ink/35 underline-offset-2 transition-colors hover:decoration-ink"
    >
      {children}
    </a>
  )
}

function InlineNode({ node }: { node: Inline }) {
  switch (node.kind) {
    case 'text':
      return node.text
    case 'code':
      return <code className="rounded-md bg-ink/8 px-1 py-px font-mono text-[0.88em] text-ink">{node.text}</code>
    case 'strong':
      return <strong className="font-semibold text-ink">{renderInline(node.children)}</strong>
    case 'em':
      return <em>{renderInline(node.children)}</em>
    case 'strike':
      return <s>{renderInline(node.children)}</s>
    case 'link':
      return <ExternalLink href={node.href}>{renderInline(node.children)}</ExternalLink>
    case 'url':
      return <ExternalLink href={node.href}>{node.href}</ExternalLink>
  }
}

function renderInline(nodes: Inline[]) {
  return nodes.map((node, index) => <InlineNode key={index} node={node} />)
}

export function InlineMarkdown({ text }: { text: string }) {
  return renderInline(parseInline(text))
}
