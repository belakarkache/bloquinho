import { StateField, type EditorState, type Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { parseItem } from '../notes/checklist'
import { classifyLine, fenceStates } from '../notes/markdown'
import { inlineSpans, type InlineSpan, type SpanKind } from './inlineSpans'

export const EMPTY_ITEM_PHRASE = 'Empty item'

const HEADING_SIZES = ['', 'text-[1.3em] leading-snug', 'text-[1.15em] leading-snug', 'text-[1.05em]']
const CODE_LINE = 'md-code bg-ink/6 font-mono text-[0.88em]'
const ITEM_LINE = 'md-item'
const CHECKED_LINE = 'text-ink-faint line-through'
const FAUX_BOLD = '[-webkit-text-stroke:0.04em_currentColor]'
const SPAN_CLASSES: Record<SpanKind, string> = {
  marker: 'text-ink-faint',
  strong: FAUX_BOLD,
  em: 'italic',
  strike: 'line-through',
  code: 'rounded-sm bg-ink/8',
  link: 'underline decoration-ink/35',
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const BOX_PATHS = {
  unchecked: 'M208,28H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28Zm-4,176H52V52H204Z',
  checked:
    'M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm-34.34,77.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z',
}

export interface LineLayout {
  lineClass: string
  item: { checked: boolean; label: string; prefix: number } | null
  bodyStart: number
  spans: InlineSpan[]
  bodySpanClass: string
}

export function lineLayout(text: string, insideCode: boolean): LineLayout {
  const layout: LineLayout = { lineClass: '', item: null, bodyStart: 0, spans: [], bodySpanClass: '' }
  if (insideCode) return { ...layout, lineClass: CODE_LINE }
  const item = parseItem(text)
  if (item) {
    const prefix = text.length - item.text.length
    return {
      ...layout,
      lineClass: item.checked ? `${ITEM_LINE} ${CHECKED_LINE}` : ITEM_LINE,
      item: { checked: item.checked, label: item.text, prefix },
      bodyStart: prefix,
      spans: inlineSpans(item.text, prefix),
    }
  }
  const kind = classifyLine(text)
  if (kind.kind === 'fence') return { ...layout, lineClass: CODE_LINE, spans: [{ kind: 'marker', from: 0, to: text.length }] }
  const start = kind.marker.length
  const markerSpans: InlineSpan[] = start > 0 ? [{ kind: 'marker', from: 0, to: start }] : []
  return {
    ...layout,
    lineClass: kind.kind === 'heading' ? HEADING_SIZES[kind.level] : '',
    bodyStart: start,
    spans: [...markerSpans, ...inlineSpans(kind.text, start)],
    bodySpanClass: kind.kind === 'heading' ? FAUX_BOLD : '',
  }
}

export function documentLayouts(state: EditorState): LineLayout[] {
  const texts = Array.from({ length: state.doc.lines }, (_, index) => state.doc.line(index + 1).text)
  const insideCode = fenceStates(texts)
  return texts.map((text, index) => lineLayout(text, insideCode[index]))
}

function svgBox(checked: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 256 256')
  svg.setAttribute('width', '18')
  svg.setAttribute('height', '18')
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', checked ? BOX_PATHS.checked : BOX_PATHS.unchecked)
  svg.append(path)
  return svg
}

export function toggleItemAt(view: EditorView, position: number): void {
  const line = view.state.doc.lineAt(position)
  const item = parseItem(line.text)
  if (!item) return
  view.dispatch({ changes: { from: line.from + 3, to: line.from + 4, insert: item.checked ? ' ' : 'x' } })
}

class CheckboxWidget extends WidgetType {
  readonly checked: boolean
  readonly label: string

  constructor(checked: boolean, label: string) {
    super()
    this.checked = checked
    this.label = label
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.label === this.label
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('span')
    wrapper.className = 'inline-flex w-[1.75em] indent-0 align-top no-underline'
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('role', 'checkbox')
    button.setAttribute('aria-checked', String(this.checked))
    button.setAttribute('aria-label', this.label)
    button.className =
      'inline-flex h-[1.625em] items-center rounded-md px-0.5 text-ink-soft transition-colors hover:text-ink'
    button.append(svgBox(this.checked))
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => toggleItemAt(view, view.posAtDOM(wrapper)))
    wrapper.append(button)
    return wrapper
  }

  ignoreEvent() {
    return true
  }
}

interface MarkdownDecorations {
  decorations: DecorationSet
  checkboxes: DecorationSet
}

function buildDecorations(state: EditorState): MarkdownDecorations {
  const ranges: Range<Decoration>[] = []
  const checkboxes: Range<Decoration>[] = []
  const emptyLabel = state.phrase(EMPTY_ITEM_PHRASE)
  documentLayouts(state).forEach((layout, index) => {
    const line = state.doc.line(index + 1)
    if (layout.lineClass) ranges.push(Decoration.line({ class: layout.lineClass }).range(line.from))
    if (layout.item) {
      const widget = new CheckboxWidget(layout.item.checked, layout.item.label || emptyLabel)
      checkboxes.push(Decoration.replace({ widget }).range(line.from, line.from + layout.item.prefix))
    }
    if (layout.bodySpanClass && line.length > layout.bodyStart) {
      ranges.push(Decoration.mark({ class: layout.bodySpanClass }).range(line.from + layout.bodyStart, line.to))
    }
    for (const span of layout.spans) {
      if (span.from === span.to) continue
      const attributes = span.href ? { 'data-href': span.href } : undefined
      ranges.push(
        Decoration.mark({ class: SPAN_CLASSES[span.kind], attributes }).range(line.from + span.from, line.from + span.to),
      )
    }
  })
  return { decorations: Decoration.set([...ranges, ...checkboxes], true), checkboxes: Decoration.set(checkboxes) }
}

export const markdownDecorations = StateField.define<MarkdownDecorations>({
  create: buildDecorations,
  update: (value, transaction) =>
    transaction.docChanged || transaction.reconfigured ? buildDecorations(transaction.state) : value,
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).checkboxes),
  ],
})

export function linkAt(state: EditorState, position: number) {
  const line = state.doc.lineAt(position)
  const layout = documentLayouts(state)[line.number - 1]
  const offset = position - line.from
  const span = layout.spans.find((candidate) => candidate.href && candidate.from <= offset && offset <= candidate.to)
  return span?.href ? { href: span.href, line: line.number - 1, linkIndex: span.linkIndex } : null
}
