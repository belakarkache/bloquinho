import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { ContextMenuProvider } from './components/ContextMenu'
import { db } from './db/database'
import { notesRepository } from './notes/repository'

function renderApp() {
  return render(
    <AuthProvider>
      <ContextMenuProvider>
        <App />
      </ContextMenuProvider>
    </AuthProvider>,
  )
}

describe('App', () => {
  beforeEach(async () => {
    await db.clearAll()
  })

  it('shows the empty state and hides sign in without Supabase', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Seu bloquinho está vazio' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('creates a note from the composer with Ctrl+Enter', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('textbox', { name: 'Anote algo…' }))
    await user.keyboard('# Mercado{Enter}leite{Control>}{Enter}{/Control}')
    expect(await screen.findByRole('heading', { name: 'Mercado' })).toBeInTheDocument()
    expect(screen.getByText('leite')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Anote algo…' })).toHaveValue('')
  })

  it('focuses the composer when the logo is clicked', async () => {
    const user = userEvent.setup()
    renderApp()
    const composer = screen.getByRole('textbox', { name: 'Anote algo…' })
    composer.blur()
    await user.click(screen.getByRole('button', { name: 'Nova nota' }))
    expect(composer).toHaveFocus()
  })

  it('saves the draft when the composer loses focus', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByRole('textbox', { name: 'Anote algo…' }), '# ideia')
    await user.click(document.body)
    expect(await screen.findByRole('heading', { name: 'ideia' })).toBeInTheDocument()
    expect(await db.notes.count()).toBe(1)
  })

  it('filters notes by color', async () => {
    await notesRepository.create({ content: '# Comprar café', color: 'coral' })
    await notesRepository.create({ content: '# Ligar para Ana', color: 'sky' })
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: 'Comprar café' })

    const filter = screen.getAllByRole('radiogroup', { name: 'Cor' })[0]
    await user.click(within(filter).getByRole('radio', { name: 'Céu' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Comprar café' })).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Ligar para Ana' })).toBeInTheDocument()
  })

  it('searches notes in the floating panel and opens the chosen one', async () => {
    await notesRepository.create({ content: '# Comprar café\n- [ ] moído' })
    await notesRepository.create({ content: '# Ligar para Ana' })
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: 'Comprar café' })

    await user.click(screen.getByRole('button', { name: 'Buscar notas' }))
    const panel = screen.getByRole('dialog', { name: 'Buscar notas' })
    const input = within(panel).getByRole('combobox', { name: 'Buscar notas' })
    expect(input).toHaveFocus()
    await user.type(input, 'cafe')
    const results = within(panel).getByRole('listbox', { name: 'Resultados' })
    expect(within(results).getAllByRole('option')).toHaveLength(1)
    expect(within(results).getByRole('option')).toHaveTextContent('Comprar café')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar notas' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Abrir nota' })).toBeInTheDocument()
  })

  it('shows a message when the search matches nothing and clears before closing on Escape', async () => {
    await notesRepository.create({ content: '# algo' })
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: 'algo' })
    await user.click(screen.getByRole('button', { name: 'Buscar notas' }))
    await user.keyboard('zebra')
    expect(screen.getByText('Nenhuma nota encontrada')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('combobox', { name: 'Buscar notas' })).toHaveValue('')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar notas' })).not.toBeInTheDocument())
  })

  it('pins a note into the pinned section', async () => {
    await notesRepository.create({ content: '# importante' })
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: 'importante' })
    await user.click(screen.getByRole('button', { name: 'Fixar' }))
    expect(await screen.findByRole('heading', { name: 'Fixadas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desafixar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('deletes a note and undoes the deletion', async () => {
    await notesRepository.create({ content: '# temporária' })
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: 'temporária' })
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Nota excluída')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'temporária' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('heading', { name: 'temporária' })).toBeInTheDocument()
  })

  it('deletes a note from the editor after it closes', async () => {
    await notesRepository.create({ content: '# descartável' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Abrir nota: descartável' }))
    const editor = screen.getByRole('dialog', { name: 'Abrir nota' })
    await user.click(within(editor).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Nota excluída')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'descartável' })).not.toBeInTheDocument())
    expect(await notesRepository.listVisible()).toEqual([])
  })

  it('edits a note in the editor', async () => {
    await notesRepository.create({ content: '# rascunho' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Abrir nota: rascunho' }))
    const editor = screen.getByRole('textbox', { name: 'Nota' })
    await user.clear(editor)
    await user.type(editor, '# versão final')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(await screen.findByRole('heading', { name: 'versão final' })).toBeInTheDocument()
    expect((await notesRepository.listVisible())[0].content).toBe('# versão final')
  })

  it('checks a checklist item from the card', async () => {
    await notesRepository.create({ content: '# Mercado\n- [ ] leite' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('checkbox', { name: 'leite' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'leite' })).toHaveAttribute('aria-checked', 'true'))
    expect((await notesRepository.listVisible())[0].content).toBe('# Mercado\n- [x] leite')
  })

  it('writes a checklist in the composer', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('textbox', { name: 'Anote algo…' }))
    await user.keyboard('Mercado{Enter}leite')
    await user.click(screen.getByRole('button', { name: 'Lista de tarefas' }))
    await user.keyboard('{Enter}pão{Enter}{Enter}fim')
    expect(screen.getByRole('textbox', { name: 'Anote algo…' })).toHaveValue('Mercado\n- [ ] leite\n- [ ] pão\nfim')
  })

  it('shows a checklist in the editor and checks items there', async () => {
    await notesRepository.create({ content: '# Mercado\n- [ ] leite' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Abrir nota: Mercado' }))
    const editor = screen.getByRole('dialog', { name: 'Abrir nota' })
    expect(within(editor).queryByText('- [ ] leite')).not.toBeInTheDocument()
    expect(within(editor).getByRole('textbox', { name: 'Item da lista' })).not.toHaveFocus()

    await user.click(within(editor).getByRole('checkbox', { name: 'leite' }))
    await user.click(within(editor).getByRole('textbox', { name: 'Item da lista' }))
    await user.keyboard('{End}{Enter}pão')
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(async () =>
      expect((await notesRepository.listVisible())[0].content).toBe('# Mercado\n- [x] leite\n- [ ] pão'),
    )
  })

  it('deletes a note emptied in the editor and restores it on undo', async () => {
    await notesRepository.create({ content: '# rascunho' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Abrir nota: rascunho' }))
    await user.clear(screen.getByRole('textbox', { name: 'Nota' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(await screen.findByText('Nota excluída')).toBeInTheDocument()
    await waitFor(async () => expect(await notesRepository.listVisible()).toEqual([]))

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByRole('heading', { name: 'rascunho' })).toBeInTheDocument()
  })

  it('focuses the composer on start when using a mouse', async () => {
    const original = window.matchMedia
    window.matchMedia = (query: string) => ({ ...original(query), matches: query === '(pointer: fine)' })
    try {
      renderApp()
      expect(screen.getByRole('textbox', { name: 'Anote algo…' })).toHaveFocus()
    } finally {
      window.matchMedia = original
    }
  })

  it('opens the search with the slash and Ctrl+K shortcuts', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.keyboard('/')
    expect(screen.getByRole('combobox', { name: 'Buscar notas' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buscar notas' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('textbox', { name: 'Anote algo…' }))
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('combobox', { name: 'Buscar notas' })).toHaveFocus()
  })

  it('changes the theme from the menu', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement).toHaveClass('dark')
    await user.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('switches the interface to English', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await user.click(screen.getByRole('radio', { name: 'English' }))
    expect(await screen.findByRole('textbox', { name: 'Take a note…' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Português' }))
  })
})

describe('context menu', () => {
  beforeEach(async () => {
    await db.clearAll()
  })

  async function rightClick(user: ReturnType<typeof userEvent.setup>, target: Element) {
    await user.pointer({ keys: '[MouseRight]', target })
    return screen.findByRole('menu')
  }

  it('pins a note from the card menu and closes', async () => {
    await notesRepository.create({ content: '# importante' })
    const user = userEvent.setup()
    renderApp()
    const menu = await rightClick(user, await screen.findByRole('heading', { name: 'importante' }))
    await user.click(within(menu).getByRole('menuitem', { name: 'Fixar' }))
    expect(await screen.findByRole('heading', { name: 'Fixadas' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('recolors and duplicates a note from the card menu', async () => {
    await notesRepository.create({ content: '# cópia' })
    const user = userEvent.setup()
    renderApp()
    const card = await screen.findByRole('heading', { name: 'cópia' })
    await user.click(within(await rightClick(user, card)).getByRole('menuitemradio', { name: 'Céu' }))
    await waitFor(async () => expect((await notesRepository.listVisible())[0].color).toBe('sky'))

    await user.click(within(await rightClick(user, card)).getByRole('menuitem', { name: 'Duplicar' }))
    await waitFor(async () => expect(await notesRepository.listVisible()).toHaveLength(2))
  })

  it('selects items with the keyboard and closes on Escape', async () => {
    await notesRepository.create({ content: '# teclado' })
    const user = userEvent.setup()
    renderApp()
    const card = await screen.findByRole('heading', { name: 'teclado' })
    await rightClick(user, card)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await rightClick(user, card)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(await screen.findByRole('heading', { name: 'Fixadas' })).toBeInTheDocument()
  })

  it('changes the theme from the background menu and keeps the app menu in sync', async () => {
    const user = userEvent.setup()
    renderApp()
    const menu = await rightClick(user, screen.getByRole('main'))
    expect(within(menu).getByRole('menuitem', { name: 'Nova nota' })).toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitemradio', { name: 'Escuro' }))
    expect(document.documentElement).toHaveClass('dark')

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('radio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'Sistema' }))
  })

  it('blocks the native menu unless Shift is held', async () => {
    renderApp()
    const main = screen.getByRole('main')
    expect(fireEvent.contextMenu(main, { shiftKey: true })).toBe(true)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(fireEvent.contextMenu(main)).toBe(false)
    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })

  it('formats the composer text from its menu', async () => {
    const user = userEvent.setup()
    renderApp()
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Anote algo…' })
    await user.type(composer, 'ideia')
    composer.setSelectionRange(0, 5)
    fireEvent.contextMenu(composer, { clientX: 20, clientY: 20 })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Recortar' })).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(within(menu).getByRole('menuitem', { name: 'Negrito (Ctrl+B)' }))
    expect(composer).toHaveValue('**ideia**')
  })

  it('deletes the open note from the editor menu', async () => {
    await notesRepository.create({ content: '# descartável' })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Abrir nota: descartável' }))
    const editor = screen.getByRole('dialog', { name: 'Abrir nota' })
    const menu = await rightClick(user, within(editor).getByText(/^Editada em/))
    await user.click(within(menu).getByRole('menuitem', { name: 'Excluir' }))
    expect(await screen.findByText('Nota excluída')).toBeInTheDocument()
  })
})
