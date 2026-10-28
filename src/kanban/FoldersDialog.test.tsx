import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { FoldersDialog } from './FoldersDialog'
import { cardsRepository } from './repository'

describe('FoldersDialog', () => {
  beforeEach(async () => {
    await db.cards.clear()
    await db.folders.clear()
  })

  it('renames and recolors a folder on close', async () => {
    await cardsRepository.create({ title: 'Lavar louça', folder: 'Casa' })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<FoldersDialog onClose={onClose} />)

    const name = await screen.findByRole('textbox', { name: 'Renomear Casa' })
    await user.clear(name)
    await user.type(name, 'Lar')
    await user.click(screen.getByRole('button', { name: 'Cor da pasta Casa' }))
    await user.click(screen.getByRole('radio', { name: 'Menta' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))

    expect(onClose).toHaveBeenCalled()
    await vi.waitFor(async () => {
      expect((await cardsRepository.listVisible())[0].folder).toBe('Lar')
      expect((await db.folders.get('Lar'))?.color).toBe('mint')
    })
  })

  it('explains how to create folders when there are none', async () => {
    render(<FoldersDialog onClose={() => {}} />)
    expect(await screen.findByText('Nenhuma pasta ainda. Crie uma ao editar um cartão.')).toBeInTheDocument()
  })
})
