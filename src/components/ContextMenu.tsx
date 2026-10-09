import { CheckIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { NOTE_COLORS } from '../notes/types'
import {
  ContextMenuContext,
  type MenuAction,
  type MenuColorRow,
  type MenuEntry,
  type MenuGroup,
  type MenuIconRow,
  type OpenContextMenu,
} from './contextMenu'

const VIEWPORT_MARGIN = 8
const CURSOR_OFFSET = 2
const RIGHT_RELEASE_DELAY_MS = 250
const CLICK_SWALLOW_MS = 600
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])
const ARROW_STEPS: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

interface OpenMenu {
  id: number
  x: number
  y: number
  groups: MenuGroup[]
  openedAt: number
}

interface Cell {
  disabled: boolean
  select: () => void
}

interface Placement {
  left: number
  top: number
  origin: string
}

function isTouch(event: globalThis.MouseEvent): boolean {
  return 'pointerType' in event && event.pointerType === 'touch'
}

function anchorPoint(event: MouseEvent): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY }
  const rect = (event.target as Element).getBoundingClientRect()
  return { x: rect.left, y: rect.bottom }
}

function topLayerHost(): Element {
  const dialogs = document.querySelectorAll('dialog[open]')
  return dialogs[dialogs.length - 1] ?? document.body
}

