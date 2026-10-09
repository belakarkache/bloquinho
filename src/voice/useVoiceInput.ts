import { useMotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { currentLanguage } from '../i18n'
import { SpeechRecognitionFailure } from './speechRecognition'
import { chooseEngine, startVoiceSession, voiceInputSupported, type VoiceSession } from './voiceSession'
import {
  acceptWhisper,
  isWhisperAccepted,
  isWhisperLoaded,
  loadWhisper,
  onWhisperProgress,
  transcribeWithWhisper,
} from './whisper'

export type VoicePhase = 'idle' | 'holding' | 'locked' | 'transcribing'
export type VoiceNotice = 'permission' | 'noSpeech' | 'failed' | 'tooLong' | 'downloadFailed'
export type ModelDownload = { status: 'confirm' } | { status: 'loading'; progress: number } | null

const NOTICE_DURATION_MS = 4_000

const SPEECH_LANGUAGES = { pt: 'pt-BR', en: 'en-US' } as const
const WHISPER_LANGUAGES = { pt: 'portuguese', en: 'english' } as const

function noticeFor(error: unknown): VoiceNotice {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'permission'
  if (error instanceof SpeechRecognitionFailure && error.reason === 'not-allowed') return 'permission'
  return 'failed'
}

export function useVoiceInput(onTranscript: (text: string) => boolean) {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [preview, setPreview] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [notice, setNotice] = useState<VoiceNotice | null>(null)
  const [download, setDownload] = useState<ModelDownload>(null)
  const level = useMotionValue(0)
  const dragX = useMotionValue(0)
  const session = useRef<Promise<VoiceSession> | null>(null)
  const activeSession = useRef<VoiceSession | null>(null)
  const pendingAudio = useRef<Blob | null>(null)
  const deliver = useRef(onTranscript)
  const [supported] = useState(voiceInputSupported)
  const recording = phase === 'holding' || phase === 'locked'

  useLayoutEffect(() => {
    deliver.current = onTranscript
  })

  useEffect(
    () =>
      onWhisperProgress((progress) =>
        setDownload((current) => (current?.status === 'loading' ? { status: 'loading', progress } : current)),
      ),
    [],
  )

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!recording) return
    let frame = requestAnimationFrame(function sample() {
      level.set(activeSession.current?.level() ?? 0)
      frame = requestAnimationFrame(sample)
    })
    return () => {
      cancelAnimationFrame(frame)
      level.set(0)
    }
  }, [recording, level])

  useEffect(() => () => activeSession.current?.cancel(), [])

  const reset = () => {
    session.current = null
    activeSession.current = null
    dragX.set(0)
    setPreview('')
    setPhase('idle')
  }

  const fail = (error: unknown) => {
    reset()
    setNotice(noticeFor(error))
  }

  const ensureModel = async () => {
    if (isWhisperLoaded()) return
    setDownload({ status: 'loading', progress: 0 })
    try {
      await loadWhisper()
    } finally {
      setDownload(null)
    }
  }

  const insert = (text: string) => {
    reset()
    if (text.trim() === '') setNotice('noSpeech')
    else if (!deliver.current(text)) setNotice('tooLong')
  }

  const transcribeAudio = async (audio: Blob) => {
    if (!isWhisperAccepted()) {
      pendingAudio.current = audio
      reset()
      setDownload({ status: 'confirm' })
      return
    }
    setPhase('transcribing')
    try {
      await ensureModel()
      insert(await transcribeWithWhisper(audio, WHISPER_LANGUAGES[currentLanguage()]))
    } catch (error) {
      fail(error)
    }
  }

  const start = (mode: 'holding' | 'locked') => {
    if (phase !== 'idle' || download?.status === 'confirm') return
    const engine = chooseEngine()
    if (engine === 'whisper' && !isWhisperAccepted()) {
      setDownload({ status: 'confirm' })
      return
    }
    if (engine === 'whisper') void ensureModel().catch(() => setNotice('downloadFailed'))
    setNotice(null)
    setPreview('')
    setStartedAt(Date.now())
    setPhase(mode)
    const started = startVoiceSession(engine, SPEECH_LANGUAGES[currentLanguage()], setPreview)
    session.current = started
    started.then(
      (voiceSession) => {
        if (session.current === started) activeSession.current = voiceSession
        else voiceSession.cancel()
      },
      (error: unknown) => {
        if (session.current === started) fail(error)
      },
    )
  }

  const lock = () => {
    if (phase === 'holding') setPhase('locked')
  }

  const cancel = () => {
    activeSession.current?.cancel()
    reset()
  }

  const finish = async () => {
    const started = session.current
    if (!started || !recording) return
    setPhase('transcribing')
    try {
      const result = await (await started).finish()
      session.current = null
      activeSession.current = null
      if (result.kind === 'text') insert(result.text)
      else await transcribeAudio(result.audio)
    } catch (error) {
      fail(error)
    }
  }

  const confirmDownload = async () => {
    acceptWhisper()
    const audio = pendingAudio.current
    pendingAudio.current = null
    try {
      await ensureModel()
      if (audio) await transcribeAudio(audio)
    } catch {
      setNotice('downloadFailed')
    }
  }

  const declineDownload = () => {
    pendingAudio.current = null
    setDownload(null)
  }

  return {
    supported,
    phase,
    recording,
    preview,
    startedAt,
    level,
    dragX,
    notice,
    download,
    start,
    lock,
    cancel,
    finish,
    confirmDownload,
    declineDownload,
  }
}

export type VoiceInput = ReturnType<typeof useVoiceInput>
