import { createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteColor } from './types'

type CustomColorNames = ReadonlyMap<NoteColor, string>

export const ColorNamesContext = createContext<CustomColorNames>(new Map())

export function useColorNames() {
  const { t } = useTranslation()
  const custom = useContext(ColorNamesContext)
  return {
    customName: (color: NoteColor) => custom.get(color) ?? '',
    defaultName: (color: NoteColor) => t(`colors.${color}`),
    nameOf: (color: NoteColor) => custom.get(color) || t(`colors.${color}`),
  }
}
