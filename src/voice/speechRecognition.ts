interface Recognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognizerConstructor = new () => Recognizer

type SpeechWindow = Window & {
  SpeechRecognition?: RecognizerConstructor
  webkitSpeechRecognition?: RecognizerConstructor
}

export type SpeechFailure = 'network' | 'unavailable' | 'not-allowed' | 'audio-capture' | 'other'

export class SpeechRecognitionFailure extends Error {
  readonly reason: SpeechFailure

  constructor(reason: SpeechFailure) {
    super(`Speech recognition failed: ${reason}`)
    this.reason = reason
  }
}

export interface SpeechSession {
  stop: () => Promise<string>
  abort: () => void
}

interface SpeechOptions {
  lang: string
  onText: (text: string) => void
}

const IGNORED_ERRORS = new Set(['no-speech', 'aborted'])

function recognizerConstructor(): RecognizerConstructor | undefined {
  const speechWindow = window as SpeechWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

export function canRecognizeSpeech(): boolean {
  return recognizerConstructor() !== undefined
}

function failureFrom(error: string): SpeechFailure {
  if (error === 'network') return 'network'
  if (error === 'service-not-allowed' || error === 'language-not-supported') return 'unavailable'
  if (error === 'not-allowed') return 'not-allowed'
  if (error === 'audio-capture') return 'audio-capture'
  return 'other'
}

function joinText(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

function resultsText(results: SpeechRecognitionResultList): string {
  const parts: string[] = []
  for (let index = 0; index < results.length; index++) parts.push(results[index][0].transcript)
  return joinText(...parts)
}

export function startSpeechRecognition({ lang, onText }: SpeechOptions): SpeechSession {
  const Recognizer = recognizerConstructor()
  if (!Recognizer) throw new SpeechRecognitionFailure('unavailable')

  let committed = ''
  let current = ''
  let stopping = false
  let failure: SpeechFailure | null = null
  let settle: { resolve: (text: string) => void; reject: (error: Error) => void } | null = null
  const finished = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject }
  })
  finished.catch(() => {})

  const finish = () => {
    if (failure) settle?.reject(new SpeechRecognitionFailure(failure))
    else settle?.resolve(committed)
  }

  const listen = (): Recognizer => {
    const recognizer = new Recognizer()
    recognizer.lang = lang
    recognizer.continuous = true
    recognizer.interimResults = true
    recognizer.onresult = (event) => {
      current = resultsText(event.results)
      onText(joinText(committed, current))
    }
    recognizer.onerror = (event) => {
      if (!IGNORED_ERRORS.has(event.error)) failure = failureFrom(event.error)
    }
    recognizer.onend = () => {
      committed = joinText(committed, current)
      current = ''
      if (stopping || failure) finish()
      else active = listen()
    }
    recognizer.start()
    return recognizer
  }

  let active = listen()

  return {
    stop: () => {
      stopping = true
      active.stop()
      return finished
    },
    abort: () => {
      stopping = true
      active.abort()
    },
  }
}
