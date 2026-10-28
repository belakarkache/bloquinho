import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { cardsRepository } from '../kanban/repository'
import type { Note } from '../notes/types'
import { clearGeminiKey, saveGeminiKey } from './apiKey'
import OrganizeDialog from './OrganizeDialog'

const note = { id: 'note-1', content: '# Casa\n- comprar pão\n- lavar louça' } as Note

function geminiReply(tasks: unknown[]) {
  const body = { candidates: [{ content: { parts: [{ text: JSON.stringify({ tasks }) }] } }] }
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('OrganizeDialog', () => {
  beforeEach(async () => {
    await db.cards.clear()
    saveGeminiKey('test-key')
  })

  afterEach(() => {
    clearGeminiKey()
    vi.unstubAllGlobals()
  })

  it('reviews the suggestions and creates the remaining cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        geminiReply([
          { title: 'Comprar pão', description: '', folder: 'Casa', sourceExcerpt: '- comprar pão' },
          { title: 'Lavar louça', description: '', folder: 'Casa', sourceExcerpt: '- lavar louça' },
        ]),
      ),
    )
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<OrganizeDialog note={note} onDone={onDone} onClose={() => {}} />)

    const second = await screen.findByRole('listitem', { name: 'Tarefa 2' })
    await user.click(within(second).getByRole('button', { name: 'Remover tarefa' }))
    const title = within(screen.getByRole('listitem', { name: 'Tarefa 1' })).getByRole('textbox', { name: 'Título' })
    await user.clear(title)
    await user.type(title, 'Comprar pão integral')
    await user.click(screen.getByRole('button', { name: 'Criar 1 cartão' }))

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    const cards = await cardsRepository.listVisible()
    expect(cards).toMatchObject([
      { title: 'Comprar pão integral', folder: 'Casa', column: 'todo', sourceExcerpt: '- comprar pão' },
    ])
    expect(onDone).toHaveBeenCalledWith({ cardIds: [cards[0].id], deleteNote: true })
  })

  it('keeps the note when the delete option is unchecked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(geminiReply([{ title: 'Ligar', description: '', folder: null, sourceExcerpt: '' }])),
    )
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<OrganizeDialog note={note} onDone={onDone} onClose={() => {}} />)
    await user.click(await screen.findByRole('checkbox', { name: 'Excluir a nota depois de criar os cartões' }))
    await user.click(screen.getByRole('button', { name: 'Criar 1 cartão' }))
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ deleteNote: false })))
  })

  it('shows the error and retries', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(geminiReply([]))
    vi.stubGlobal('fetch', fetchFn)
    const user = userEvent.setup()
    render(<OrganizeDialog note={note} onDone={() => {}} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Nenhuma tarefa encontrada')).toBeInTheDocument()
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('asks for a key before calling Gemini', () => {
    clearGeminiKey()
    const fetchFn = vi.fn()
    vi.stubGlobal('fetch', fetchFn)
    render(<OrganizeDialog note={note} onDone={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Organizar com IA' })).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
