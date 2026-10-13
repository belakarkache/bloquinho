import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/authContext'
import { AuthDialog, type AuthMode } from './AuthDialog'

function renderDialog(initialMode: AuthMode, auth: object) {
  const onClose = vi.fn()
  const value: AuthContextValue = {
    client: { auth } as unknown as SupabaseClient,
    user: null,
    loading: false,
    syncManager: null,
    recoveringPassword: false,
    finishPasswordRecovery: () => {},
    signOut: async () => {},
    deleteAccount: async () => ({ error: null }),
  }
  render(
    <AuthContext value={value}>
      <AuthDialog initialMode={initialMode} onClose={onClose} />
    </AuthContext>,
  )
  return { onClose }
}

function renderSignUp(session: object | null) {
  const signUp = vi.fn(async () => ({ data: { session, user: {} }, error: null }))
  return renderDialog('signUp', { signUp })
}

async function submitSignUp() {
  const userEvents = userEvent.setup()
  await userEvents.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
  await userEvents.type(screen.getByLabelText('Senha'), 'senha-forte-123')
  await userEvents.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('AuthDialog sign up', () => {
  it('closes right away when the account is signed in without email confirmation', async () => {
    const { onClose } = renderSignUp({ access_token: 'token' })
    await submitSignUp()
    expect(onClose).toHaveBeenCalled()
  })

  it('asks to confirm the email when there is no session yet', async () => {
    const { onClose } = renderSignUp(null)
    await submitSignUp()
    expect(await screen.findByRole('status')).toHaveTextContent('Confira seu e-mail')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('AuthDialog sign in', () => {
  it('shows a generic error and keeps the email when switching to sign up', async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { session: null, user: null },
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    }))
    renderDialog('signIn', { signInWithPassword })
    const userEvents = userEvent.setup()
    await userEvents.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await userEvents.type(screen.getByLabelText('Senha'), 'senha-errada-123')
    await userEvents.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')

    await userEvents.click(screen.getByRole('button', { name: 'Não tenho conta' }))
    expect(await screen.findByLabelText('E-mail')).toHaveValue('ana@exemplo.com')
  })
})
