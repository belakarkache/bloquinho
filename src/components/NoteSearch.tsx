import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { toNoteView, toPlainText } from '../notes/checklist'
import { plainInline } from '../notes/markdown'
import { filterNotes } from '../notes/filter'
import type { Note } from '../notes/types'
import { IconButton } from './IconButton'
import { ModalDialog } from './ModalDialog'
import { gentle, quickFade } from './motion'

const MAX_RESULTS = 8

export interface NoteSearchHandle {
  open: () => void
}

interface NoteSearchProps {
  notes: Note[]
  onOpen: (note: Note) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

function isOpenShortcut(event: globalThis.KeyboardEvent): boolean {
  if (document.querySelector('dialog[open]')) return false
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') return true
  return event.key === '/' && !isTypingTarget(event.target)
}

function findNotes(notes: Note[], query: string): Note[] {
  return filterNotes(notes, { query, color: null }).slice(0, MAX_RESULTS)
}

function summarize(note: Note): { title: string; snippet: string } {
  const lines = toPlainText(note.content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const title = plainInline(toNoteView(note.content).title) || lines[0] || ''
  const snippet = lines.slice(lines[0] === title ? 1 : 0).join(' · ')
  return { title, snippet }
}

function SearchResult({
  note,
  id,
  active,
  onHover,
  onSelect,
}: {
  note: Note
  id: string
  active: boolean
  onHover: () => void
  onSelect: () => void
}) {
  const { title, snippet } = summarize(note)
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onPointerMove={onHover}
      onClick={onSelect}
      className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${active ? 'bg-ink/8' : ''}`}
    >
      <span data-color={note.color} className="note-swatch mt-1.5 size-3 shrink-0 rounded-full border border-ink/15" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-semibold text-ink">{title}</span>
        {snippet && <span className="block truncate text-[13.5px] text-ink-soft">{snippet}</span>}
      </span>
    </li>
  )
}

function SearchPalette({ notes, onOpen, onClose }: NoteSearchProps & { onClose: () => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const results = useMemo(() => findNotes(notes, query), [notes, query])
  const active = Math.min(activeIndex, results.length - 1)
  const optionId = (index: number) => `${listId}-${index}`

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const select = (note: Note | undefined) => {
    if (!note) return
    onClose()
    onOpen(note)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    setActiveIndex(0)
  }

  const dismiss = () => {
    if (query) changeQuery('')
    else onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      dismiss()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((active + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(results[active])
    }
  }

  return (
    <ModalDialog
      onClose={onClose}
      onEscape={dismiss}
      aria-label={t('search.placeholder')}
      className="items-start px-4 pt-[max(1rem,12vh)]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, transition: quickFade }}
        transition={gentle}
        className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_24px_60px_-24px_rgb(var(--shadow-ink)/0.55)]"
      >
        <div className="flex items-center gap-3 px-5 py-3.5">
          <MagnifyingGlassIcon size={22} weight="bold" className="shrink-0 text-ink-soft" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            aria-label={t('search.placeholder')}
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden"
          />
          {query && <IconButton icon={XIcon} label={t('search.clear')} size="sm" onClick={() => changeQuery('')} />}
        </div>
        <div className="border-t border-line p-2">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label={t('search.results')} className="flex flex-col">
              {results.map((note, index) => (
                <SearchResult
                  key={note.id}
                  note={note}
                  id={optionId(index)}
                  active={index === active}
                  onHover={() => setActiveIndex(index)}
                  onSelect={() => select(note)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">{t('search.noResults')}</p>
          )}
        </div>
      </motion.div>
    </ModalDialog>
  )
}

export function NoteSearch({ ref, notes, onOpen }: NoteSearchProps & { ref?: Ref<NoteSearchHandle> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), [])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isOpenShortcut(event)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <IconButton
        icon={MagnifyingGlassIcon}
        label={t('search.open')}
        title={t('search.shortcut')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      <AnimatePresence>
        {open && <SearchPalette key="search" notes={notes} onOpen={onOpen} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
