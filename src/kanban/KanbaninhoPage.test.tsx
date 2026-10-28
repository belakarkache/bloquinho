import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { db } from '../db/database'
import KanbaninhoPage from './KanbaninhoPage'
import { cardsRepository } from './repository'

function renderPage() {
  return render(
    <AuthProvider>
      <KanbaninhoPage />
    </AuthProvider>,
  )
}

function column(name: string) {
  return screen.getByRole('region', { name })
}

describe('KanbaninhoPage', () => {
  beforeEach(async () => {
    await db.cards.clear()
  })

  it('creates a card in the todo column', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }))
    await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Comprar pão')
    await user.type(screen.getByRole('combobox', { name: 'Pasta' }), 'Casa')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await within(column('A fazer')).findByText('Comprar pão')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Casa' })).toBeInTheDocument()
  })

  it('edits, moves and shows the source excerpt of a card', async () => {
    await cardsRepository.create({ title: 'Ligar pro banco', sourceExcerpt: '- ligar pro banco amanhã' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Abrir cartão: Ligar pro banco' }))
    await user.click(screen.getByRole('button', { name: 'Ver trecho original' }))
    expect(screen.getByText('- ligar pro banco amanhã')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Fazendo' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await within(column('Fazendo')).findByText('Ligar pro banco')).toBeInTheDocument()
    expect(within(column('A fazer')).queryByText('Ligar pro banco')).not.toBeInTheDocument()
  })

  it('deletes a card and undoes it', async () => {
    await cardsRepository.create({ title: 'Apagar' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Abrir cartão: Apagar' }))
    await user.click(screen.getByRole('button', { name: 'Excluir cartão' }))
    expect(await screen.findByText('Cartão excluído')).toBeInTheDocument()
    await waitFor(() => expect(within(column('A fazer')).queryByText('Apagar')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await within(column('A fazer')).findByText('Apagar')).toBeInTheDocument()
  })
})
