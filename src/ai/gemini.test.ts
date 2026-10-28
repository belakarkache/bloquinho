import { describe, expect, it, vi } from 'vitest'
import { CARD_TITLE_MAX_LENGTH } from '../kanban/types'
import { GEMINI_MODELS, GeminiError, parseSuggestions, splitNoteIntoTasks, verifyGeminiKey } from './gemini'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function generated(text: string, extra: Record<string, unknown> = {}) {
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, ...extra }] }
}

async function kindOf(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(GeminiError)
  return (error as GeminiError).kind
}

describe('verifyGeminiKey', () => {
  it('sends the key in a header and never in the url', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { name: `models/${GEMINI_MODELS[0]}` }))
    await verifyGeminiKey('  secret  ', undefined, fetchFn)
    const [url, init] = fetchFn.mock.calls[0]
    expect(String(url)).not.toContain('secret')
    expect(String(url)).toContain(GEMINI_MODELS[0])
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('secret')
  })

  it('maps api errors to kinds', async () => {
    const invalid = { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }
    const cases: [Response, string][] = [
      [jsonResponse(400, invalid), 'invalidKey'],
      [jsonResponse(403, { error: { status: 'PERMISSION_DENIED' } }), 'permission'],
      [jsonResponse(429, {}), 'quota'],
      [jsonResponse(400, { error: { status: 'FAILED_PRECONDITION' } }), 'region'],
      [jsonResponse(503, {}), 'unavailable'],
    ]
    for (const [response, kind] of cases) {
      expect(await kindOf(verifyGeminiKey('key', undefined, vi.fn<typeof fetch>().mockResolvedValue(response)))).toBe(kind)
    }
  })

  it('reports network failures and keeps aborts', async () => {
    expect(await kindOf(verifyGeminiKey('key', undefined, vi.fn<typeof fetch>().mockRejectedValue(new TypeError())))).toBe(
      'network',
    )
    const abort = new DOMException('aborted', 'AbortError')
    await expect(verifyGeminiKey('key', undefined, vi.fn<typeof fetch>().mockRejectedValue(abort))).rejects.toBe(abort)
  })
})

describe('parseSuggestions', () => {
  it('trims, clips and drops tasks without a title', () => {
    const tasks = parseSuggestions(
      JSON.stringify({
        tasks: [
          { title: '  Comprar pão ', description: ' ', folder: ' Casa ', sourceExcerpt: '- pão' },
          { title: '', description: 'x', folder: null, sourceExcerpt: '' },
          { title: 'a'.repeat(500), description: 'b', folder: '', sourceExcerpt: 'c' },
        ],
      }),
    )
    expect(tasks).toEqual([
      { title: 'Comprar pão', description: '', folder: 'Casa', sourceExcerpt: '- pão' },
      { title: 'a'.repeat(CARD_TITLE_MAX_LENGTH), description: 'b', folder: null, sourceExcerpt: 'c' },
    ])
  })

  it('rejects malformed output', () => {
    expect(() => parseSuggestions('not json')).toThrow(GeminiError)
    expect(() => parseSuggestions('{"items":[]}')).toThrow(GeminiError)
  })
})

describe('splitNoteIntoTasks', () => {
  it('posts the note as user content with a json schema', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, generated('{"tasks":[{"title":"Ligar","description":"","folder":null,"sourceExcerpt":"ligar"}]}')))
    const tasks = await splitNoteIntoTasks('key', 'ligar pro médico', undefined, fetchFn)
    expect(tasks).toEqual([{ title: 'Ligar', description: '', folder: null, sourceExcerpt: 'ligar' }])
    const [url, init] = fetchFn.mock.calls[0]
    expect(String(url)).toContain(`${GEMINI_MODELS[0]}:generateContent`)
    const body = JSON.parse(String(init?.body))
    expect(body.contents[0].parts[0].text).toBe('ligar pro médico')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
  })

  it('falls back to the next model when one is overloaded or out of quota', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(503, { error: { status: 'UNAVAILABLE' } }))
      .mockResolvedValueOnce(jsonResponse(200, generated('{"tasks":[]}')))
    expect(await splitNoteIntoTasks('key', 'nota', undefined, fetchFn)).toEqual([])
    expect(String(fetchFn.mock.calls[1][0])).toContain(`${GEMINI_MODELS[1]}:generateContent`)

    const allBusy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
    expect(await kindOf(splitNoteIntoTasks('key', 'nota', undefined, allBusy))).toBe('unavailable')
  })

  it('does not fall back on key errors', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(403, {}))
    expect(await kindOf(splitNoteIntoTasks('key', 'nota', undefined, fetchFn))).toBe('permission')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('ignores thought parts', async () => {
    const response = {
      candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"tasks":[]}' }] } }],
    }
    expect(await splitNoteIntoTasks('key', 'nota', undefined, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, response)))).toEqual([])
  })

  it('reports blocked and empty responses', async () => {
    const blocked = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }))
    expect(await kindOf(splitNoteIntoTasks('key', 'nota', undefined, blocked))).toBe('blocked')
    const empty = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { candidates: [] }))
    expect(await kindOf(splitNoteIntoTasks('key', 'nota', undefined, empty))).toBe('badResponse')
  })
})
