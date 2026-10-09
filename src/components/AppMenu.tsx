import {
  ArrowsClockwiseIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  CloudWarningIcon,
  DeviceMobileIcon,
  ListIcon,
  XIcon,
  SignInIcon,
  SignOutIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { User } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useSyncStatus } from '../auth/authContext'
import { currentLanguage, SUPPORTED_LANGUAGES, type Language } from '../i18n'
import type { SyncManager, SyncStatus } from '../sync/SyncManager'
import { THEME_OPTIONS, useTheme } from '../theme/theme'
import { bouncy, pressable, quickFade, snappy } from './motion'
import { THEME_ICON } from './themeIcons'

const STATUS: Record<SyncStatus, { icon: Icon; dot: string }> = {
  idle: { icon: CloudCheckIcon, dot: 'bg-success' },
  pending: { icon: CloudArrowUpIcon, dot: 'bg-warning' },
  syncing: { icon: ArrowsClockwiseIcon, dot: 'bg-brand animate-pulse' },
  offline: { icon: CloudSlashIcon, dot: 'bg-ink-faint' },
  error: { icon: CloudWarningIcon, dot: 'bg-danger' },
  quotaExceeded: { icon: CloudWarningIcon, dot: 'bg-danger' },
}

const MANUAL_SYNC_STATUSES: ReadonlySet<SyncStatus> = new Set(['pending', 'error', 'quotaExceeded'])

const LANGUAGE_NAME: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
}

