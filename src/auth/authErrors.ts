import { isAuthError } from '@supabase/supabase-js'
import type { TFunction } from 'i18next'
import type { Translation } from '../i18n/locales/pt'

type AuthErrorKey = keyof Translation['authErrors']

const MESSAGE_BY_CODE: Partial<Record<string, AuthErrorKey>> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userExists',
  email_exists: 'userExists',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  email_address_invalid: 'invalidEmail',
  over_request_rate_limit: 'tooManyAttempts',
  over_email_send_rate_limit: 'tooManyEmails',
  signup_disabled: 'signupDisabled',
  session_expired: 'sessionExpired',
  session_not_found: 'sessionExpired',
  reauthentication_needed: 'sessionExpired',
}

export function authErrorMessage(error: Error, t: TFunction): string {
  if (!navigator.onLine) return t('authErrors.offline')
  const key = isAuthError(error) && error.code ? MESSAGE_BY_CODE[error.code] : undefined
  return t(`authErrors.${key ?? 'generic'}`)
}
