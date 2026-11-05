import {
  ArrowsClockwiseIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  CloudWarningIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  KeyIcon,
  ListIcon,
  XIcon,
  SignInIcon,
  SignOutIcon,
  TagIcon,
  TrashIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { User } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { hasPasswordLogin, useAuth, useSyncStatus } from '../auth/authContext'
import { currentLanguage, SUPPORTED_LANGUAGES, type Language } from '../i18n'
import { promptInstall, useInstallState } from '../lib/install'
import type { SyncStatus } from '../sync/SyncManager'
import { THEME_OPTIONS, useTheme } from '../theme/theme'
import { AccountDialog, type AccountAction } from './AccountDialog'
import { ColorLabelsDialog } from './ColorLabelsDialog'
import { InstallDialog } from './InstallDialog'
import { bouncy, pressable, quickFade, snappy } from './motion'
import { THEME_ICON } from './themeIcons'

const STATUS: Record<SyncStatus, { icon: Icon; dot: string }> = {
  synced: { icon: CloudCheckIcon, dot: 'bg-success' },
  saving: { icon: CloudArrowUpIcon, dot: 'bg-brand animate-pulse' },
  offline: { icon: CloudSlashIcon, dot: 'bg-ink-faint' },
  error: { icon: CloudWarningIcon, dot: 'bg-danger' },
  quotaExceeded: { icon: CloudWarningIcon, dot: 'bg-danger' },
}

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

function PreferenceRow<T extends string>({
  label,
  value,
  options,
  iconOnly = false,
  onChange,
}: {
  label: string
  value: T
  options: SegmentedOption<T>[]
  iconOnly?: boolean
  onChange: (value: T) => void
}) {
  const highlightId = useId()
  const labelId = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pl-3">
      <span id={labelId} className="text-sm font-semibold text-ink">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex gap-0.5 rounded-xl bg-surface-2 p-0.5">
        {options.map(({ value: optionValue, label: optionLabel, icon: OptionIcon }) => {
          const selected = optionValue === value
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={iconOnly ? optionLabel : undefined}
              title={iconOnly ? optionLabel : undefined}
              onClick={() => onChange(optionValue)}
              className={`relative flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-colors ${iconOnly ? 'w-9' : 'px-3'} ${selected ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {selected && (
                <motion.span
                  layoutId={highlightId}
                  transition={snappy}
                  className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_2px_8px_-3px_rgb(var(--shadow-ink)/0.3)]"
                />
              )}
              {OptionIcon && <OptionIcon size={16} weight={selected ? 'fill' : 'bold'} className="relative" />}
              {!iconOnly && <span className="relative">{optionLabel}</span>}
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

function MenuSection({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">{children}</div>
}

function AccountCard({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation()
  const { client, user, syncManager } = useAuth()
  const status = useSyncStatus() ?? 'saving'

  if (!client) return null

  if (!user) {
    return (
      <MenuSection>
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
      </MenuSection>
    )
  }

  const { icon: StatusIcon } = STATUS[status]
  const failed = status === 'error' || status === 'quotaExceeded'
  return (
    <MenuSection>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Avatar user={user} className="size-10 text-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
          <p className={`mt-0.5 flex items-start gap-1 text-xs leading-snug ${failed ? 'text-danger' : 'text-ink-soft'}`}>
            <motion.span
              key={status}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={bouncy}
              className={`mt-px inline-flex shrink-0 ${status === 'saving' ? 'animate-pulse' : ''}`}
            >
              <StatusIcon size={14} weight="bold" />
            </motion.span>
            {t(`sync.${status}`)}
          </p>
        </div>
        {syncManager && status === 'error' && (
          <button
            type="button"
            onClick={() => void syncManager.syncNow()}
            aria-label={t('sync.retry')}
            title={t('sync.retry')}
            className="group/retry inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/8 hover:text-ink"
          >
            <ArrowsClockwiseIcon
              size={18}
              weight="bold"
              className="transition-transform duration-500 ease-(--ease-spring) group-hover/retry:rotate-180"
            />
          </button>
        )}
      </div>
    </MenuSection>
  )
}

function AccountActions({
  onSignOut,
  onAccountAction,
}: {
  onSignOut: () => void
  onAccountAction: (action: AccountAction) => void
}) {
  const { t } = useTranslation()
  const { client, user } = useAuth()

  if (!client || !user) return null

  return (
    <MenuSection>
      {hasPasswordLogin(user) && (
        <MenuAction icon={KeyIcon} onClick={() => onAccountAction('changePassword')}>
          {t('account.changePassword')}
        </MenuAction>
      )}
      <MenuAction icon={SignOutIcon} onClick={onSignOut}>
        {t('auth.signOut')}
      </MenuAction>
      <button
        type="button"
        onClick={() => onAccountAction('deleteAccount')}
        className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <TrashIcon size={15} weight="bold" />
        {t('account.deleteAccount')}
      </button>
    </MenuSection>
  )
}

function MenuAction({ icon: ActionIcon, onClick, children }: { icon: Icon; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/action flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-ink/8"
    >
      <ActionIcon
        size={18}
        weight="bold"
        className="text-ink-soft transition-[translate,color] duration-300 ease-(--ease-spring) group-hover/action:translate-x-0.5 group-hover/action:text-ink"
      />
      {children}
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
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const install = useInstallState()
  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismiss(open, close)
  const panelId = useId()

  if (loading) return <span className="size-11" />

  const onSignOut = () => {
    close()
    void signOut((count) => window.confirm(t('auth.pendingLogout', { count })))
  }

  const onInstall = () => {
    close()
    if (install.canPrompt) void promptInstall()
    else setInstallHelp(true)
  }

  const openAccountAction = (action: AccountAction) => {
    close()
    setAccountAction(action)
  }

  return (
    <>
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
            className="absolute top-full right-0 z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] origin-top-right flex flex-col divide-y divide-line rounded-3xl border border-line bg-surface p-2 shadow-[0_24px_48px_-20px_rgb(var(--shadow-ink)/0.4)]"
          >
            <AccountCard
              onSignIn={() => {
                close()
                onSignIn()
              }}
            />
            <MenuSection>
              <MenuAction
                icon={TagIcon}
                onClick={() => {
                  close()
                  setCategoriesOpen(true)
                }}
              >
                {t('categories.action')}
              </MenuAction>
              {!install.installed && (
                <MenuAction icon={DownloadSimpleIcon} onClick={onInstall}>
                  {t('install.action')}
                </MenuAction>
              )}
            </MenuSection>
            <MenuSection>
              <PreferenceRow
                label={t('theme.label')}
                value={preference}
                onChange={setTheme}
                iconOnly
                options={THEME_OPTIONS.map((option) => ({
                  value: option,
                  label: t(`theme.${option}`),
                  icon: THEME_ICON[option],
                }))}
              />
              <PreferenceRow
                label={t('language.label')}
                value={currentLanguage()}
                onChange={(language) => void i18n.changeLanguage(language)}
                options={SUPPORTED_LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAME[language] }))}
              />
            </MenuSection>
            <AccountActions onSignOut={onSignOut} onAccountAction={openAccountAction} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <AnimatePresence>
      {accountAction && (
        <AccountDialog key={accountAction} action={accountAction} onClose={() => setAccountAction(null)} />
      )}
    </AnimatePresence>
    <AnimatePresence>{installHelp && <InstallDialog onClose={() => setInstallHelp(false)} />}</AnimatePresence>
    <AnimatePresence>
      {categoriesOpen && <ColorLabelsDialog onClose={() => setCategoriesOpen(false)} />}
    </AnimatePresence>
    </>
  )
}
