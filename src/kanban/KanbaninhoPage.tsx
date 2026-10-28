import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthDialog } from '../components/AuthDialog'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { UndoToast } from '../components/UndoToast'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { boardColumns, folderNames, moveCard } from './board'
import { CardEditor, type CardDraft } from './CardEditor'
import { FolderFilter } from './FolderFilter'
import { foldersRepository, toFolderColors } from './folders'
import { KanbanBoard } from './KanbanBoard'
import { KanbaninhoLogo } from './KanbaninhoLogo'
import { cardsRepository } from './repository'
import type { Card } from './types'

interface Editing {
  card: Card | null
}

export default function KanbaninhoPage() {
  const { t } = useTranslation()
  const cards = useLiveQuery(() => cardsRepository.listVisible(), [], [])
  const folders = useMemo(() => folderNames(cards), [cards])
  const storedFolders = useLiveQuery(() => foldersRepository.list(), [], [])
  const folderColors = useMemo(() => toFolderColors(storedFolders), [storedFolders])
  const uncoloredFolders = folders.filter((name) => !folderColors.has(name)).join('\n')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deletedCard, setDeletedCard] = useState<Card | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const folder = selectedFolder !== null && folders.includes(selectedFolder) ? selectedFolder : null

  useEffect(() => {
    if (uncoloredFolders) void foldersRepository.ensure(uncoloredFolders.split('\n'))
  }, [uncoloredFolders])

  useEffect(() => {
    const previous = document.title
    document.title = t('kanban.name')
    return () => {
      document.title = previous
    }
  }, [t])

  const openNew = useCallback(() => setEditing({ card: null }), [])
  const openCard = useCallback((card: Card) => setEditing({ card }), [])
  const closeEditor = useCallback(() => setEditing(null), [])
  const dismissToast = useCallback(() => setDeletedCard(null), [])

  const saveCard = async (card: Card | null, { column, folderColor, ...changes }: CardDraft) => {
    if (changes.folder && folderColor) await foldersRepository.setColor(changes.folder, folderColor)
    if (!card) {
      await cardsRepository.create({ ...changes, column })
      return
    }
    await cardsRepository.update(card.id, changes)
    if (column === card.column) return
    const columns = boardColumns(cards, null)
    const moved = moveCard(columns, card.id, column, columns[column].length)
    if (moved) await cardsRepository.move(card.id, column, moved.card.order)
  }

  const deleteCard = (card: Card) => {
    setEditing(null)
    void cardsRepository.remove(card.id)
    setDeletedCard(card)
  }

  const undoDelete = () => {
    if (deletedCard) void cardsRepository.restore(deletedCard)
    setDeletedCard(null)
  }

  return (
    <div className="flex min-h-dvh flex-col text-ink">
      <Header
        name={t('kanban.name')}
        logo={<KanbaninhoLogo className="size-10" />}
        logoLabel={t('kanban.newCard')}
        onSignIn={() => setSignInOpen(true)}
        onLogoClick={openNew}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 sm:pt-8">
        <FolderFilter folders={folders} colors={folderColors} value={folder} onChange={setSelectedFolder} />
        <KanbanBoard cards={cards} folder={folder} folderColors={folderColors} onOpen={openCard} onAdd={openNew} />
      </main>
      <Footer />
      <AnimatePresence>
        {editing && (
          <CardEditor
            key={editing.card?.id ?? 'new'}
            card={editing.card}
            folders={folders}
            folderColors={folderColors}
            defaultFolder={folder}
            onSave={(draft) => void saveCard(editing.card, draft)}
            onDelete={deleteCard}
            onClose={closeEditor}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {signInOpen && <AuthDialog key="auth" initialMode="signIn" onClose={() => setSignInOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {deletedCard && (
          <UndoToast key={deletedCard.id} message={t('kanban.deleted')} onUndo={undoDelete} onDismiss={dismissToast} />
        )}
      </AnimatePresence>
      <UpdatePrompt hidden={editing !== null || deletedCard !== null} />
    </div>
  )
}
