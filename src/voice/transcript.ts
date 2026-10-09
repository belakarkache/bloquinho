const SENTENCE_END = /(^|[.!?…:]|\n)\s*$/
const STARTS_WITH_SPACE_OR_PUNCTUATION = /^[\s.,;:!?…)\]]/

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

export function transcriptInsertion(before: string, after: string, transcript: string): string | null {
  const words = transcript.trim().replace(/\s+/g, ' ')
  if (words === '') return null
  const text = SENTENCE_END.test(before) ? capitalize(words) : words
  const leading = before === '' || /\s$/.test(before) ? '' : ' '
  const trailing = after === '' || STARTS_WITH_SPACE_OR_PUNCTUATION.test(after) ? '' : ' '
  return leading + text + trailing
}

export interface TextInsertion {
  content: string
  caret: number
}

export function insertTranscript(
  content: string,
  selection: { start: number; end: number },
  transcript: string,
): TextInsertion | null {
  const before = content.slice(0, selection.start)
  const after = content.slice(selection.end)
  const inserted = transcriptInsertion(before, after, transcript)
  if (inserted === null) return null
  return { content: before + inserted + after, caret: before.length + inserted.trimEnd().length }
}
