import type { ExpiryStatus, FridgeItem } from '../types'

/**
 * Parse a YYYY-MM-DD date string into a local midnight Date.
 */
export function parseLocalDate(ymd: string): Date | null {
  const trimmed = ymd.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/**
 * Format a Date object as local YYYY-MM-DD.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Return a YYYY-MM-DD string offset by `days` from the reference date.
 */
export function addDaysToDate(days: number, base: Date = new Date()): string {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  start.setDate(start.getDate() + days)
  return formatLocalDate(start)
}

/**
 * Whole calendar days between `today` (at local midnight) and `useBy`.
 * Negative = past use-by, 0 = expires today, positive = days remaining.
 */
export function daysUntil(useBy: string, today: Date = new Date()): number | null {
  const target = parseLocalDate(useBy)
  if (!target) return null
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = target.getTime() - startOfToday.getTime()
  return Math.round(diffMs / 86_400_000)
}

/**
 * Categorize a use-by date into badge states:
 * - 'expired': < 0 days
 * - 'today': 0 days
 * - 'soon': 1..3 days (<= 3 days)
 * - 'fine': > 3 days
 * - 'none': empty/invalid date
 */
export function getExpiryStatus(useBy: string, today: Date = new Date()): ExpiryStatus {
  const days = daysUntil(useBy, today)
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  if (days === 0) return 'today'
  if (days <= 3) return 'soon'
  return 'fine'
}

/**
 * Human-friendly label for expiry badges.
 */
export function formatExpiryLabel(useBy: string, today: Date = new Date()): string {
  const days = daysUntil(useBy, today)
  if (days === null) return 'No use-by date'
  if (days < -1) return `Expired ${Math.abs(days)}d ago`
  if (days === -1) return 'Expired yesterday'
  if (days === 0) return 'Use today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

/**
 * Monotonically decreasing score bonus for items expiring sooner in fridge mode.
 * Earlier expiry dates strictly produce higher bonuses.
 */
export function getExpiryUrgencyBonus(useBy: string, today: Date = new Date()): number {
  const days = daysUntil(useBy, today)
  if (days === null) return 0
  if (days < 0) return 0.52
  if (days === 0) return 0.48
  if (days === 1) return 0.38
  if (days === 2) return 0.3
  if (days === 3) return 0.24
  if (days <= 14) {
    return Number((0.02 + ((15 - days) / 12) * 0.16).toFixed(4))
  }
  return 0.01
}

/**
 * Sort fridge items with soonest use-by date first; dateless items last.
 */
export function sortFridgeItemsByExpiry(
  items: readonly FridgeItem[],
  today: Date = new Date(),
): FridgeItem[] {
  return [...items].sort((a, b) => {
    const da = daysUntil(a.useBy, today)
    const db = daysUntil(b.useBy, today)
    if (da === null && db === null) return a.name.localeCompare(b.name)
    if (da === null) return 1
    if (db === null) return -1
    if (da !== db) return da - db
    return a.name.localeCompare(b.name)
  })
}
