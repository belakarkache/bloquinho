import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { modifierName } from './shortcuts'

export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer')
}

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

export function overlayLinkAt(field: HTMLTextAreaElement, x: number, y: number): HTMLElement | null {
  const overlay = field.previousElementSibling
  if (!overlay) return null
  for (const link of overlay.querySelectorAll<HTMLElement>('[data-href]')) {
    if ([...link.getClientRects()].some((rect) => contains(rect, x, y))) return link
  }
  return null
}

export function linkIndexIn(container: Element, link: HTMLElement): number {
  return [...container.querySelectorAll('[data-link]')].indexOf(link)
}

const withModifier = (event: MouseEvent) => event.ctrlKey || event.metaKey

export function useOverlayLinkClick() {
  const { t } = useTranslation()

  const onClick = (event: MouseEvent<HTMLTextAreaElement>) => {
    if (!withModifier(event)) return
    const href = overlayLinkAt(event.currentTarget, event.clientX, event.clientY)?.dataset.href
    if (!href) return
    event.preventDefault()
    openLink(href)
  }

  const onMouseMove = (event: MouseEvent<HTMLTextAreaElement>) => {
    const field = event.currentTarget
    const link = overlayLinkAt(field, event.clientX, event.clientY)
    field.style.cursor = link && withModifier(event) ? 'pointer' : ''
    field.title = link ? t('contextMenu.linkHint', { key: modifierName() }) : ''
  }

  return { onClick, onMouseMove }
}
