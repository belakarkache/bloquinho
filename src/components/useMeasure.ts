import { useCallback, useEffect, useRef, useState } from 'react'

function blockSize(entry: ResizeObserverEntry): number {
  return entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export function useHeights() {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map())
  const observerRef = useRef<ResizeObserver | null>(null)

  const getObserver = useCallback(() => {
    observerRef.current ??= new ResizeObserver((entries) => {
      setHeights((previous) => {
        let next: Map<string, number> | null = null
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.measureId
          const height = blockSize(entry)
          if (!id || previous.get(id) === height) continue
          next ??= new Map(previous)
          next.set(id, height)
        }
        return next ?? previous
      })
    })
    return observerRef.current
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const measure = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      const observer = getObserver()
      observer.observe(element)
      return () => observer.unobserve(element)
    },
    [getObserver],
  )

  return [heights, measure] as const
}

export function useOverflow<Frame extends HTMLElement, Content extends HTMLElement>() {
  const frameRef = useRef<Frame>(null)
  const contentRef = useRef<Content>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return
    const observer = new ResizeObserver(() => setOverflowing(content.offsetHeight > frame.clientHeight + 1))
    observer.observe(frame)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return { frameRef, contentRef, overflowing }
}
