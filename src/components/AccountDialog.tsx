import { EnvelopeSimpleIcon, XIcon } from '@phosphor-icons/react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/authContext'
import { Field, FormFeedback, PasswordField, SubmitButton } from './AuthFormParts'
import { IconButton } from './IconButton'
import { ModalDialog } from './ModalDialog'
import { gentle, quickFade } from './motion'

export type AccountAction = 'changePassword' | 'deleteAccount'

interface AccountDialogProps {
  action: AccountAction
  onClose: () => void
}

function useSubmission() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (action: () => Promise<string | null>, onSuccess: () => void) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const failure = await action()
    setBusy(false)
    if (failure) setError(failure)
    else onSuccess()
  }

  return { busy, error, notice, setNotice, submit }
}

function ChangePasswordForm({ client, user }: { client: SupabaseClient; user: User }) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const { busy, error, notice, setNotice, submit } = useSubmission()

  const changePassword = async () => {
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email ?? '',
      password: currentPassword,
    })
    if (signInError) return t('account.wrongPassword')
    const { error: updateError } = await client.auth.updateUser({ password: newPassword })
    return updateError ? t('auth.error', { message: updateError.message }) : null
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submit(changePassword, () => {
      setCurrentPassword('')
      setNewPassword('')
      setNotice(t('auth.passwordSaved'))
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <PasswordField
        label={t('account.currentPassword')}
        required
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <PasswordField
        label={t('auth.newPassword')}
        required
        minLength={8}
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <FormFeedback error={error} notice={notice} />
      <SubmitButton busy={busy}>{t('auth.savePassword')}</SubmitButton>
    </form>
  )
}

function DeleteAccountForm({ user, onDeleted }: { user: User; onDeleted: () => void }) {
  const { t } = useTranslation()
  const { deleteAccount } = useAuth()
  const [confirmation, setConfirmation] = useState('')
  const { busy, error, submit } = useSubmission()
  const email = user.email ?? ''
  const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase()

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!confirmed) return
    void submit(async () => {
      const { error: deleteError } = await deleteAccount()
      return deleteError ? t('auth.error', { message: deleteError.message }) : null
    }, onDeleted)
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        label={t('account.typeEmail', { email })}
        icon={EnvelopeSimpleIcon}
        type="email"
        required
        autoComplete="off"
        placeholder={email}
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <FormFeedback error={error} notice={null} />
      <SubmitButton busy={busy} disabled={!confirmed} tone="danger">
        {t('account.deleteConfirm')}
      </SubmitButton>
    </form>
  )
}

export function AccountDialog({ action, onClose }: AccountDialogProps) {
  const { t } = useTranslation()
  const { client, user } = useAuth()

  if (!client || !user) return null

  const titles: Record<AccountAction, string> = {
    changePassword: t('account.changePassword'),
    deleteAccount: t('account.deleteAccount'),
  }

  return (
    <ModalDialog onClose={onClose} aria-labelledby="account-title" className="items-end p-0 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97, transition: quickFade }}
        transition={gentle}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] border border-line bg-canvas px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[32px] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="account-title" className="font-display text-[30px] leading-tight font-bold tracking-[-0.02em] text-ink">
            {titles[action]}
          </h2>
          <IconButton icon={XIcon} label={t('note.close')} onClick={onClose} className="-mt-1 -mr-2" />
        </div>
        {action === 'changePassword' ? (
          <ChangePasswordForm client={client} user={user} />
        ) : (
          <>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('account.deleteWarning')}</p>
            <DeleteAccountForm user={user} onDeleted={onClose} />
          </>
        )}
      </motion.div>
    </ModalDialog>
  )
}
