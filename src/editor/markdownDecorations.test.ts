import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { inlineSpans } from './inlineSpans'
import { lineLayout, linkAt } from './markdownDecorations'

describe('inlineSpans', () => {
  it('marks emphasis and its markers by position', () => {
    expect(inlineSpans('a **b** c')).toEqual([
      { kind: 'strong', from: 2, to: 7 },
      { kind: 'marker', from: 2, to: 4 },
      { kind: 'marker', from: 5, to: 7 },
    ])
  })

  it('numbers markdown links and leaves bare urls unnumbered', () => {
    const spans = inlineSpans('[um](https://a.dev) https://b.dev', 10).filter((span) => span.kind === 'link')
    expect(spans).toEqual([
      { kind: 'link', from: 11, to: 13, href: 'https://a.dev', linkIndex: 0 },
      { kind: 'link', from: 30, to: 43, href: 'https://b.dev' },
    ])
  })
})

describe('lineLayout', () => {
  it('turns a checklist prefix into a checkbox', () => {
    const layout = lineLayout('- [x] leite', false)
    expect(layout.item).toEqual({ checked: true, label: 'leite', prefix: 6 })
    expect(layout.bodyStart).toBe(6)
  })

  it('styles headings and code without inline spans inside code', () => {
    expect(lineLayout('# Título', false).spans).toEqual([{ kind: 'marker', from: 0, to: 2 }])
    expect(lineLayout('**não**', true)).toMatchObject({ spans: [], item: null })
  })
})

describe('linkAt', () => {
  it('finds the link and its index within the line', () => {
    const state = EditorState.create({ doc: 'topo\n- [ ] ver [a](https://a.dev) e [b](https://b.dev)' })
    const position = state.doc.line(2).from + 32
    expect(linkAt(state, position)).toEqual({ href: 'https://b.dev', line: 1, linkIndex: 1 })
    expect(linkAt(state, 1)).toBeNull()
  })
})
