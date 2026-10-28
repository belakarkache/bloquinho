import { SparkleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../components/IconButton'
import { ModalDialog } from '../components/ModalDialog'
import { gentle, pressable, quickFade, snappy } from '../components/motion'
import { isSaveShortcut } from '../components/shortcuts'
import { useBackToClose } from '../components/useBackToClose'
import { folderNames } from '../kanban/board'
import { FIELD } from '../kanban/formStyles'
import { cardsRepository } from '../kanban/repository'
import { SourceExcerpt } from '../kanban/SourceExcerpt'
import { CARD_DESCRIPTION_MAX_LENGTH, CARD_FOLDER_MAX_LENGTH, CARD_TITLE_MAX_LENGTH } from '../kanban/types'
import type { Note } from '../notes/types'
import { AiKeyDialog } from './AiKeyDialog'
import { clearGeminiKey, useGeminiKey } from './apiKey'
import { GeminiError, splitNoteIntoTasks, type GeminiErrorKind, type TaskSuggestion } from './gemini'

const PRIMARY =
  'h-12 rounded-2xl bg-accent px-5 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = 'h-12 rounded-2xl px-5 font-semibold text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink'

interface DraftTask extends Omit<TaskSuggestion, 'folder'> {
  id: string
  folder: string
}

type Phase = { name: 'loading' } | { name: 'error'; kind: GeminiErrorKind } | { name: 'review'; tasks: DraftTask[] }

export interface OrganizeResult {
  cardIds: string[]
  deleteNote: boolean
}

interface OrganizeDialogProps {
  note: Note
  onDone: (result: OrganizeResult) => void
  onClose: () => void
}

const noop = () => {}
const NO_TASKS: DraftTask[] = []

function toDraft(task: TaskSuggestion): DraftTask {
  return { ...task, id: crypto.randomUUID(), folder: task.folder ?? '' }
}

function Heading({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <>
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
        {icon}
      </span>
      <h2 id="organize-title" className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {body && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>}
    </>
  )
}

function TaskFields({
  task,
  index,
  folderListId,
  onChange,
  onRemove,
}: {
  task: DraftTask
  index: number
  folderListId: string
  onChange: (changes: Partial<DraftTask>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: quickFade }}
      transition={snappy}
      aria-label={t('ai.task', { index: index + 1 })}
      className="flex flex-col gap-2 rounded-3xl bg-surface-2 p-3"
    >
      <div className="flex items-center gap-1">
        <input
          value={task.title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-label={t('kanban.title')}
          placeholder={t('kanban.titlePlaceholder')}
          maxLength={CARD_TITLE_MAX_LENGTH}
          enterKeyHint="done"
          className={`h-11 min-w-0 flex-1 font-semibold ${FIELD}`}
        />
        <IconButton icon={XIcon} label={t('ai.removeTask')} onClick={onRemove} />
      </div>
      <textarea
        value={task.description}
        onChange={(event) => onChange({ description: event.target.value })}
        aria-label={t('kanban.description')}
        placeholder={t('kanban.descriptionPlaceholder')}
        maxLength={CARD_DESCRIPTION_MAX_LENGTH}
        rows={1}
        className={`block max-h-40 min-h-11 w-full resize-none py-2.5 text-[14px] leading-relaxed field-sizing-content ${FIELD}`}
      />
      <input
        value={task.folder}
        onChange={(event) => onChange({ folder: event.target.value })}
        aria-label={t('kanban.folder')}
        placeholder={t('kanban.folderPlaceholder')}
        maxLength={CARD_FOLDER_MAX_LENGTH}
        list={folderListId}
        enterKeyHint="done"
        className={`h-11 w-full text-[14px] ${FIELD}`}
      />
      {task.sourceExcerpt && (
        <div className="px-1">
          <SourceExcerpt excerpt={task.sourceExcerpt} />
        </div>
      )}
    </motion.li>
  )
}

export default function OrganizeDialog({ note, onDone, onClose }: OrganizeDialogProps) {
  const { t } = useTranslation()
  const key = useGeminiKey()
  const folderListId = useId()
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [deleteNote, setDeleteNote] = useState(true)
  const [saving, setSaving] = useState(false)
  const cards = useLiveQuery(() => cardsRepository.listVisible(), [], [])
  const tasks = phase.name === 'review' ? phase.tasks : NO_TASKS
  const folders = useMemo(
    () => [...new Set([...folderNames(cards), ...tasks.map((task) => task.folder.trim()).filter(Boolean)])],
    [cards, tasks],
  )
  const ready = tasks.filter((task) => task.title.trim())

  useBackToClose(true, onClose)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    splitNoteIntoTasks(key, note.content, controller.signal).then(
      (suggestions) => setPhase({ name: 'review', tasks: suggestions.map(toDraft) }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        setPhase({ name: 'error', kind: error instanceof GeminiError ? error.kind : 'network' })
      },
    )
    return () => controller.abort()
  }, [key, note.content, attempt])

  if (!key) return <AiKeyDialog onClose={onClose} onReady={noop} />

  const retry = () => {
    setPhase({ name: 'loading' })
    setAttempt(attempt + 1)
  }

  const changeKey = () => {
    setPhase({ name: 'loading' })
    clearGeminiKey()
  }

  const updateTask = (id: string, changes: Partial<DraftTask>) =>
    setPhase({ name: 'review', tasks: tasks.map((task) => (task.id === id ? { ...task, ...changes } : task)) })

  const removeTask = (id: string) => setPhase({ name: 'review', tasks: tasks.filter((task) => task.id !== id) })

  const confirm = async () => {
    if (saving || ready.length === 0) return
    setSaving(true)
    const created = await cardsRepository.createMany(
      ready.map(({ title, description, folder, sourceExcerpt }) => ({
        title: title.trim(),
        description: description.trim(),
        folder: folder.trim() || null,
        sourceExcerpt,
      })),
    )
    onDone({ cardIds: created.map((card) => card.id), deleteNote })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (phase.name !== 'review' || !isSaveShortcut(event)) return
    event.preventDefault()
    void confirm()
  }

  const content = () => {
    if (phase.name === 'loading') {
      return (
        <>
          <Heading
            icon={<SparkleIcon size={24} weight="bold" className="animate-pulse" />}
            title={t('ai.reading')}
            body={t('ai.readingBody')}
          />
          <div className="mt-6 flex justify-end">
            <motion.button type="button" onClick={onClose} {...pressable} className={SECONDARY}>
              {t('ai.cancel')}
            </motion.button>
          </div>
        </>
      )
    }
    if (phase.name === 'error') {
      const invalidKey = phase.kind === 'invalidKey' || phase.kind === 'permission'
      return (
        <>
          <Heading
            icon={<WarningCircleIcon size={24} weight="bold" />}
            title={t('ai.failed')}
            body={t(`ai.errors.${phase.kind}`)}
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <motion.button type="button" onClick={onClose} {...pressable} className={SECONDARY}>
              {t('ai.close')}
            </motion.button>
            <motion.button type="button" onClick={invalidKey ? changeKey : retry} {...pressable} className={PRIMARY}>
              {invalidKey ? t('ai.replaceLabel') : t('ai.retry')}
            </motion.button>
          </div>
        </>
      )
    }
    if (tasks.length === 0) {
      return (
        <>
          <Heading icon={<SparkleIcon size={24} weight="bold" />} title={t('ai.emptyTitle')} body={t('ai.empty')} />
          <div className="mt-6 flex justify-end">
            <motion.button type="button" onClick={onClose} {...pressable} className={PRIMARY}>
              {t('ai.close')}
            </motion.button>
          </div>
        </>
      )
    }
    return (
      <>
        <Heading icon={<SparkleIcon size={24} weight="bold" />} title={t('ai.reviewTitle')} body={t('ai.reviewIntro')} />
        <ul className="-mx-1 mt-5 flex min-h-0 flex-col gap-3 overflow-y-auto px-1 py-1">
          <AnimatePresence initial={false}>
            {tasks.map((task, index) => (
              <TaskFields
                key={task.id}
                task={task}
                index={index}
                folderListId={folderListId}
                onChange={(changes) => updateTask(task.id, changes)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
        <datalist id={folderListId}>
          {folders.map((folder) => (
            <option key={folder} value={folder} />
          ))}
        </datalist>
        <label className="mt-5 flex shrink-0 cursor-pointer items-center gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={deleteNote}
            onChange={(event) => setDeleteNote(event.target.checked)}
            className="size-5 shrink-0 cursor-pointer accent-accent-ink"
          />
          {t('ai.deleteNote')}
        </label>
        <div className="mt-5 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <motion.button type="button" onClick={onClose} {...pressable} className={SECONDARY}>
            {t('ai.cancel')}
          </motion.button>
          <motion.button type="submit" disabled={saving || ready.length === 0} {...pressable} className={PRIMARY}>
            {t('ai.create', { count: ready.length })}
          </motion.button>
        </div>
      </>
    )
  }

  return (
    <ModalDialog
      onClose={onClose}
      aria-labelledby="organize-title"
      onKeyDown={handleKeyDown}
      className="items-end p-0 sm:items-center sm:p-6"
    >
      <motion.form
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        onSubmit={(event) => {
          event.preventDefault()
          void confirm()
        }}
        aria-busy={phase.name === 'loading'}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-[32px] sm:p-8"
      >
        {content()}
      </motion.form>
    </ModalDialog>
  )
}
