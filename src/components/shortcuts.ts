const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

export function modifierName(): string {
  return isApple() ? 'Cmd' : 'Ctrl'
}

export function shortcutLabel(key: string): string {
  return isApple() ? `⌘${key}` : `Ctrl+${key}`
}
