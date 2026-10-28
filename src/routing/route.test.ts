import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { navigate, routeFromPath, useRoute } from './route'

describe('routeFromPath', () => {
  it('maps known paths and falls back to notes', () => {
    expect(routeFromPath('/')).toBe('notes')
    expect(routeFromPath('/kanbaninho')).toBe('kanbaninho')
    expect(routeFromPath('/kanbaninho/')).toBe('kanbaninho')
    expect(routeFromPath('/outra')).toBe('notes')
  })
})

describe('useRoute', () => {
  afterEach(() => history.replaceState(null, '', '/'))

  it('follows navigate and the back button', async () => {
    const { result } = renderHook(() => useRoute())
    expect(result.current).toBe('notes')

    act(() => navigate('kanbaninho'))
    expect(result.current).toBe('kanbaninho')
    expect(location.pathname).toBe('/kanbaninho')

    const length = history.length
    act(() => navigate('kanbaninho'))
    expect(history.length).toBe(length)

    await act(async () => {
      const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
      history.back()
      await popped
    })
    expect(result.current).toBe('notes')
  })
})
