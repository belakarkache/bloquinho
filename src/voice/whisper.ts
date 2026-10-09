import { canCaptureAudio, decodeForWhisper } from './audioCapture'
import type { WhisperLanguage, WhisperRequest, WhisperResponse } from './whisperMessages'

export const WHISPER_DOWNLOAD_MB = 85

const ACCEPTED_KEY = 'bloquinho:whisper-accepted'

type PendingRequest = { resolve: (text: string) => void; reject: (error: Error) => void }
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

let worker: Worker | null = null
let nextId = 0
let loading: Promise<void> | null = null
let loaded = false
const pending = new Map<number, PendingRequest>()
const progressListeners = new Set<(progress: number) => void>()

export function canUseWhisper(): boolean {
  return (
    canCaptureAudio() &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof OfflineAudioContext !== 'undefined'
  )
}

export function isWhisperAccepted(): boolean {
  try {
    return localStorage.getItem(ACCEPTED_KEY) === 'true'
  } catch {
    return false
  }
}

export function acceptWhisper() {
  try {
    localStorage.setItem(ACCEPTED_KEY, 'true')
  } catch {
    return
  }
}

export function isWhisperLoaded(): boolean {
  return loaded
}

export function onWhisperProgress(listener: (progress: number) => void): () => void {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

function onResponse(response: WhisperResponse) {
  if (response.type === 'progress') {
    for (const listener of progressListeners) listener(response.progress)
    return
  }
  const request = pending.get(response.id)
  pending.delete(response.id)
  if (response.type === 'failed') request?.reject(new Error(response.message))
  else request?.resolve(response.type === 'transcribed' ? response.text : '')
}

function failAll(error: Error) {
  for (const request of pending.values()) request.reject(error)
  pending.clear()
  worker?.terminate()
  worker = null
  loading = null
  loaded = false
}

function whisperWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (event: MessageEvent<WhisperResponse>) => onResponse(event.data))
  worker.addEventListener('error', (event) => failAll(new Error(event.message)))
  return worker
}

function send(request: DistributiveOmit<WhisperRequest, 'id'>, transfer: Transferable[] = []): Promise<string> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    whisperWorker().postMessage({ ...request, id }, { transfer })
  })
}

export function loadWhisper(): Promise<void> {
  loading ??= send({ type: 'load' }).then(
    () => {
      loaded = true
    },
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}

export async function transcribeWithWhisper(audio: Blob, language: WhisperLanguage): Promise<string> {
  const samples = await decodeForWhisper(audio)
  await loadWhisper()
  return send({ type: 'transcribe', audio: samples, language }, [samples.buffer])
}
