export type WhisperLanguage = 'portuguese' | 'english'

export type WhisperRequest =
  | { type: 'load'; id: number }
  | { type: 'transcribe'; id: number; audio: Float32Array; language: WhisperLanguage }

export type WhisperResponse =
  | { type: 'progress'; progress: number }
  | { type: 'loaded'; id: number }
  | { type: 'transcribed'; id: number; text: string }
  | { type: 'failed'; id: number; message: string }
