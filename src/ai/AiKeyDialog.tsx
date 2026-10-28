import { ArrowSquareOutIcon, EyeIcon, EyeSlashIcon, ShieldWarningIcon, SparkleIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ModalDialog } from '../components/ModalDialog'
import { gentle, pressable, quickFade } from '../components/motion'
import { useBackToClose } from '../components/useBackToClose'
import { clearGeminiKey, saveGeminiKey, useGeminiKey } from './apiKey'
import { AI_STUDIO_KEYS_URL, GeminiError, verifyGeminiKey, type GeminiErrorKind } from './gemini'

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const

type Status = { state: 'idle' } | { state: 'testing' } | { state: 'error'; kind: GeminiErrorKind }

interface AiKeyDialogProps {
  onClose: () => void
  onReady?: () => void
}

export function AiKeyDialog({ onClose, onReady }: AiKeyDialogProps) {
  const { t } = useTranslation()
  const savedKey = useGeminiKey()
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const abortRef = useRef<AbortController | null>(null)
  const testing = status.state === 'testing'

  useBackToClose(true, onClose)
  useEffect(() => () => abortRef.current?.abort(), [])

  const testAndSave = async () => {
    const key = draft.trim()
    if (!key || testing) return
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: 'testing' })
    try {
      await verifyGeminiKey(key, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus({ state: 'error', kind: error instanceof GeminiError ? error.kind : 'network' })
      return
    }
    saveGeminiKey(key)
    setDraft('')
    setStatus({ state: 'idle' })
    if (onReady) onReady()
    else onClose()
  }

  return (
    <ModalDialog onClose={onClose} aria-labelledby="ai-key-title" className="items-end p-0 sm:items-center sm:p-6">
      <motion.form
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        onSubmit={(event) => {
          event.preventDefault()
          void testAndSave()
        }}
        className="relative flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-[32px] sm:p-8"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <SparkleIcon size={24} weight="bold" />
        </span>
        <h2 id="ai-key-title" className="mt-5 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">
          {t('ai.title')}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('ai.intro')}</p>
        {savedKey ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-ink">{t('ai.saved')}</p>
            <button
              type="button"
              onClick={clearGeminiKey}
              className="h-10 rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
            >
              {t('ai.remove')}
            </button>
          </div>
        ) : (
          <ol className="mt-5 flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                  {index + 1}
                </span>
                <span className="pt-0.5">
                  <Trans
                    i18nKey={`ai.${step}`}
                    components={{
                      studio: (
                        <a
                          href={AI_STUDIO_KEYS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline underline-offset-2"
                        />
                      ),
                      icon: <ArrowSquareOutIcon size={14} weight="bold" aria-hidden="true" />,
                      b: <strong className="font-semibold" />,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-5 flex gap-3 rounded-2xl border-2 border-line p-4 text-[14px] leading-relaxed text-ink-soft">
          <ShieldWarningIcon size={22} weight="bold" className="mt-0.5 shrink-0 text-ink" />
          <div className="flex flex-col gap-2">
            <p>{t('ai.privacyTraining')}</p>
            <p>{t('ai.privacyKey')}</p>
          </div>
        </div>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            {savedKey ? t('ai.replaceLabel') : t('ai.keyLabel')}
          </span>
          <span className="flex h-12 items-center gap-1 rounded-2xl border-2 border-line bg-surface pr-1 pl-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-accent-ink focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
            <input
              type={visible ? 'text' : 'password'}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (status.state === 'error') setStatus({ state: 'idle' })
              }}
              placeholder={t('ai.keyPlaceholder')}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={status.state === 'error'}
              aria-describedby={status.state === 'error' ? 'ai-key-error' : undefined}
              className="min-w-0 flex-1 bg-transparent font-mono text-[14px] text-ink outline-none placeholder:font-sans placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? t('ai.hideKey') : t('ai.showKey')}
              title={visible ? t('ai.hideKey') : t('ai.showKey')}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
            >
              {visible ? <EyeSlashIcon size={18} weight="bold" /> : <EyeIcon size={18} weight="bold" />}
            </button>
          </span>
        </label>
        {status.state === 'error' && (
          <p id="ai-key-error" role="alert" className="mt-2 text-sm font-medium text-danger">
            {t(`ai.errors.${status.kind}`)}
          </p>
        )}
        <div className="mt-6 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <motion.button
            type="button"
            onClick={onClose}
            {...pressable}
            className="h-12 rounded-2xl px-5 font-semibold text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
          >
            {savedKey ? t('ai.close') : t('ai.cancel')}
          </motion.button>
          <motion.button
            type="submit"
            disabled={!draft.trim() || testing}
            {...pressable}
            className="h-12 rounded-2xl bg-accent px-5 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {testing ? t('ai.testing') : t('ai.testAndSave')}
          </motion.button>
        </div>
      </motion.form>
    </ModalDialog>
  )
}
