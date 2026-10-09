import { describe, expect, it } from 'vitest'
import { unlinkInContent, unlinkInline, unlinkInLine } from './links'

describe('unlinkInline', () => {
  it('keeps the label and drops the address', () => {
    expect(unlinkInline('veja [o site](https://a.dev) agora', 0)).toBe('veja o site agora')
  })

  it('removes only the chosen link', () => {
    expect(unlinkInline('[um](https://a.dev) e [dois](https://b.dev)', 1)).toBe('[um](https://a.dev) e dois')
  })

  it('finds links nested in emphasis and keeps the formatting', () => {
    expect(unlinkInline('**[forte](https://a.dev)** _x_', 0)).toBe('**forte** _x_')
  })

  it('leaves the text unchanged when the index does not exist', () => {
    const text = 'sem link https://a.dev e `código`'
    expect(unlinkInline(text, 0)).toBe(text)
  })
})

describe('unlinkInLine', () => {
  it('preserves list and checklist markers', () => {
    expect(unlinkInLine('- [ ] ler [artigo](https://a.dev)', 0)).toBe('- [ ] ler artigo')
    expect(unlinkInLine('# [Título](https://a.dev)', 0)).toBe('# Título')
    expect(unlinkInLine('2. [item](https://a.dev)', 0)).toBe('2. item')
  })
})

describe('unlinkInContent', () => {
  it('changes only the given line', () => {
    const content = '[a](https://a.dev)\n[b](https://b.dev)'
    expect(unlinkInContent(content, 1, 0)).toBe('[a](https://a.dev)\nb')
  })

  it('ignores lines inside code blocks', () => {
    const content = '```\n[a](https://a.dev)\n```'
    expect(unlinkInContent(content, 1, 0)).toBe(content)
  })
})
