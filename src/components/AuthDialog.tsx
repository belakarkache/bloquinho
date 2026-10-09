import {
  CheckCircleIcon,
  CircleNotchIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  GoogleLogoIcon,
  LockSimpleIcon,
  WarningCircleIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/authContext'
import { googleAuthEnabled } from '../lib/supabase'
import { IconButton } from './IconButton'
import { LogoMark } from './Logo'
import { ModalDialog } from './ModalDialog'
import { bouncy, gentle, pressable, quickFade } from './motion'

export type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'newPassword'

interface AuthDialogProps {
  initialMode: AuthMode
  onClose: () => void
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: Icon
  trailing?: ReactNode
}

function Field({ label, icon: FieldIcon, trailing, ...input }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <span className="group/field flex h-12 items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-3.5 transition-[border-color,box-shadow] duration-200 focus-within:border-accent-ink focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
        <FieldIcon
          size={19}
          weight="bold"
          className="shrink-0 text-ink-faint transition-colors group-focus-within/field:text-ink"
        />
        <input {...input} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none" />
        {trailing}
      </span>
    </label>
  )
}

const linkButtonClass =
  'rounded-lg px-1 text-sm font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-[text-decoration-thickness] hover:decoration-[3px]'

export function AuthDialog({ initialMode, onClose }: AuthDialogProps) {
  const { t } = useTranslation()
  const { client, finishPasswordRecovery } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!client) return null

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const run = async (action: () => Promise<{ error: Error | null }>, onSuccess: () => void) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const { error: actionError } = await action()
    setBusy(false)
    if (actionError) setError(t('auth.error', { message: actionError.message }))
    else onSuccess()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'signIn') {
      void run(() => client.auth.signInWithPassword({ email, password }), onClose)
    }
    if (mode === 'signUp') {
      void run(
        () =>
          client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: location.origin },
          }),
        () => setNotice(t('auth.confirmEmail')),
      )
    }
    if (mode === 'forgot') {
      void run(
        () => client.auth.resetPasswordForEmail(email, { redirectTo: location.origin }),
        () => setNotice(t('auth.resetSent')),
      )
    }
    if (mode === 'newPassword') {
      void run(
        () => client.auth.updateUser({ password }),
        () => {
          finishPasswordRecovery()
          onClose()
        },
      )
    }
  }

  const signInWithGoogle = () =>
    void run(
      () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } }),
      () => undefined,
    )

  const titles: Record<AuthMode, string> = {
    signIn: t('auth.signInTitle'),
    signUp: t('auth.signUpTitle'),
    forgot: t('auth.forgot'),
    newPassword: t('auth.newPassword'),
  }
  const submitLabels: Record<AuthMode, string> = {
    signIn: t('auth.signIn'),
    signUp: t('auth.signUp'),
    forgot: t('auth.sendReset'),
    newPassword: t('auth.savePassword'),
  }
  const needsEmail = mode !== 'newPassword'
  const needsPassword = mode !== 'forgot'
  const showPitch = mode === 'signIn' || mode === 'signUp'
  const PasswordToggleIcon = showPassword ? EyeSlashIcon : EyeIcon

  return (
    <ModalDialog onClose={onClose} aria-labelledby="auth-title" className="items-end p-0 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[32px] sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <LogoMark className="size-12" />
          <IconButton icon={XIcon} label={t('note.close')} onClick={onClose} className="-mt-1 -mr-2" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.12 } }}
            transition={gentle}
          >
            <h2 id="auth-title" className="font-display text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink">
              {titles[mode]}
            </h2>
            {showPitch && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('auth.syncPitch')}</p>}

            {showPitch && googleAuthEnabled && (
              <>
                <motion.button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={busy}
                  {...pressable}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-line bg-surface font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-60"
                >
                  <GoogleLogoIcon size={20} weight="bold" />
                  {t('auth.google')}
                </motion.button>
                <div className="my-5 flex items-center gap-3 text-xs font-semibold tracking-widest text-ink-faint uppercase">
                  <span className="h-px flex-1 bg-line" />
                  {t('auth.or')}
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {needsEmail && (
                <Field
                  label={t('auth.email')}
                  icon={EnvelopeSimpleIcon}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
              {needsPassword && (
                <Field
                  label={mode === 'newPassword' ? t('auth.newPassword') : t('auth.password')}
                  icon={LockSimpleIcon}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  trailing={
                    <IconButton
                      icon={PasswordToggleIcon}
                      label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      size="sm"
                      className="-mr-2"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  }
                />
              )}

              <AnimatePresence mode="popLayout">
                {error && (
                  <motion.p
                    key="error"
                    role="alert"
                    initial={{ opacity: 0, y: -6, x: 0 }}
                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 0] }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 rounded-2xl bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger"
                  >
                    <WarningCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
                    {error}
                  </motion.p>
                )}
                {notice && (
                  <motion.p
                    key="notice"
                    role="status"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={bouncy}
                    className="flex items-start gap-2 rounded-2xl bg-success/12 px-3 py-2.5 text-sm font-medium text-success"
                  >
                    <CheckCircleIcon size={18} weight="fill" className="mt-px shrink-0" />
                    {notice}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                {...pressable}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover disabled:opacity-70"
              >
                {busy && <CircleNotchIcon size={18} weight="bold" className="animate-spin" />}
                {submitLabels[mode]}
              </motion.button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              {mode === 'signIn' && (
                <>
                  <button type="button" className={linkButtonClass} onClick={() => switchMode('forgot')}>
                    {t('auth.forgot')}
                  </button>
                  <button type="button" className={linkButtonClass} onClick={() => switchMode('signUp')}>
                    {t('auth.noAccount')}
                  </button>
                </>
              )}
              {mode === 'signUp' && (
                <button type="button" className={linkButtonClass} onClick={() => switchMode('signIn')}>
                  {t('auth.haveAccount')}
                </button>
              )}
              {mode === 'forgot' && (
                <button type="button" className={linkButtonClass} onClick={() => switchMode('signIn')}>
                  {t('auth.backToSignIn')}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </ModalDialog>
  )
}
