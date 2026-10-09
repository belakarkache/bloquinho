import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion'
import { afterEach } from 'vitest'
import i18n from '../i18n'

void i18n.changeLanguage('pt')

MotionGlobalConfig.skipAnimations = true

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.open = true
}

afterEach(() => cleanup())

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

globalThis.ResizeObserver ??= class {
  #callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }
  observe(target: Element) {
    const entry = {
      target,
      contentRect: { width: 800, height: 100 },
      borderBoxSize: [{ blockSize: 100, inlineSize: 800 }],
    } as unknown as ResizeObserverEntry
    queueMicrotask(() => this.#callback([entry], this as unknown as ResizeObserver))
  }
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
