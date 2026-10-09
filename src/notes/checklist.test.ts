import { describe, expect, it } from 'vitest'
import {
  fromLines,
  hasChecklist,
  isBlankNote,
  parseItem,
  toggleChecklist,
  toggleItem,
  toLines,
  toNoteView,
  toPlainText,
} from './checklist'

describe('parseItem', () => {
  it('reads checked and unchecked items', () => {
    expect(parseItem('- [ ] leite')).toEqual({ checked: false, text: 'leite' })
    expect(parseItem('- [x] pão')).toEqual({ checked: true, text: 'pão' })
    expect(parseItem('- [X] café')).toEqual({ checked: true, text: 'café' })
    expect(parseItem('- [ ]')).toEqual({ checked: false, text: '' })
  })

  it('ignores lines that are not items', () => {
    expect(parseItem('leite')).toBeNull()
    expect(parseItem('- leite')).toBeNull()
    expect(parseItem('-[ ] leite')).toBeNull()
  })
})

describe('toPlainText', () => {
  it('drops checklist markers', () => {
    expect(toPlainText('Mercado\n- [ ] leite\n- [x] pão')).toBe('Mercado\nleite\npão')
  })

  it('drops markdown markers but keeps code verbatim', () => {
    expect(toPlainText('# **Oi** _você_\n- [link](https://a.b)\n```\n**x**\n```')).toBe('Oi você\nlink\n\n**x**\n')
  })
})

describe('toggleItem', () => {
  it('flips the item on the given line', () => {
    expect(toggleItem('Mercado\n- [ ] leite\n- [x] pão', 1)).toBe('Mercado\n- [x] leite\n- [x] pão')
    expect(toggleItem('Mercado\n- [ ] leite\n- [x] pão', 2)).toBe('Mercado\n- [ ] leite\n- [ ] pão')
  })

  it('keeps content when the line is not an item', () => {
    expect(toggleItem('Mercado\n- [ ] leite', 0)).toBe('Mercado\n- [ ] leite')
    expect(toggleItem('Mercado', 5)).toBe('Mercado')
  })
})

describe('toggleChecklist', () => {
  it('turns the caret line into an item and keeps the caret on the text', () => {
    expect(toggleChecklist('Mercado\nleite', 10, 10)).toEqual({
      content: 'Mercado\n- [ ] leite',
      selectionStart: 16,
      selectionEnd: 16,
    })
  })

  it('turns every selected line into an item', () => {
    expect(toggleChecklist('leite\n- [x] pão\novos', 0, 17)).toEqual({
      content: '- [ ] leite\n- [x] pão\n- [ ] ovos',
      selectionStart: 0,
      selectionEnd: 32,
    })
  })

  it('removes items when every selected line is already one', () => {
    expect(toggleChecklist('- [ ] leite\n- [x] pão', 0, 21).content).toBe('leite\npão')
    expect(toggleChecklist('- [ ] leite', 2, 2)).toEqual({ content: 'leite', selectionStart: 0, selectionEnd: 0 })
  })
})

describe('toNoteView', () => {
  it('uses a leading heading as title and groups the body', () => {
    expect(toNoteView('  \n# Mercado\n\n- [ ] leite\n- [x] pão\nlevar sacola\n')).toEqual({
      title: 'Mercado',
      blocks: [
        { kind: 'item', checked: false, text: 'leite', line: 3 },
        { kind: 'item', checked: true, text: 'pão', line: 4 },
        { kind: 'text', text: 'levar sacola' },
      ],
    })
  })

  it('has no title when the note starts with an item', () => {
    expect(toNoteView('\n- [ ] leite\nobs')).toEqual({
      title: '',
      blocks: [
        { kind: 'item', checked: false, text: 'leite', line: 1 },
        { kind: 'text', text: 'obs' },
      ],
    })
  })

  it('has no title when the first line is not a heading', () => {
    expect(toNoteView('Mercado\nleite\novos')).toEqual({
      title: '',
      blocks: [{ kind: 'text', text: 'Mercado\nleite\novos' }],
    })
    expect(toNoteView('   ')).toEqual({ title: '', blocks: [] })
  })

  it('reads headings, lists and code blocks in the body', () => {
    expect(toNoteView('intro\n## Passos\n- a\n1. b\n```\n# não é título\n```\nfim').blocks).toEqual([
      { kind: 'text', text: 'intro' },
      { kind: 'heading', level: 2, text: 'Passos' },
      { kind: 'bullet', text: 'a' },
      { kind: 'ordered', number: 1, text: 'b' },
      { kind: 'code', text: '# não é título' },
      { kind: 'text', text: 'fim' },
    ])
  })

  it('keeps an unclosed code block until the end', () => {
    expect(toNoteView('# T\n```\nx = 1').blocks).toEqual([{ kind: 'code', text: 'x = 1' }])
  })
})

describe('lines', () => {
  it('converts content to lines and back', () => {
    const content = 'Mercado\n- [ ] leite\n- [x] pão'
    expect(toLines(content)).toEqual([
      { checked: null, text: 'Mercado' },
      { checked: false, text: 'leite' },
      { checked: true, text: 'pão' },
    ])
    expect(fromLines(toLines(content))).toBe(content)
  })
})

describe('hasChecklist', () => {
  it('detects any checklist line', () => {
    expect(hasChecklist('Compras\n- [ ] leite')).toBe(true)
    expect(hasChecklist('Compras\nleite')).toBe(false)
  })
})

describe('isBlankNote', () => {
  it('treats whitespace and empty items as blank', () => {
    expect(isBlankNote('  \n')).toBe(true)
    expect(isBlankNote('- [ ] \n- [x] ')).toBe(true)
    expect(isBlankNote('- [ ] leite')).toBe(false)
  })
})
