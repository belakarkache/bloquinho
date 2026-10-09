import { Fragment, memo, type ReactNode } from 'react'
import { parseItem } from '../notes/checklist'
import { classifyLine, fenceStates, parseInline, type Inline } from '../notes/markdown'

const FAUX_BOLD = '[-webkit-text-stroke:0.04em_currentColor]'

function Marker({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>
}

function HighlightNode({ node }: { node: Inline }) {
  switch (node.kind) {
    case 'text':
      return node.text
    case 'code':
      return (
        <span className="rounded-sm bg-ink/8">
          <Marker>`</Marker>
          {node.text}
          <Marker>`</Marker>
        </span>
      )
    case 'url':
      return (
        <span data-href={node.href} className="underline decoration-ink/35">
          {node.href}
        </span>
      )
    case 'link':
      return (
        <>
          <Marker>[</Marker>
          <span data-href={node.href} data-link="" className="underline decoration-ink/35">
            {highlightNodes(node.children)}
          </span>
          <Marker>]({node.href})</Marker>
        </>
      )
    default:
      return (
        <span className={node.kind === 'strong' ? FAUX_BOLD : node.kind === 'em' ? 'italic' : 'line-through'}>
          <Marker>{node.marker}</Marker>
          {highlightNodes(node.children)}
          <Marker>{node.marker}</Marker>
        </span>
      )
  }
}

function highlightNodes(nodes: Inline[]) {
  return nodes.map((node, index) => <HighlightNode key={index} node={node} />)
}

export const HighlightedInline = memo(function HighlightedInline({ text }: { text: string }) {
  return highlightNodes(parseInline(text))
})

export const HighlightedLine = memo(function HighlightedLine({
  text,
  insideCode,
}: {
  text: string
  insideCode: boolean
}) {
  if (insideCode) return text
  const item = parseItem(text)
  if (item) {
    return (
      <>
        <Marker>{text.slice(0, text.length - item.text.length)}</Marker>
        <HighlightedInline text={item.text} />
      </>
    )
  }
  const kind = classifyLine(text)
  if (kind.kind === 'fence') return <Marker>{text}</Marker>
  if (kind.kind === 'paragraph') return <HighlightedInline text={text} />
  return (
    <>
      <Marker>{kind.marker}</Marker>
      <span className={kind.kind === 'heading' ? FAUX_BOLD : ''}>
        <HighlightedInline text={kind.text} />
      </span>
    </>
  )
})

export function HighlightedContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const insideCode = fenceStates(lines)
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && '\n'}
          <span
            data-line={index}
            className={insideCode[index] || classifyLine(line).kind === 'fence' ? 'text-ink-soft' : ''}
          >
            <HighlightedLine text={line} insideCode={insideCode[index]} />
          </span>
        </Fragment>
      ))}
      {'\u200b'}
    </>
  )
}
