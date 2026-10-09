import {
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  LockSimpleIcon,
  WarningCircleIcon,
  type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from './IconButton'
import { bouncy, pressable } from './motion'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: Icon
  trailing?: ReactNode
}

export function Field({ label, icon: FieldIcon, trailing, ...input }: FieldProps) {
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

type PasswordFieldProps = Omit<FieldProps, 'icon' | 'trailing' | 'type'>

export function PasswordField(props: PasswordFieldProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const ToggleIcon = visible ? EyeSlashIcon : EyeIcon

  return (
    <Field
      {...props}
      icon={LockSimpleIcon}
      type={visible ? 'text' : 'password'}
      trailing={
        <IconButton
          icon={ToggleIcon}
          label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          size="sm"
          className="-mr-2"
          onClick={() => setVisible(!visible)}
        />
      }
    />
  )
}

export function FormFeedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
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
  )
}

const SUBMIT_TONES = {
  accent: 'bg-accent text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] hover:bg-accent-hover',
  danger: 'bg-danger text-white shadow-[0_12px_24px_-12px_var(--danger)] hover:bg-danger/90',
}

export function SubmitButton({
  busy,
  disabled = false,
  tone = 'accent',
  children,
}: {
  busy: boolean
  disabled?: boolean
  tone?: keyof typeof SUBMIT_TONES
  children: ReactNode
}) {
  return (
    <motion.button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy}
      {...pressable}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-70 ${SUBMIT_TONES[tone]}`}
    >
      {busy && <CircleNotchIcon size={18} weight="bold" className="animate-spin" />}
      {children}
    </motion.button>
  )
}
