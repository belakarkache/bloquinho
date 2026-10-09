import { describe, expect, it } from 'vitest'
import { classifyLine, fenceStates, parseInline, plainInline, toSource } from './markdown'

describe('parseInline', () => {
  it('reads bold, italic, strike and code', () => {
    expect(parseInline('a **b** *c* _d_ ~~e~~ `f`')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'strong', marker: '**', children: [{ kind: 'text', text: 'b' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', marker: '*', children: [{ kind: 'text', text: 'c' }] },
      { kind: 'text', text: ' ' },
      { kind: 'em', marker: '_', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strike', marker: '~~', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'f' },
    ])
  })

  it('nests emphasis', () => {
    expect(parseInline('***x***')).toEqual([
      {
        kind: 'strong',
        marker: '**',
        children: [{ kind: 'em', marker: '*', children: [{ kind: 'text', text: 'x' }] }],
      },
    ])
    expect(parseInline('*a **b** c*')).toEqual([
      {
        kind: 'em',
        marker: '*',
        children: [
          { kind: 'text', text: 'a ' },
          { kind: 'strong', marker: '**', children: [{ kind: 'text', text: 'b' }] },
          { kind: 'text', text: ' c' },
        ],
      },
    ])
  })

  it('leaves loose markers as text', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }])
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }])
    expect(parseInline('**aberto')).toEqual([{ kind: 'text', text: '**aberto' }])
    expect(parseInline('``')).toEqual([{ kind: 'text', text: '``' }])
  })

  it('does not read markdown inside code', () => {
    expect(parseInline('`**x**`')).toEqual([{ kind: 'code', text: '**x**' }])
  })

  it('reads safe links and bare urls', () => {
    expect(parseInline('[site](https://a.com/x) e https://b.com.')).toEqual([
      { kind: 'link', href: 'https://a.com/x', children: [{ kind: 'text', text: 'site' }] },
      { kind: 'text', text: ' e ' },
      { kind: 'url', href: 'https://b.com' },
      { kind: 'text', text: '.' },
    ])
    expect(parseInline('[mail](mailto:a@b.com)')[0]).toMatchObject({ kind: 'link', href: 'mailto:a@b.com' })
  })

  it('rejects unsafe link targets', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ kind: 'text', text: '[x](javascript:alert(1))' }])
    expect(parseInline('[x](data:text/html,oi)')).toEqual([{ kind: 'text', text: '[x](data:text/html,oi)' }])
  })

  it('round-trips to the original source', () => {
    const samples = [
      'a **b** _c_ ~~d~~ `e`',
      '[l **b**](https://x.y) http://z.w/q?a=1',
      '***x*** *a **b** c*',
      '* solto',
    ]
    for (const sample of samples) expect(toSource(parseInline(sample))).toBe(sample)
  })
})

describe('plainInline', () => {
  it('drops markers', () => {
    expect(plainInline('**a** [b](https://c.d) `e`')).toBe('a b e')
  })
})

describe('classifyLine', () => {
  it('detects block markers', () => {
    expect(classifyLine('## Título')).toMatchObject({ kind: 'heading', level: 2, marker: '## ', text: 'Título' })
    expect(classifyLine('- item')).toMatchObject({ kind: 'bullet', marker: '- ', text: 'item' })
    expect(classifyLine('12) item')).toMatchObject({ kind: 'ordered', number: 12, marker: '12) ', text: 'item' })
    expect(classifyLine('```ts')).toMatchObject({ kind: 'fence' })
    expect(classifyLine('#tag')).toMatchObject({ kind: 'paragraph', text: '#tag' })
  })
})

describe('fenceStates', () => {
  it('marks lines inside code fences', () => {
    expect(fenceStates(['a', '```', 'b', '```', 'c'])).toEqual([false, false, true, false, false])
  })
})
