const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent)

export function modifierName(): string {
  return isApple() ? 'Cmd' : 'Ctrl'
}

export function shortcutLabel(key: string): string {
  return isApple() ? `⌘${key}` : `Ctrl+${key}`
}

export function isSaveShortcut(event: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; key: string }): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
  return event.key === 'Enter' || event.key.toLowerCase() === 's'
}
