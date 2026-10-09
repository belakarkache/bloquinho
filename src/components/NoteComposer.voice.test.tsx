import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteComposer } from './NoteComposer'

class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: { results: unknown }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  stopped = false
  aborted = false

  constructor() {
    FakeRecognition.instances.push(this)
  }

  start() {
    this.started = true
  }

  stop() {
    this.stopped = true
    queueMicrotask(() => this.onend?.())
  }

  abort() {
    this.aborted = true
    queueMicrotask(() => this.onend?.())
  }

  say(text: string) {
    const result = Object.assign([{ transcript: text }], { isFinal: false })
    this.onresult?.({ results: Object.assign([result], { length: 1 }) })
  }
}

function latestRecognition() {
  return FakeRecognition.instances[FakeRecognition.instances.length - 1]
}

function micButton() {
  return screen.getByRole('button', { name: 'Gravar por voz' })
}

function renderComposer() {
  const onCreate = vi.fn(() => Promise.resolve())
  render(<NoteComposer onCreate={onCreate} />)
  return screen.getByRole('textbox', { name: 'Anote algo…' })
}

describe('NoteComposer voice input', () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    Element.prototype.setPointerCapture ??= () => {}
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides the microphone when the browser cannot transcribe', () => {
    vi.unstubAllGlobals()
    renderComposer()
    expect(screen.queryByRole('button', { name: 'Gravar por voz' })).not.toBeInTheDocument()
  })

  it('transcribes into the note when the hold is released', async () => {
    const textarea = renderComposer()
    fireEvent.pointerDown(micButton(), { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    await act(async () => {})
    const recognition = latestRecognition()
    expect(recognition.lang).toBe('pt-BR')
    act(() => recognition.say('comprar pão'))
    expect(screen.getByText('comprar pão')).toBeInTheDocument()

    await act(() => new Promise((resolve) => setTimeout(resolve, 300)))
    fireEvent.pointerUp(micButton(), { pointerId: 1 })
    await act(async () => {})
    expect(recognition.stopped).toBe(true)
    expect(textarea).toHaveValue('Comprar pão')
  })

  it('locks on swipe up and transcribes when finished', async () => {
    const textarea = renderComposer()
    const button = micButton()
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    await act(async () => {})
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 100, clientY: 10 })
    fireEvent.pointerUp(button, { pointerId: 1 })
    expect(screen.getByRole('button', { name: 'Descartar gravação' })).toBeInTheDocument()
    act(() => latestRecognition().say('ligar para Ana'))

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Concluir gravação' }), { button: 0, pointerId: 2 })
    await act(async () => {})
    expect(textarea).toHaveValue('Ligar para Ana')
  })

  it('discards the recording when sliding left', async () => {
    const textarea = renderComposer()
    fireEvent.pointerDown(micButton(), { button: 0, pointerId: 1, clientX: 200, clientY: 100 })
    await act(async () => {})
    act(() => latestRecognition().say('não quero isso'))
    fireEvent.pointerMove(micButton(), { pointerId: 1, clientX: 50, clientY: 100 })
    fireEvent.pointerUp(micButton(), { pointerId: 1 })
    await act(async () => {})
    expect(latestRecognition().aborted).toBe(true)
    expect(textarea).toHaveValue('')
  })

  it('inserts at the caret of the focused note', async () => {
    const user = userEvent.setup()
    const textarea = renderComposer()
    await user.type(textarea, 'leite café')
    ;(textarea as HTMLTextAreaElement).setSelectionRange(6, 6)
    fireEvent.keyDown(micButton(), { key: 'Enter' })
    await act(async () => {})
    act(() => latestRecognition().say('pão'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Concluir gravação' }), { key: 'Enter' })
    await act(async () => {})
    expect(textarea).toHaveValue('leite pão café')
  })

  it('cancels with Escape', async () => {
    renderComposer()
    fireEvent.keyDown(micButton(), { key: 'Enter' })
    await act(async () => {})
    fireEvent.keyDown(window, { key: 'Escape' })
    await act(async () => {})
    expect(latestRecognition().aborted).toBe(true)
    expect(screen.queryByRole('button', { name: 'Descartar gravação' })).not.toBeInTheDocument()
  })
})