function swallowNextClick(): void {
  const swallow = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), CLICK_SWALLOW_MS)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function placeWithinViewport(panel: HTMLElement, x: number, y: number): Placement {
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const flipX = x + CURSOR_OFFSET + width + VIEWPORT_MARGIN > window.innerWidth
  const flipY = y + CURSOR_OFFSET + height + VIEWPORT_MARGIN > window.innerHeight
  const left = flipX ? x - CURSOR_OFFSET - width : x + CURSOR_OFFSET
  const top = flipY ? y - CURSOR_OFFSET - height : y + CURSOR_OFFSET
  return {
    left: clamp(left, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    top: clamp(top, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
    origin: `${flipX ? 'right' : 'left'} ${flipY ? 'bottom' : 'top'}`,
  }
}

function cellsOf(groups: MenuGroup[]): Cell[] {
  return groups.flat().flatMap((entry): Cell[] => {
    switch (entry.kind) {
      case 'action':
        return [{ disabled: entry.disabled === true, select: entry.onSelect }]
      case 'icons':
        return entry.items.map((item) => ({ disabled: false, select: item.onSelect }))
      case 'colors':
        return NOTE_COLORS.map((color) => ({ disabled: false, select: () => entry.onSelect(color) }))
      case 'caption':
        return []
    }
  })
}

function cellCount(entry: MenuEntry): number {
  if (entry.kind === 'action') return 1
  if (entry.kind === 'icons') return entry.items.length
  if (entry.kind === 'colors') return NOTE_COLORS.length
  return 0
}

function cellStarts(groups: MenuGroup[]): number[][] {
  let next = 0
  return groups.map((group) =>
    group.map((entry) => {
      const start = next
      next += cellCount(entry)
      return start
    }),
  )
}

function nextEnabled(cells: Cell[], from: number, step: number): number {
  for (let offset = 1; offset <= cells.length; offset += 1) {
    const index = (from + step * offset + cells.length * offset) % cells.length
    if (!cells[index].disabled) return index
  }
  return -1
}

interface CellHandlers {
  active: number
  onHover: (index: number) => void
  onChoose: (index: number) => void
  onRelease: (index: number, button: number) => void
}

function cellProps(index: number, { onHover, onChoose, onRelease }: CellHandlers) {
  return {
    tabIndex: -1,
    onPointerMove: () => onHover(index),
    onClick: () => onChoose(index),
    onPointerUp: (event: { button: number }) => onRelease(index, event.button),
  }
}

function ActionRow({ entry, index, handlers }: { entry: MenuAction; index: number; handlers: CellHandlers }) {
  const { icon: ActionIcon, label, shortcut, danger, disabled, checked } = entry
  const active = handlers.active === index
  const tone = disabled
    ? 'text-ink-faint'
    : danger
      ? `text-danger ${active ? 'bg-danger/10' : ''}`
      : `text-ink ${active ? 'bg-ink/8' : ''}`
  return (
    <div
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      aria-disabled={disabled}
      aria-keyshortcuts={shortcut}
      {...cellProps(index, handlers)}
      className={`flex h-9 cursor-default items-center gap-2.5 rounded-xl pr-2.5 pl-2 text-[13.5px] font-medium ${tone}`}
    >
      <ActionIcon size={17} weight="bold" className={danger || disabled ? '' : 'text-ink-soft'} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {checked && <CheckIcon size={15} weight="bold" />}
      {shortcut && (
        <kbd aria-hidden="true" className="ml-5 font-sans text-xs text-ink-faint">
          {shortcut}
        </kbd>
      )}
    </div>
  )
}

function IconRow({ entry, start, handlers }: { entry: MenuIconRow; start: number; handlers: CellHandlers }) {
  return (
    <div role="group" aria-label={entry.label} className="flex items-center gap-0.5 px-0.5 py-0.5">
      {entry.items.map(({ label, icon: ItemIcon }, offset) => (
        <div
          key={label}
          role="menuitem"
          aria-label={label}
          title={label}
          {...cellProps(start + offset, handlers)}
          className={`flex size-9 flex-1 cursor-default items-center justify-center rounded-xl ${handlers.active === start + offset ? 'bg-ink/8 text-ink' : 'text-ink-soft'}`}
        >
          <ItemIcon size={17} weight="bold" />
        </div>
      ))}
    </div>
  )
}

function ColorRow({ entry, start, handlers }: { entry: MenuColorRow; start: number; handlers: CellHandlers }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={entry.label} className="flex items-center gap-0.5 px-0.5 py-0.5">
      {NOTE_COLORS.map((color, offset) => {
        const selected = entry.value === color
        const active = handlers.active === start + offset
        return (
          <div
            key={color}
            role="menuitemradio"
            aria-checked={selected}
            aria-label={t(`colors.${color}`)}
            title={t(`colors.${color}`)}
            {...cellProps(start + offset, handlers)}
            className="flex size-7 cursor-default items-center justify-center"
          >
            <span
              data-color={color}
              className={`note-swatch flex size-5.5 items-center justify-center rounded-full border-2 transition-transform duration-150 ease-(--ease-out-soft) ${color === 'default' ? 'text-ink' : 'text-on-brand'} ${selected ? 'border-ink' : 'border-ink/15'} ${active ? 'scale-115' : ''}`}
            >
              {selected && <CheckIcon size={11} weight="bold" />}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MenuPanel({ menu, onClose }: { menu: OpenMenu; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [active, setActive] = useState(-1)
  const cells = cellsOf(menu.groups)

  useLayoutEffect(() => {
    if (panelRef.current) setPlacement(placeWithinViewport(panelRef.current, menu.x, menu.y))
  }, [menu])

  const choose = (index: number) => {
    const cell = cells[index]
    if (!cell || cell.disabled) return
    onClose()
    cell.select()
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (MODIFIER_KEYS.has(event.key)) return
    const step = ARROW_STEPS[event.key]
    if (step) setActive(nextEnabled(cells, active === -1 && step < 0 ? 0 : active, step))
    else if (event.key === 'Home') setActive(nextEnabled(cells, -1, 1))
    else if (event.key === 'End') setActive(nextEnabled(cells, 0, -1))
    else if (event.key === 'Enter') {
      if (active === -1) onClose()
      else choose(active)
    } else if (event.key === 'Escape') onClose()
    else {
      onClose()
      return
    }
    event.preventDefault()
    event.stopPropagation()
  })

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (panelRef.current?.contains(event.target as Node)) return
    onClose()
    if (event.button === 0) swallowNextClick()
  })

  const dismiss = useEffectEvent(() => onClose())

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => onKeyDown(event)
    const pointerDown = (event: PointerEvent) => onPointerDown(event)
    const close = () => dismiss()
    window.addEventListener('keydown', keyDown, true)
    window.addEventListener('pointerdown', pointerDown, true)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('keydown', keyDown, true)
      window.removeEventListener('pointerdown', pointerDown, true)
      window.removeEventListener('wheel', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [])

  const handlers: CellHandlers = {
    active,
    onHover: setActive,
    onChoose: choose,
    onRelease: (index, button) => {
      if (button === 2 && performance.now() - menu.openedAt > RIGHT_RELEASE_DELAY_MS) choose(index)
    },
  }

  const starts = cellStarts(menu.groups)

  return (
    <motion.div
      ref={panelRef}
      role="menu"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      onMouseDown={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerLeave={() => setActive(-1)}
      style={{
        left: placement?.left ?? menu.x,
        top: placement?.top ?? menu.y,
        transformOrigin: placement?.origin,
        visibility: placement ? 'visible' : 'hidden',
      }}
      className="fixed z-50 m-0 max-w-[min(20rem,calc(100vw-1rem))] min-w-56 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[0_18px_44px_-14px_rgb(var(--shadow-ink)/0.45),0_2px_6px_-2px_rgb(var(--shadow-ink)/0.12)] select-none"
    >
      {menu.groups.map((group, groupIndex) => (
        <div key={groupIndex} role="group">
          {groupIndex > 0 && <div role="separator" className="mx-2 my-1 h-px bg-line" />}
          {group.map((entry, entryIndex) => {
            switch (entry.kind) {
              case 'caption':
                return (
                  <p key={entryIndex} className="truncate px-2.5 pt-1 pb-1.5 text-xs text-ink-faint">
                    {entry.text}
                  </p>
                )
              case 'action':
                return (
                  <ActionRow
                    key={entryIndex}
                    entry={entry}
                    index={starts[groupIndex][entryIndex]}
                    handlers={handlers}
                  />
                )
              case 'icons':
                return (
                  <IconRow key={entryIndex} entry={entry} start={starts[groupIndex][entryIndex]} handlers={handlers} />
                )
              case 'colors':
                return (
                  <ColorRow key={entryIndex} entry={entry} start={starts[groupIndex][entryIndex]} handlers={handlers} />
                )
            }
          })}
        </div>
      ))}
    </motion.div>
  )
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [host, setHost] = useState<Element | null>(null)
  const nextId = useRef(0)
  const close = useCallback(() => setMenu(null), [])

  const open = useCallback<OpenContextMenu>((event, groups) => {
    if (event.shiftKey || isTouch(event.nativeEvent)) return
    event.preventDefault()
    event.stopPropagation()
    const visible = groups.filter((group) => group.length > 0)
    if (visible.length === 0) {
      setMenu(null)
      return
    }
    nextId.current += 1
    setHost(topLayerHost())
    setMenu({ id: nextId.current, ...anchorPoint(event), groups: visible, openedAt: performance.now() })
  }, [])

  useEffect(() => {
    const blockNativeMenu = (event: globalThis.MouseEvent) => {
      if (!event.shiftKey && !isTouch(event)) event.preventDefault()
    }
    document.addEventListener('contextmenu', blockNativeMenu)
    return () => document.removeEventListener('contextmenu', blockNativeMenu)
  }, [])

  return (
    <ContextMenuContext value={open}>
      {children}
      {host &&
        createPortal(
          <AnimatePresence>{menu && <MenuPanel key={menu.id} menu={menu} onClose={close} />}</AnimatePresence>,
          host,
        )}
    </ContextMenuContext>
  )
}