function useDismiss(open: boolean, close: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return containerRef
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: Icon
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
}) {
  const highlightId = useId()
  return (
    <div className="px-1 pt-3">
      <p className="mb-1.5 px-2 text-xs font-semibold tracking-wide text-ink-soft">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {options.map(({ value: optionValue, label: optionLabel, icon: OptionIcon }) => {
          const selected = optionValue === value
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(optionValue)}
              className={`relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors ${selected ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {selected && (
                <motion.span
                  layoutId={highlightId}
                  transition={snappy}
                  className="absolute inset-0 rounded-xl bg-surface shadow-[0_2px_8px_-3px_rgb(var(--shadow-ink)/0.3)]"
                />
              )}
              {OptionIcon && <OptionIcon size={16} weight={selected ? 'fill' : 'bold'} className="relative" />}
              <span className="relative">{optionLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Avatar({ user, className }: { user: User; className: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-display font-bold text-on-brand ${className}`}
    >
      {(user.email ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}

function subscribeToClock(onTick: () => void): () => void {
  const interval = setInterval(onTick, 1000)
  return () => clearInterval(interval)
}

const currentSecond = () => Math.floor(Date.now() / 1000)

function useSecondsUntil(timestamp: number): number {
  const now = useSyncExternalStore(subscribeToClock, currentSecond)
  return Math.max(0, Math.ceil(timestamp / 1000) - now)
}

function ManualSyncButton({ syncManager }: { syncManager: SyncManager }) {
  const { t } = useTranslation()
  const secondsLeft = useSecondsUntil(syncManager.manualSyncAvailableAt())

  return (
    <button
      type="button"
      onClick={() => void syncManager.syncManually()}
      disabled={secondsLeft > 0}
      className="group/sync mt-1 flex h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-ink/8 disabled:text-ink-faint disabled:hover:bg-transparent"
    >
      <ArrowsClockwiseIcon
        size={18}
        weight="bold"
        className="transition-transform duration-300 ease-(--ease-spring) group-enabled/sync:group-hover/sync:rotate-90"
      />
      {secondsLeft > 0 ? t('sync.syncIn', { seconds: secondsLeft }) : t('sync.syncNow')}
    </button>
  )
}

function AccountSection({ onSignIn, onSignOut }: { onSignIn: () => void; onSignOut: () => void }) {
  const { t } = useTranslation()
  const { client, user, syncManager } = useAuth()
  const status = useSyncStatus() ?? 'syncing'

  if (!client) return null

  if (!user) {
    return (
      <div className="rounded-2xl bg-surface-2 p-3">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <DeviceMobileIcon size={18} weight="bold" className="shrink-0" />
          {t('sync.local')}
        </p>
        <motion.button
          type="button"
          onClick={onSignIn}
          {...pressable}
          className="group/signin mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <SignInIcon
            size={18}
            weight="bold"
            className="transition-transform duration-300 ease-(--ease-spring) group-hover/signin:translate-x-0.5"
          />
          {t('auth.signIn')}
        </motion.button>
      </div>
    )
  }

  const { icon: StatusIcon } = STATUS[status]
  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Avatar user={user} className="size-10 text-xl" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
            <motion.span
              key={status}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={bouncy}
              className={`inline-flex ${status === 'syncing' ? 'animate-spin-slow' : ''}`}
            >
              <StatusIcon size={14} weight="bold" />
            </motion.span>
            {t(`sync.${status}`)}
          </p>
        </div>
      </div>
      {syncManager && MANUAL_SYNC_STATUSES.has(status) && <ManualSyncButton syncManager={syncManager} />}
      <SignOutButton onSignOut={onSignOut} />
    </>
  )
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="group/out mt-1 flex h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <SignOutIcon
        size={18}
        weight="bold"
        className="transition-transform duration-300 ease-(--ease-spring) group-hover/out:translate-x-1"
      />
      {t('auth.signOut')}
    </button>
  )
}

function MenuTrigger({ open, onToggle, panelId }: { open: boolean; onToggle: () => void; panelId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const status = useSyncStatus()

  const label = status ? `${t('menu.open')} — ${t(`sync.${status}`)}` : t('menu.open')
  const content: ReactNode = user ? (
    <>
      <Avatar user={user} className="size-11 text-[22px]" />
      {status && (
        <span className={`absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-canvas ${STATUS[status].dot}`} />
      )}
    </>
  ) : (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={open ? 'close' : 'open'}
        initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
        transition={bouncy}
        className="inline-flex"
      >
        {open ? <XIcon size={22} weight="bold" /> : <ListIcon size={22} weight="bold" />}
      </motion.span>
    </AnimatePresence>
  )

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      {...pressable}
      className={`relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors ${user ? '' : 'hover:bg-ink/8'} ${open && !user ? 'bg-ink/8' : ''}`}
    >
      {content}
    </motion.button>
  )
}

export function AppMenu({ onSignIn }: { onSignIn: () => void }) {
  const { t, i18n } = useTranslation()
  const { loading, signOut } = useAuth()
  const { preference, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismiss(open, close)
  const panelId = useId()

  if (loading) return <span className="size-11" />

  const onSignOut = () => {
    close()
    void signOut((count) => window.confirm(t('auth.pendingLogout', { count })))
  }

  return (
    <div ref={containerRef} className="relative">
      <MenuTrigger open={open} onToggle={() => setOpen(!open)} panelId={panelId} />
      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label={t('menu.title')}
            initial={{ opacity: 0, scale: 0.88, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4, transition: quickFade }}
            transition={snappy}
            className="absolute top-full right-0 z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-line bg-surface p-2 pb-3 shadow-[0_24px_48px_-20px_rgb(var(--shadow-ink)/0.4)]"
          >
            <AccountSection
              onSignIn={() => {
                close()
                onSignIn()
              }}
              onSignOut={onSignOut}
            />
            <Segmented
              label={t('theme.label')}
              value={preference}
              onChange={setTheme}
              options={THEME_OPTIONS.map((option) => ({
                value: option,
                label: t(`theme.${option}`),
                icon: THEME_ICON[option],
              }))}
            />
            <Segmented
              label={t('language.label')}
              value={currentLanguage()}
              onChange={(language) => void i18n.changeLanguage(language)}
              options={SUPPORTED_LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAME[language] }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
