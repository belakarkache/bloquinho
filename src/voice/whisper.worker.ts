import { pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from '@huggingface/transformers'
import type { WhisperRequest, WhisperResponse } from './whisperMessages'

const MODEL_ID = 'onnx-community/whisper-base'

let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null

const reply = (response: WhisperResponse, transfer: Transferable[] = []) => self.postMessage(response, { transfer })

function reportProgress(info: ProgressInfo) {
  if (info.status === 'progress_total') reply({ type: 'progress', progress: info.progress })
}

function loadTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  transcriber ??= pipeline('automatic-speech-recognition', MODEL_ID, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: reportProgress,
  }).catch((error: unknown) => {
    transcriber = null
    throw error
  })
  return transcriber
}

async function handle(request: WhisperRequest) {
  try {
    const transcribe = await loadTranscriber()
    if (request.type === 'load') {
      reply({ type: 'loaded', id: request.id })
      return
    }
    const output = await transcribe(request.audio, {
      language: request.language,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    })
    reply({ type: 'transcribed', id: request.id, text: output.text })
  } catch (error) {
    reply({ type: 'failed', id: request.id, message: error instanceof Error ? error.message : String(error) })
  }
}

self.addEventListener('message', (event: MessageEvent<WhisperRequest>) => void handle(event.data))
