import type { SupabaseClient, User } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../auth/authContext'
import { AccountDialog, type AccountAction } from './AccountDialog'

const user = { id: 'user-1', email: 'ana@exemplo.com', app_metadata: { providers: ['email'] } } as unknown as User

function fakeClient({ passwordOk = true } = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: passwordOk ? null : new Error('Invalid login credentials') })),
      updateUser: vi.fn(async () => ({ error: null })),
    },
  }
}

function renderDialog(
  action: AccountAction,
  client: ReturnType<typeof fakeClient>,
  overrides: Partial<AuthContextValue> = {},
) {
  const onClose = vi.fn()
  const value: AuthContextValue = {
    client: client as unknown as SupabaseClient,
    user,
    loading: false,
    syncManager: null,
    recoveringPassword: false,
    finishPasswordRecovery: () => {},
    signOut: async () => {},
    deleteAccount: async () => ({ error: null }),
    ...overrides,
  }
  render(
    <AuthContext value={value}>
      <AccountDialog action={action} onClose={onClose} />
    </AuthContext>,
  )
  return { onClose }
}

describe('AccountDialog', () => {
  it('changes the password after checking the current one', async () => {
    const client = fakeClient()
    const userEvents = userEvent.setup()
    renderDialog('changePassword', client)

    await userEvents.type(screen.getByLabelText('Senha atual'), 'antiga123')
    await userEvents.type(screen.getByLabelText('Nova senha'), 'novinha123')
    await userEvents.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'antiga123' })
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'novinha123' })
    expect(await screen.findByRole('status')).toHaveTextContent('Senha alterada.')
  })

  it('refuses to change the password when the current one is wrong', async () => {
    const client = fakeClient({ passwordOk: false })
    const userEvents = userEvent.setup()
    renderDialog('changePassword', client)

    await userEvents.type(screen.getByLabelText('Senha atual'), 'errada123')
    await userEvents.type(screen.getByLabelText('Nova senha'), 'novinha123')
    await userEvents.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta.')
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('deletes the account only after the email is typed', async () => {
    const deleteAccount = vi.fn(async () => ({ error: null }))
    const userEvents = userEvent.setup()
    const { onClose } = renderDialog('deleteAccount', fakeClient(), { deleteAccount })
    const confirm = screen.getByRole('button', { name: 'Excluir conta para sempre' })

    expect(confirm).toBeDisabled()
    await userEvents.type(screen.getByLabelText('Digite ana@exemplo.com para confirmar'), 'ANA@exemplo.com')
    expect(confirm).toBeEnabled()
    await userEvents.click(confirm)

    expect(deleteAccount).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the error and stays open when deletion fails', async () => {
    const deleteAccount = vi.fn(async () => ({ error: new Error('boom') }))
    const userEvents = userEvent.setup()
    const { onClose } = renderDialog('deleteAccount', fakeClient(), { deleteAccount })

    await userEvents.type(screen.getByLabelText('Digite ana@exemplo.com para confirmar'), 'ana@exemplo.com')
    await userEvents.click(screen.getByRole('button', { name: 'Excluir conta para sempre' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado: boom')
    expect(onClose).not.toHaveBeenCalled()
  })
})
