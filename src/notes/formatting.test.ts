import { describe, expect, it } from 'vitest'
import { continueList, formatShortcut, insertLink, toggleBlock, toggleCodeBlock, toggleInline } from './formatting'

describe('toggleInline', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(toggleInline('um dois', 3, 7, 'bold')).toEqual({
      content: 'um **dois**',
      selectionStart: 5,
      selectionEnd: 9,
    })
  })

  it('keeps surrounding spaces outside the markers', () => {
    expect(toggleInline('um dois ', 2, 8, 'italic').content).toBe('um *dois* ')
  })

  it('inserts empty markers at the caret', () => {
    expect(toggleInline('ab', 1, 1, 'code')).toEqual({ content: 'a``b', selectionStart: 2, selectionEnd: 2 })
  })

  it('unwraps when the markers surround the selection', () => {
    expect(toggleInline('um **dois**', 5, 9, 'bold')).toEqual({
      content: 'um dois',
      selectionStart: 3,
      selectionEnd: 7,
    })
    expect(toggleInline('um **dois**', 3, 11, 'bold')).toEqual({
      content: 'um dois',
      selectionStart: 3,
      selectionEnd: 7,
    })
  })

  it('tells italic from bold', () => {
    expect(toggleInline('**a**', 2, 3, 'italic').content).toBe('***a***')
    expect(toggleInline('***a***', 3, 4, 'italic').content).toBe('**a**')
  })

  it('wraps each selected line on its own', () => {
    expect(toggleInline('a\nb', 0, 3, 'strike').content).toBe('~~a~~\n~~b~~')
  })
})

describe('insertLink', () => {
  it('turns the selection into the label and selects the url', () => {
    expect(insertLink('ver site', 4, 8)).toEqual({
      content: 'ver [site](https://)',
      selectionStart: 11,
      selectionEnd: 19,
    })
  })

  it('uses a selected url as the target', () => {
    expect(insertLink('https://a.b', 0, 11)).toEqual({ content: '[](https://a.b)', selectionStart: 1, selectionEnd: 1 })
  })
})

describe('toggleBlock', () => {
  it('adds and removes a heading on the caret line', () => {
    const added = toggleBlock('oi\nmundo', 4, 4, 'heading')
    expect(added).toEqual({ content: 'oi\n# mundo', selectionStart: 6, selectionEnd: 6 })
    expect(toggleBlock(added.content, 6, 6, 'heading').content).toBe('oi\nmundo')
  })

  it('numbers selected lines and skips blank ones', () => {
    expect(toggleBlock('a\n\nb', 0, 4, 'ordered').content).toBe('1. a\n\n2. b')
  })

  it('continues numbering from the previous line', () => {
    expect(toggleBlock('1. a\nb', 6, 6, 'ordered').content).toBe('1. a\n2. b')
  })

  it('replaces another list kind', () => {
    expect(toggleBlock('- [ ] a', 0, 0, 'bullet').content).toBe('- a')
    expect(toggleBlock('1. a', 0, 0, 'bullet').content).toBe('- a')
  })
})

describe('toggleCodeBlock', () => {
  it('fences the selected lines and removes the fence again', () => {
    const fenced = toggleCodeBlock('a\nb\nc', 2, 2)
    expect(fenced).toEqual({ content: 'a\n```\nb\n```\nc', selectionStart: 6, selectionEnd: 6 })
    expect(toggleCodeBlock(fenced.content, 6, 6)).toEqual({ content: 'a\nb\nc', selectionStart: 2, selectionEnd: 2 })
  })
})

describe('continueList', () => {
  it('starts a new item after an item', () => {
    expect(continueList('- [x] leite', 11)).toEqual({
      content: '- [x] leite\n- [ ] ',
      selectionStart: 18,
      selectionEnd: 18,
    })
  })

  it('splits the item text at the caret', () => {
    expect(continueList('- [ ] leitepão', 11)?.content).toBe('- [ ] leite\n- [ ] pão')
  })

  it('continues bullets and numbers', () => {
    expect(continueList('- a', 3)?.content).toBe('- a\n- ')
    expect(continueList('9. a', 4)?.content).toBe('9. a\n10. ')
  })

  it('leaves the list when the item is empty', () => {
    expect(continueList('- [ ] leite\n- [ ] ', 18)).toEqual({
      content: '- [ ] leite\n',
      selectionStart: 12,
      selectionEnd: 12,
    })
    expect(continueList('- a\n- ', 6)?.content).toBe('- a\n')
  })

  it('does nothing outside lists, inside the marker or inside code', () => {
    expect(continueList('Mercado', 7)).toBeNull()
    expect(continueList('- [ ] leite', 3)).toBeNull()
    expect(continueList('```\n- a', 7)).toBeNull()
  })
})

describe('formatShortcut', () => {
  const key = (key: string, extra: Partial<{ shiftKey: boolean; metaKey: boolean }> = {}) => ({
    key,
    ctrlKey: !extra.metaKey,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...extra,
  })

  it('maps keyboard shortcuts to formats', () => {
    expect(formatShortcut(key('b'))).toBe('bold')
    expect(formatShortcut(key('I'))).toBe('italic')
    expect(formatShortcut(key('e', { metaKey: true }))).toBe('code')
    expect(formatShortcut(key('X', { shiftKey: true }))).toBe('strike')
    expect(formatShortcut(key('k'))).toBeNull()
    expect(formatShortcut({ ...key('b'), ctrlKey: false })).toBeNull()
  })
})
