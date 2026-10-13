import { db } from '../db/database'
import { supabase } from '../lib/supabase'
import { NOTE_COLORS, NOTE_MAX_LENGTH, type Note, type NoteColor } from '../notes/types'

const SEED_KEY = 'bloquinho:seed-ids'
const HOUR = 60 * 60 * 1000

interface SeedNote {
  content: string
  color?: NoteColor
  pinned?: boolean
}

const SCENARIOS: SeedNote[] = [
  { content: 'Lista de compras\n- [ ] Pão\n- [x] Leite\n- [ ] Café\n- [x] Ovos\n- [ ] Frutas', color: 'lemon', pinned: true },
  { content: 'Reunião segunda\n## Pauta\n1. Roadmap\n2. Bugs abertos\n3. Deploy', color: 'sky', pinned: true },
  { content: 'Formatação\n**negrito**, _itálico_, ~~riscado~~ e `código`\n- item um\n- item dois', color: 'lavender' },
  { content: 'Links\n[Documentação](https://vite.dev) e https://example.com/um/caminho/bem/longo?x=1', color: 'aqua' },
  { content: 'Trecho de código\n```\nconst soma = (a, b) => a + b\nconsole.log(soma(1, 2))\n```', color: 'mint' },
  { content: 'Só um título' },
  { content: '\nNota sem título, só corpo de texto.', color: 'coral' },
  { content: 'Palavra enorme\nsuperextraordinariamenteinconstitucionalissimamentepalavragigantesemespacos', color: 'bubblegum' },
  { content: 'Emojis 🎉🍕🚀\nTexto com acentuação: ação, coração, pão, avó.', color: 'lime' },
  {
    content: `Nota longa (preview cortado)\n${Array.from({ length: 30 }, (_, i) => `Linha ${i + 1} de um texto comprido para testar o corte.`).join('\n')}`,
  },
  { content: `Checklist grande\n${Array.from({ length: 15 }, (_, i) => `- [${i % 3 === 0 ? 'x' : ' '}] Tarefa ${i + 1}`).join('\n')}`, color: 'mint' },
  { content: `Limite de caracteres\n${'a'.repeat(NOTE_MAX_LENGTH - 21)}`, color: 'coral' },
]

function filler(index: number): SeedNote {
  return {
    content: `Nota extra ${index + 1}\n${'Texto de preenchimento. '.repeat((index % 6) + 1)}`,
    color: NOTE_COLORS[index % NOTE_COLORS.length],
    pinned: index % 17 === 0,
  }
}

function toNote(seed: SeedNote, index: number, now: number): Note {
  const timestamp = now - index * HOUR
  return {
    id: crypto.randomUUID(),
    content: seed.content,
    color: seed.color ?? 'default',
    pinned: seed.pinned ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    syncState: 'pending',
  }
}

function seededIds(): string[] {
  return JSON.parse(localStorage.getItem(SEED_KEY) ?? '[]') as string[]
}

async function assertSignedOut(): Promise<void> {
  const session = await supabase?.auth.getSession()
  if (session?.data.session) throw new Error('Saia da conta antes de usar o seed, senão as notas sobem pro Supabase.')
}

async function seed(extra = 0): Promise<number> {
  await assertSignedOut()
  const now = Date.now()
  const notes = [...SCENARIOS, ...Array.from({ length: extra }, (_, i) => filler(i))].map((note, i) => toNote(note, i, now))
  await db.notes.bulkAdd(notes)
  localStorage.setItem(SEED_KEY, JSON.stringify([...seededIds(), ...notes.map((note) => note.id)]))
  return notes.length
}

async function unseed(): Promise<number> {
  await assertSignedOut()
  const ids = seededIds()
  await db.notes.bulkDelete(ids)
  localStorage.removeItem(SEED_KEY)
  return ids.length
}

Object.assign(window, { seed, unseed })
