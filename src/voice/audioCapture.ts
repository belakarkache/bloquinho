export const WHISPER_SAMPLE_RATE = 16_000

export interface AudioCapture {
  level: () => number
  stop: () => Promise<Blob>
  cancel: () => void
}

export function canCaptureAudio(): boolean {
  return typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

export function openMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
}

function levelMeter(stream: MediaStream) {
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  context.createMediaStreamSource(stream).connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  const level = () => {
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) sum += sample * sample
    return Math.min(1, Math.sqrt(sum / samples.length) * 4)
  }
  return { level, close: () => void context.close() }
}

export function captureAudio(stream: MediaStream): AudioCapture {
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => chunks.push(event.data))
  recorder.start()
  const meter = levelMeter(stream)

  const release = () => {
    meter.close()
    for (const track of stream.getTracks()) track.stop()
  }

  const stop = () =>
    new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          release()
          resolve(new Blob(chunks, { type: recorder.mimeType }))
        },
        { once: true },
      )
      if (recorder.state === 'inactive') recorder.dispatchEvent(new Event('stop'))
      else recorder.stop()
    })

  const cancel = () => {
    if (recorder.state !== 'inactive') recorder.stop()
    release()
  }

  return { level: meter.level, stop, cancel }
}

export async function decodeForWhisper(audio: Blob): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, 1, WHISPER_SAMPLE_RATE)
  const decoded = await context.decodeAudioData(await audio.arrayBuffer())
  return decoded.getChannelData(0)
}
