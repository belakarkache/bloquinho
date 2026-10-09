import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence } from 'motion/react'
import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './auth/authContext'
import { AuthDialog } from './components/AuthDialog'
import { ColorFilter } from './components/ColorFilter'
import { useContextMenu } from './components/contextMenu'
import { appGroups, clipboardGroup, isTextField, linkGroup, noteGroups } from './components/contextMenuEntries'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { NoteComposer, type NoteComposerHandle } from './components/NoteComposer'
import { NoteEditor } from './components/NoteEditor'
import { NoteGrid } from './components/NoteGrid'
import { NoteSearch, type NoteSearchHandle } from './components/NoteSearch'
import type { Neighbors } from './components/reorder'
import { UndoToast } from './components/UndoToast'
import { toggleItem } from './notes/checklist'
import { partitionNotes } from './notes/filter'
import { saveNoteOrder, useNoteOrder } from './notes/noteOrderStore'
import { applyOrder, moveBetween } from './notes/order'
import { notesRepository } from './notes/repository'
import type { Note, NoteChanges, NoteColor } from './notes/types'
import { useTheme } from './theme/theme'

const EDITOR_DELETE_FALLBACK_MS = 1_000

function linkHrefAt(target: Element): string | null {
  return target.closest('a[href]')?.getAttribute('href') ?? null
}

export default function App() {
  const { t } = useTranslation()
  const openMenu = useContextMenu()
  const { preference: theme, setTheme } = useTheme()
  const searchRef = useRef<NoteSearchHandle>(null)
  const notes = useLiveQuery(() => notesRepository.listVisible(), [], [])
  const { recoveringPassword, finishPasswordRecovery } = useAuth()
  const [colorFilter, setColorFilter] = useState<NoteColor | null>(null)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [deletedNote, setDeletedNote] = useState<Note | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const order = useNoteOrder()

  const partitioned = useMemo(
    () => partitionNotes(notes, { query: '', color: colorFilter }, order),
    [notes, colorFilter, order],
  )
  const openNote = notes.find((note) => note.id === openNoteId) ?? null

  const updateNote = useCallback((id: string, changes: NoteChanges) => notesRepository.update(id, changes), [])
  const deleteNote = useCallback((note: Note) => {
    void notesRepository.remove(note.id)
    setDeletedNote(note)
  }, [])
  const undoDelete = () => {
    if (deletedNote) void notesRepository.restore(deletedNote)
    setDeletedNote(null)
  }
  const reorderNote = (note: Note, { section, previous, next }: Neighbors) => {
    const ids = applyOrder(notes, order).map((other) => other.id)
    saveNoteOrder(moveBetween(ids, note.id, previous, next))
    const pinned = section === 'pinned'
    if (pinned !== note.pinned) void updateNote(note.id, { pinned })
  }
  const dismissToast = useCallback(() => setDeletedNote(null), [])
  const closeEditor = useCallback(() => setOpenNoteId(null), [])
  const composerRef = useRef<NoteComposerHandle>(null)
  const focusComposer = useCallback(() => composerRef.current?.focus(), [])
  const deleteAfterEditorCloses = useRef<Note | null>(null)
  const flushEditorDelete = useCallback(() => {
    const note = deleteAfterEditorCloses.current
    deleteAfterEditorCloses.current = null
    if (note) deleteNote(note)
  }, [deleteNote])
  const deleteFromEditor = useCallback(
    (note: Note) => {
      deleteAfterEditorCloses.current = note
      setOpenNoteId(null)
      setTimeout(flushEditorDelete, EDITOR_DELETE_FALLBACK_MS)
    },
    [flushEditorDelete],
  )

  const openNoteMenu = (note: Note, event: MouseEvent) => {
    const href = linkHrefAt(event.target as Element)
    openMenu(event, [
      href ? linkGroup(t, href) : [],
      ...noteGroups(t, note, {
        onOpen: () => setOpenNoteId(note.id),
        onTogglePin: () => void updateNote(note.id, { pinned: !note.pinned }),
        onColor: (color) => void updateNote(note.id, { color }),
        onDuplicate: () => void notesRepository.create(note),
        onDelete: () => deleteNote(note),
      }),
    ])
  }

  const openAppMenu = (event: MouseEvent) => {
    const target = event.target as Element
    const href = linkHrefAt(target)
    if (isTextField(target)) openMenu(event, [clipboardGroup(t, target)])
    else if (target.closest('dialog')) openMenu(event, [href ? linkGroup(t, href) : []])
    else {
      openMenu(event, [
        href ? linkGroup(t, href) : [],
        ...appGroups(t, {
          onNewNote: focusComposer,
          onSearch: () => searchRef.current?.open(),
          theme,
          onTheme: setTheme,
        }),
      ])
    }
  }

  return (
    <div className="flex min-h-dvh flex-col text-ink" onContextMenu={openAppMenu}>
      <Header
        search={<NoteSearch ref={searchRef} notes={notes} onOpen={(note) => setOpenNoteId(note.id)} />}
        onSignIn={() => setSignInOpen(true)}
        onLogoClick={focusComposer}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 sm:pt-8">
        <NoteComposer ref={composerRef} onCreate={(draft) => notesRepository.create(draft)} />
        <ColorFilter value={colorFilter} onChange={setColorFilter} />
        <NoteGrid
          notes={partitioned}
          filtering={colorFilter !== null}
          onOpen={(note) => setOpenNoteId(note.id)}
          onToggleItem={(note, line) => void updateNote(note.id, { content: toggleItem(note.content, line) })}
          onTogglePin={(note) => void updateNote(note.id, { pinned: !note.pinned })}
          onDelete={deleteNote}
          onContextMenu={openNoteMenu}
          onReorder={reorderNote}
        />
      </main>
      <Footer />
      <AnimatePresence onExitComplete={flushEditorDelete}>
        {openNote && (
          <NoteEditor
            key={openNote.id}
            note={openNote}
            onChange={updateNote}
            onDelete={deleteFromEditor}
            onClose={closeEditor}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {(signInOpen || recoveringPassword) && (
          <AuthDialog
            key="auth"
            initialMode={recoveringPassword ? 'newPassword' : 'signIn'}
            onClose={() => {
              setSignInOpen(false)
              finishPasswordRecovery()
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {deletedNote && <UndoToast key={deletedNote.id} onUndo={undoDelete} onDismiss={dismissToast} />}
      </AnimatePresence>
    </div>
  )
}
