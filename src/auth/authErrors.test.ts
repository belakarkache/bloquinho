import { AuthApiError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { authErrorMessage } from './authErrors'

const t = i18n.t.bind(i18n)

describe('authErrorMessage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('translates known Supabase auth errors', () => {
    const error = new AuthApiError('Email not confirmed', 400, 'email_not_confirmed')
    expect(authErrorMessage(error, t)).toBe(
      'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.',
    )
  })

  it('falls back to a generic message instead of the raw English text', () => {
    expect(authErrorMessage(new Error('Database error saving new user'), t)).toBe('Algo deu errado. Tente de novo.')
  })

  it('tells the user when the device is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(authErrorMessage(new Error('Failed to fetch'), t)).toBe('Sem internet. Confira a conexão e tente de novo.')
  })
})
