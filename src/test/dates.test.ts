import { describe, expect, it } from 'vitest'
import {
  addDaysToDate,
  daysUntil,
  formatExpiryLabel,
  getExpiryStatus,
  getExpiryUrgencyBonus,
  parseLocalDate,
  sortFridgeItemsByExpiry,
} from '../lib/dates'
import type { FridgeItem } from '../types'

describe('dates helpers', () => {
  const refToday = new Date(2026, 10, 27, 15, 30, 0) // 2026-11-27 local

  it('parses valid YYYY-MM-DD strings and rejects invalid ones', () => {
    expect(parseLocalDate('2026-11-27')).not.toBeNull()
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate('2026-02-31')).toBeNull()
    expect(parseLocalDate('27/11/2026')).toBeNull()
  })

  it('computes calendar day differences regardless of time-of-day', () => {
    expect(daysUntil('2026-11-25', refToday)).toBe(-2)
    expect(daysUntil('2026-11-27', refToday)).toBe(0)
    expect(daysUntil('2026-11-28', refToday)).toBe(1)
    expect(daysUntil('2026-11-30', refToday)).toBe(3)
    expect(daysUntil('2026-12-04', refToday)).toBe(7)
    expect(daysUntil('', refToday)).toBeNull()
  })

  it('classifies expiry statuses into expired, today, soon (<=3d), fine, and none', () => {
    expect(getExpiryStatus('2026-11-26', refToday)).toBe('expired')
    expect(getExpiryStatus('2026-11-27', refToday)).toBe('today')
    expect(getExpiryStatus('2026-11-28', refToday)).toBe('soon')
    expect(getExpiryStatus('2026-11-30', refToday)).toBe('soon')
    expect(getExpiryStatus('2026-12-01', refToday)).toBe('fine')
    expect(getExpiryStatus('', refToday)).toBe('none')
  })

  it('formats readable labels and orders urgency bonuses strictly sooner > later', () => {
    expect(formatExpiryLabel('2026-11-25', refToday)).toBe('Expired 2d ago')
    expect(formatExpiryLabel('2026-11-26', refToday)).toBe('Expired yesterday')
    expect(formatExpiryLabel('2026-11-27', refToday)).toBe('Use today')
    expect(formatExpiryLabel('2026-11-28', refToday)).toBe('1 day left')
    expect(formatExpiryLabel('2026-11-30', refToday)).toBe('3 days left')

    const bToday = getExpiryUrgencyBonus(addDaysToDate(0, refToday), refToday)
    const b1d = getExpiryUrgencyBonus(addDaysToDate(1, refToday), refToday)
    const b3d = getExpiryUrgencyBonus(addDaysToDate(3, refToday), refToday)
    const b7d = getExpiryUrgencyBonus(addDaysToDate(7, refToday), refToday)
    const bNone = getExpiryUrgencyBonus('', refToday)

    expect(bToday).toBeGreaterThan(b1d)
    expect(b1d).toBeGreaterThan(b3d)
    expect(b3d).toBeGreaterThan(b7d)
    expect(b7d).toBeGreaterThan(bNone)
  })

  it('sorts fridge items soonest-first and places dateless items at the end', () => {
    const items: FridgeItem[] = [
      { id: '1', name: 'Carrots', quantity: '4', useBy: '2026-12-05', addedAt: '2026-11-27' },
      { id: '2', name: 'Honey', quantity: '1 jar', useBy: '', addedAt: '2026-11-27' },
      { id: '3', name: 'Spinach', quantity: '1 bag', useBy: '2026-11-27', addedAt: '2026-11-27' },
      { id: '4', name: 'Milk', quantity: '500ml', useBy: '2026-11-26', addedAt: '2026-11-27' },
    ]
    const sorted = sortFridgeItemsByExpiry(items, refToday)
    expect(sorted.map((i) => i.name)).toEqual(['Milk', 'Spinach', 'Carrots', 'Honey'])
  })
})
