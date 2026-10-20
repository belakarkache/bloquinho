import { describe, expect, it } from 'vitest'
import { fromLines } from './checklist'
import {
  breakLine,
  convertListBlock,
  extendSelection,
  lineSpan,
  replaceSelection,
  selectAllLines,
  selectedText,
  editorLinesFrom,
  formatLineBlock,
  joinWithNext,
  joinWithPrevious,
  pasteLines,
  toggleCodeFence,
  toggleLineChecked,
  toggleLineKind,
} from './lineEditing'

function idSequence() {
  let next = 0
  return () => `line-${next++}`
}

function linesOf(content: string) {
  return editorLinesFrom(content, idSequence())
}

describe('breakLine', () => {
  it('splits a text line at the caret', () => {
    const edit = breakLine(linesOf('Mercadinho'), 0, { start: 6, end: 6 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('Mercad\ninho')
    expect(edit.focus).toEqual({ id: 'new', caret: 0 })
  })

  it('starts a new unchecked item after an item', () => {
    const edit = breakLine(linesOf('- [x] leite'), 0, { start: 5, end: 5 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('- [x] leite\n- [ ] ')
  })

  it('replaces the selection', () => {
    const edit = breakLine(linesOf('leite e pão'), 0, { start: 5, end: 8 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('leite\npão')
  })

  it('turns an empty item into a text line', () => {
    const edit = breakLine(linesOf('- [ ] leite\n- [ ] '), 1, { start: 0, end: 0 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('- [ ] leite\n')
    expect(edit.focus).toEqual({ id: 'line-1', caret: 0 })
  })
})

describe('breakLine in lists', () => {
  it('continues bullets and numbers', () => {
    const bullet = breakLine(linesOf('- leite'), 0, { start: 7, end: 7 }, () => 'new')
    expect(fromLines(bullet.lines)).toBe('- leite\n- ')
    expect(bullet.focus).toEqual({ id: 'new', caret: 2 })
    expect(fromLines(breakLine(linesOf('3. a'), 0, { start: 4, end: 4 }, () => 'new').lines)).toBe('3. a\n4. ')
  })

  it('ends the list on an empty item', () => {
    const edit = breakLine(linesOf('- a\n- '), 1, { start: 2, end: 2 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('- a\n')
  })

  it('does not continue lists inside code', () => {
    const edit = breakLine(linesOf('```\n- a'), 1, { start: 3, end: 3 }, () => 'new')
    expect(fromLines(edit.lines)).toBe('```\n- a\n')
  })
})

describe('formatLineBlock', () => {
  it('toggles a block marker and keeps the caret on the text', () => {
    const edit = formatLineBlock(linesOf('leite'), 0, 'bullet', 2)
    expect(fromLines(edit.lines)).toBe('- leite')
    expect(edit.focus.caret).toBe(4)
    expect(fromLines(formatLineBlock(edit.lines, 0, 'bullet', 4).lines)).toBe('leite')
  })

  it('numbers after the previous ordered line', () => {
    expect(fromLines(formatLineBlock(linesOf('1. a\nb'), 1, 'ordered', 0).lines)).toBe('1. a\n2. b')
  })

  it('turns an item into a plain block', () => {
    expect(fromLines(formatLineBlock(linesOf('- [x] a'), 0, 'heading', 0).lines)).toBe('# a')
  })
})

describe('toggleCodeFence', () => {
  it('wraps the line in a fence and unwraps it again', () => {
    const fenced = toggleCodeFence(linesOf('a'), 0, 1, idSequence())
    expect(fromLines(fenced.lines)).toBe('```\na\n```')
    expect(fromLines(toggleCodeFence(fenced.lines, 1, 1, idSequence()).lines)).toBe('a')
  })
})

describe('joinWithPrevious', () => {
  it('turns an item into text before merging', () => {
    expect(fromLines(joinWithPrevious(linesOf('a\n- [ ] leite'), 1)?.lines ?? [])).toBe('a\nleite')
  })

  it('merges a text line into the previous line', () => {
    const edit = joinWithPrevious(linesOf('- [ ] lei\nte'), 1)
    expect(fromLines(edit?.lines ?? [])).toBe('- [ ] leite')
    expect(edit?.focus).toEqual({ id: 'line-0', caret: 3 })
  })

  it('does nothing on the first text line', () => {
    expect(joinWithPrevious(linesOf('Mercado'), 0)).toBeNull()
  })
})

describe('joinWithNext', () => {
  it('merges the next line into the current one', () => {
    expect(fromLines(joinWithNext(linesOf('lei\n- [ ] te'), 0)?.lines ?? [])).toBe('leite')
    expect(joinWithNext(linesOf('fim'), 0)).toBeNull()
  })
})

describe('pasteLines', () => {
  it('spreads pasted lines and keeps checklist kind', () => {
    const edit = pasteLines(linesOf('- [ ] café'), 0, { start: 0, end: 0 }, 'leite\r\npão\n- [x] ovos', () => 'new')
    expect(fromLines(edit.lines)).toBe('- [ ] leite\n- [ ] pão\n- [x] ovoscafé')
    expect(edit.focus).toEqual({ id: 'new', caret: 4 })
  })
})

describe('toggles', () => {
  it('switches a line between text and item', () => {
    const lines = linesOf('leite')
    const asItem = toggleLineKind(lines, 0).lines
    expect(fromLines(asItem)).toBe('- [ ] leite')
    expect(fromLines(toggleLineKind(asItem, 0).lines)).toBe('leite')
  })

  it('turns a whole list into a checklist and back', () => {
    const lines = linesOf('Compras\n- pão\n- leite\n\nfim')
    const asItems = toggleLineKind(lines, 2)
    expect(fromLines(asItems.lines)).toBe('Compras\n- [ ] pão\n- [ ] leite\n\nfim')
    expect(asItems.focus).toEqual({ id: 'line-2', caret: 5 })
    expect(fromLines(convertListBlock(asItems.lines, 1, 'ordered')!.lines)).toBe('Compras\n1. pão\n2. leite\n\nfim')
  })

  it('leaves lines that are not lists to the regular toggles', () => {
    expect(convertListBlock(linesOf('leite'), 0, 'item')).toBeNull()
    expect(convertListBlock(linesOf('- [ ] leite'), 0, 'item')).toBeNull()
    expect(convertListBlock(linesOf('```\n- a\n```'), 1, 'item')).toBeNull()
  })

  it('checks items and ignores text lines', () => {
    expect(fromLines(toggleLineChecked(linesOf('- [ ] leite'), 0))).toBe('- [x] leite')
    const text = linesOf('leite')
    expect(toggleLineChecked(text, 0)).toBe(text)
  })
})

describe('multi-line selection', () => {
  const lines = linesOf('- [ ] leite\n- [x] pão\ncafé')

  it('copies partial and whole lines keeping item markers', () => {
    const selection = { anchor: { index: 2, offset: 2 }, focus: { index: 0, offset: 0 } }
    expect(selectedText(lines, selection)).toBe('- [ ] leite\n- [x] pão\nca')
  })

  it('omits the marker when an item is partially selected', () => {
    const selection = { anchor: { index: 0, offset: 2 }, focus: { index: 1, offset: 1 } }
    expect(selectedText(lines, selection)).toBe('ite\n- [x] p')
  })

  it('selects every line', () => {
    expect(selectAllLines(lines)).toEqual({ anchor: { index: 0, offset: 0 }, focus: { index: 2, offset: 4 } })
  })

  it('describes the selected span of each line', () => {
    const selection = { anchor: { index: 0, offset: 2 }, focus: { index: 1, offset: 1 } }
    expect(lineSpan(selection, 0, 5)).toEqual({ from: 2, to: 5, lineBreak: true })
    expect(lineSpan(selection, 1, 3)).toEqual({ from: 0, to: 1, lineBreak: false })
    expect(lineSpan(selection, 2, 4)).toBeNull()
  })

  it('replaces a partial selection keeping the first line kind', () => {
    const selection = { anchor: { index: 0, offset: 2 }, focus: { index: 2, offset: 2 } }
    const edit = replaceSelection(lines, selection, 'X', () => 'new')
    expect(fromLines(edit.lines)).toBe('- [ ] leXfé')
    expect(edit.focus).toEqual({ id: lines[0].id, caret: 3 })
  })

  it('clears everything into a plain line', () => {
    const edit = replaceSelection(lines, selectAllLines(lines), '', () => 'new')
    expect(fromLines(edit.lines)).toBe('')
    expect(edit.lines).toHaveLength(1)
  })

  it('pastes multiple lines over the selection', () => {
    const selection = { anchor: { index: 1, offset: 0 }, focus: { index: 2, offset: 4 } }
    const edit = replaceSelection(lines, selection, 'a\nb', idSequence())
    expect(fromLines(edit.lines)).toBe('- [ ] leite\na\nb')
  })

  it('extends the focus across lines', () => {
    const selection = { anchor: { index: 0, offset: 3 }, focus: { index: 0, offset: 5 } }
    expect(extendSelection(lines, selection, 'ArrowDown').focus).toEqual({ index: 1, offset: 3 })
    expect(extendSelection(lines, selection, 'ArrowRight').focus).toEqual({ index: 1, offset: 0 })
    expect(extendSelection(lines, { ...selection, focus: { index: 1, offset: 0 } }, 'ArrowLeft').focus).toEqual({
      index: 0,
      offset: 5,
    })
  })
})
