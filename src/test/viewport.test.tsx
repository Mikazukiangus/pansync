import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useViewport } from '../hooks/useViewport'

function mockMatchMedia(matchesMap: Record<string, boolean>) {
  const listeners = new Map<string, Set<() => void>>()
  const currentMatches = { ...matchesMap }

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return Boolean(currentMatches[query])
      },
      media: query,
      addEventListener: (_: string, cb: () => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set())
        listeners.get(query)!.add(cb)
      },
      removeEventListener: (_: string, cb: () => void) => {
        listeners.get(query)?.delete(cb)
      },
    })),
  )

  return {
    update(next: Record<string, boolean>) {
      Object.assign(currentMatches, next)
      for (const set of listeners.values()) {
        for (const cb of set) cb()
      }
    },
  }
}

describe('useViewport dynamic browser/device detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.device
    delete document.documentElement.dataset.input
  })

  it('detects mobile touch browser vs desktop mouse browser dynamically', () => {
    const media = mockMatchMedia({
      '(max-width: 767px)': true,
      '(min-width: 768px) and (max-width: 1023px)': false,
      '(pointer: coarse)': true,
      '(hover: hover) and (pointer: fine)': false,
      '(prefers-reduced-motion: reduce)': false,
    })

    const { result } = renderHook(() => useViewport())

    expect(result.current.device).toBe('mobile')
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isTouchDevice).toBe(true)
    expect(result.current.canHover).toBe(false)
    expect(document.documentElement.dataset.device).toBe('mobile')
    expect(document.documentElement.dataset.input).toBe('touch')

    act(() => {
      media.update({
        '(max-width: 767px)': false,
        '(pointer: coarse)': false,
        '(hover: hover) and (pointer: fine)': true,
      })
    })

    expect(result.current.device).toBe('desktop')
    expect(result.current.isDesktop).toBe(true)
    expect(result.current.canHover).toBe(true)
    expect(document.documentElement.dataset.device).toBe('desktop')
  })
})
