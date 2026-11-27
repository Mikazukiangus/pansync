import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDaysToDate, formatLocalDate } from '../lib/dates'
import type { FridgeItem } from '../types'

interface FridgeState {
  items: FridgeItem[]
  addItem: (item: { name: string; quantity: string; useBy: string }) => void
  updateItem: (
    id: string,
    patch: Partial<Pick<FridgeItem, 'name' | 'quantity' | 'useBy'>>,
  ) => void
  removeItem: (id: string) => void
  markUsed: (id: string) => void
  restoreItem: (item: FridgeItem) => void
  restoreItems: (items: readonly FridgeItem[]) => void
  removeItemsByIds: (ids: readonly string[]) => void
  loadSampleFridge: (today?: Date) => void
  clearFridge: () => void
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSampleFridgeItems(today: Date = new Date()): FridgeItem[] {
  const addedAt = formatLocalDate(today)
  return [
    {
      id: 'sample-spinach',
      name: 'Baby Spinach',
      quantity: '1 bag (120g)',
      useBy: addDaysToDate(0, today),
      addedAt,
    },
    {
      id: 'sample-rice',
      name: 'Cooked Rice',
      quantity: '2 cups',
      useBy: addDaysToDate(1, today),
      addedAt,
    },
    {
      id: 'sample-chicken',
      name: 'Chicken Breast',
      quantity: '350g',
      useBy: addDaysToDate(2, today),
      addedAt,
    },
    {
      id: 'sample-pepper',
      name: 'Red Bell Pepper',
      quantity: '1 whole',
      useBy: addDaysToDate(3, today),
      addedAt,
    },
    {
      id: 'sample-eggs',
      name: 'Eggs',
      quantity: '6 large',
      useBy: addDaysToDate(5, today),
      addedAt,
    },
    {
      id: 'sample-onion',
      name: 'Spring Onions',
      quantity: '1 bunch',
      useBy: addDaysToDate(6, today),
      addedAt,
    },
    {
      id: 'sample-garlic',
      name: 'Garlic',
      quantity: '1 bulb',
      useBy: addDaysToDate(12, today),
      addedAt,
    },
  ]
}

export const useFridge = create<FridgeState>()(
  persist(
    (set) => ({
      items: [],
      addItem: ({ name, quantity, useBy }) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set((state) => ({
          items: [
            ...state.items,
            {
              id: makeId(),
              name: trimmed,
              quantity: quantity.trim() || '1',
              useBy: useBy.trim(),
              addedAt: formatLocalDate(new Date()),
            },
          ],
        }))
      },
      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  ...(patch.quantity !== undefined
                    ? { quantity: patch.quantity.trim() }
                    : {}),
                  ...(patch.useBy !== undefined ? { useBy: patch.useBy.trim() } : {}),
                }
              : item,
          ),
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      markUsed: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      restoreItem: (item) =>
        set((state) => {
          if (state.items.some((existing) => existing.id === item.id)) {
            return state
          }
          return { items: [...state.items, item] }
        }),
      restoreItems: (restored) =>
        set((state) => {
          const existingIds = new Set(state.items.map((i) => i.id))
          const additions = restored.filter((item) => !existingIds.has(item.id))
          return additions.length > 0 ? { items: [...state.items, ...additions] } : state
        }),
      removeItemsByIds: (ids) => {
        const idSet = new Set(ids)
        set((state) => ({
          items: state.items.filter((item) => !idSet.has(item.id)),
        }))
      },
      loadSampleFridge: (today = new Date()) =>
        set({
          items: createSampleFridgeItems(today),
        }),
      clearFridge: () => set({ items: [] }),
    }),
    {
      name: 'pansync-fridge',
    },
  ),
)
