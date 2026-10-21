import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { modifierName } from './shortcuts'

export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer')
}

export function linkElementAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-href]') : null
}

const withModifier = (event: MouseEvent) => event.ctrlKey || event.metaKey

export function useEditorLinkClick() {
  const { t } = useTranslation()

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (!withModifier(event)) return
    const href = linkElementAt(event.target)?.dataset.href
    if (!href) return
    event.preventDefault()
    openLink(href)
  }

  const onMouseMove = (event: MouseEvent<HTMLElement>) => {
    const field = event.currentTarget
    const link = linkElementAt(event.target)
    field.style.cursor = link && withModifier(event) ? 'pointer' : ''
    field.title = link ? t('contextMenu.linkHint', { key: modifierName() }) : ''
  }

  return { onClick, onMouseMove }
}
