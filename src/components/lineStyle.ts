import { classifyLine } from '../notes/markdown'

const HEADING_SIZES = ['', 'text-[1.3em] leading-snug', 'text-[1.15em] leading-snug', 'text-[1.05em]']
const CODE_LINE = 'bg-ink/6 px-3 font-mono text-[0.88em]'

export function lineStyle(text: string, insideCode: boolean): string {
  if (insideCode) return CODE_LINE
  const kind = classifyLine(text)
  if (kind.kind === 'fence') return CODE_LINE
  return kind.kind === 'heading' ? HEADING_SIZES[kind.level] : ''
}
