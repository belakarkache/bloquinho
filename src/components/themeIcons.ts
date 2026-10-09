import { DesktopIcon, MoonIcon, SunIcon, type Icon } from '@phosphor-icons/react'
import type { ThemePreference } from '../theme/theme'

export const THEME_ICON: Record<ThemePreference, Icon> = {
  system: DesktopIcon,
  light: SunIcon,
  dark: MoonIcon,
}
