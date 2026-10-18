import type { BloquinhoDB } from '../db/database'
import type { ColorLabel, ColorLabelData } from '../notes/types'
import type { NotesRemote } from './remote'

export async function syncColorLabels(db: BloquinhoDB, remote: NotesRemote): Promise<void> {
  const pending = await db.pendingColorLabels().toArray()
  const remoteLabels = await remote.syncColorLabels(pending.map(toOutgoingLabel))

  await db.transaction('rw', db.colorLabels, async () => {
    for (const sent of pending) {
      const current = await db.colorLabels.get(sent.color)
      if (current?.updatedAt === sent.updatedAt) await db.colorLabels.update(sent.color, { syncState: 'synced' })
    }
    for (const incoming of remoteLabels) {
      const local = await db.colorLabels.get(incoming.color)
      if (local && local.updatedAt >= incoming.updatedAt) continue
      await db.colorLabels.put({ ...incoming, syncState: 'synced' })
    }
  })
}

function toOutgoingLabel({ color, name, updatedAt }: ColorLabel): ColorLabelData {
  return { color, name, updatedAt }
}
