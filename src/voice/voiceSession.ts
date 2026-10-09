import { canCaptureAudio, captureAudio, openMicrophone, type AudioCapture } from './audioCapture'
import { canRecognizeSpeech, SpeechRecognitionFailure, startSpeechRecognition } from './speechRecognition'
import { canUseWhisper } from './whisper'

export type VoiceEngine = 'speech' | 'whisper'

export type VoiceResult = { kind: 'text'; text: string } | { kind: 'audio'; audio: Blob }

export interface VoiceSession {
  level: () => number
  finish: () => Promise<VoiceResult>
  cancel: () => void
}

const SOLO_MIC_KEY = 'bloquinho:speech-solo-mic'

let speechOffline = false
let speechUnavailable = false

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    speechOffline = false
  })
}

function usesSoloMic(): boolean {
  try {
    return localStorage.getItem(SOLO_MIC_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberSoloMic() {
  try {
    localStorage.setItem(SOLO_MIC_KEY, 'true')
  } catch {
    return
  }
}

function speechUsable(): boolean {
  return canRecognizeSpeech() && navigator.onLine && !speechOffline && !speechUnavailable
}

export function voiceInputSupported(): boolean {
  return canRecognizeSpeech() || canUseWhisper()
}

export function chooseEngine(): VoiceEngine {
  return speechUsable() || !canUseWhisper() ? 'speech' : 'whisper'
}

function rememberSpeechFailure(failure: SpeechRecognitionFailure, hadBackup: boolean) {
  if (failure.reason === 'network') speechOffline = true
  if (failure.reason === 'unavailable') speechUnavailable = true
  if (failure.reason === 'audio-capture' && hadBackup) rememberSoloMic()
}

async function openBackupCapture(): Promise<AudioCapture | null> {
  if (!canCaptureAudio() || usesSoloMic()) return null
  try {
    return captureAudio(await openMicrophone())
  } catch {
    return null
  }
}

async function startSpeechSession(lang: string, onText: (text: string) => void): Promise<VoiceSession> {
  const backup = await openBackupCapture()
  const speech = startSpeechRecognition({ lang, onText })

  const finish = async (): Promise<VoiceResult> => {
    const audio = backup?.stop()
    try {
      const text = await speech.stop()
      return { kind: 'text', text }
    } catch (error) {
      if (!(error instanceof SpeechRecognitionFailure)) throw error
      rememberSpeechFailure(error, backup !== null)
      if (!audio || !canUseWhisper() || error.reason === 'not-allowed') throw error
      return { kind: 'audio', audio: await audio }
    }
  }

  return {
    level: () => backup?.level() ?? 0,
    finish,
    cancel: () => {
      speech.abort()
      backup?.cancel()
    },
  }
}

async function startWhisperSession(): Promise<VoiceSession> {
  const capture = captureAudio(await openMicrophone())
  return {
    level: capture.level,
    finish: async () => ({ kind: 'audio', audio: await capture.stop() }),
    cancel: capture.cancel,
  }
}

export function startVoiceSession(
  engine: VoiceEngine,
  lang: string,
  onText: (text: string) => void,
): Promise<VoiceSession> {
  return engine === 'speech' ? startSpeechSession(lang, onText) : startWhisperSession()
}
