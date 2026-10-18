import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, type ReactNode } from 'react'
import { db } from '../db/database'
import { ColorNamesContext } from './colorNames'
import type { ColorLabel } from './types'

const NO_LABELS: ColorLabel[] = []

export function ColorNamesProvider({ children }: { children: ReactNode }) {
  const labels = useLiveQuery(() => db.colorLabels.toArray(), [], NO_LABELS)
  const names = useMemo(
    () => new Map(labels.filter((label) => label.name).map((label) => [label.color, label.name])),
    [labels],
  )
  return <ColorNamesContext value={names}>{children}</ColorNamesContext>
}
