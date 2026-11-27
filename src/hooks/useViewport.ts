import { useEffect, useState } from 'react'

export type DeviceClass = 'mobile' | 'tablet' | 'desktop'

export interface ViewportInfo {
  device: DeviceClass
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouchDevice: boolean
  canHover: boolean
  prefersReducedMotion: boolean
}

function safeMatchMedia(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(query).matches
}

export function detectViewport(): ViewportInfo {
  const isMobile = safeMatchMedia('(max-width: 767px)')
  const isTablet = safeMatchMedia('(min-width: 768px) and (max-width: 1023px)')
  const isDesktop = !isMobile && !isTablet

  const coarsePointer = safeMatchMedia('(pointer: coarse)')
  const hasTouchPoints =
    typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0
  const isTouchDevice = coarsePointer || hasTouchPoints

  const canHover = safeMatchMedia('(hover: hover) and (pointer: fine)')
  const prefersReducedMotion = safeMatchMedia('(prefers-reduced-motion: reduce)')

  const device: DeviceClass = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  return {
    device,
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    canHover,
    prefersReducedMotion,
  }
}

/**
 * Dynamically tracks browser viewport class (mobile / tablet / desktop) and
 * pointer capabilities (touch vs fine mouse/hover) using matchMedia listeners.
 */
export function useViewport(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(() => detectViewport())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const queries = [
      window.matchMedia('(max-width: 767px)'),
      window.matchMedia('(min-width: 768px) and (max-width: 1023px)'),
      window.matchMedia('(pointer: coarse)'),
      window.matchMedia('(hover: hover) and (pointer: fine)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ]

    const sync = () => {
      const next = detectViewport()
      setInfo(next)
      document.documentElement.dataset.device = next.device
      document.documentElement.dataset.input = next.isTouchDevice ? 'touch' : 'mouse'
    }

    document.documentElement.dataset.device = info.device
    document.documentElement.dataset.input = info.isTouchDevice ? 'touch' : 'mouse'

    for (const mq of queries) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', sync)
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(sync)
      }
    }

    return () => {
      for (const mq of queries) {
        if (typeof mq.removeEventListener === 'function') {
          mq.removeEventListener('change', sync)
        } else if (typeof mq.removeListener === 'function') {
          mq.removeListener(sync)
        }
      }
    }
  }, [info.device, info.isTouchDevice])

  return info
}
