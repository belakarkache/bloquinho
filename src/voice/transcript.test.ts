import { describe, expect, it } from 'vitest'
import { insertTranscript, transcriptInsertion } from './transcript'

describe('transcriptInsertion', () => {
  it('capitalizes the start of an empty note', () => {
    expect(transcriptInsertion('', '', ' comprar pão ')).toBe('Comprar pão')
  })

  it('adds a space after a word', () => {
    expect(transcriptInsertion('comprar', '', 'pão')).toBe(' pão')
  })

  it('capitalizes after the end of a sentence', () => {
    expect(transcriptInsertion('Comprar pão.', '', 'ligar para Ana')).toBe(' Ligar para Ana')
    expect(transcriptInsertion('Mercado\n', '', 'leite')).toBe('Leite')
  })

  it('separates the transcript from the text after the caret', () => {
    expect(transcriptInsertion('leite ', 'e café', 'pão')).toBe('pão ')
    expect(transcriptInsertion('leite ', ', café', 'pão')).toBe('pão')
  })

  it('collapses repeated whitespace', () => {
    expect(transcriptInsertion('', '', 'um   dois\tTrês')).toBe('Um dois Três')
  })

  it('ignores an empty transcript', () => {
    expect(transcriptInsertion('nota', '', '   ')).toBeNull()
  })
})

describe('insertTranscript', () => {
  it('inserts at the caret and places the caret after the transcript', () => {
    expect(insertTranscript('leite café', { start: 6, end: 6 }, 'pão')).toEqual({
      content: 'leite pão café',
      caret: 9,
    })
  })

  it('replaces the selection', () => {
    expect(insertTranscript('leite e café', { start: 6, end: 7 }, 'ou')).toEqual({
      content: 'leite ou café',
      caret: 8,
    })
  })

  it('appends at the end', () => {
    expect(insertTranscript('Mercado', { start: 7, end: 7 }, 'leite')).toEqual({
      content: 'Mercado leite',
      caret: 13,
    })
  })
})
