import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlanSlotKey, Recipe } from '../types'

interface PlanState {
  slots: Partial<Record<PlanSlotKey, Recipe>>
  checkedItems: Record<string, boolean>
  recentRecipes: Recipe[]
  setSlot: (key: PlanSlotKey, recipe: Recipe) => void
  removeSlot: (key: PlanSlotKey) => void
  moveSlot: (from: PlanSlotKey, to: PlanSlotKey) => void
  clearPlan: () => void
  toggleChecked: (itemKey: string) => void
  clearChecked: () => void
  recordRecentRecipes: (recipes: readonly Recipe[]) => void
}

export const usePlan = create<PlanState>()(
  persist(
    (set) => ({
      slots: {},
      checkedItems: {},
      recentRecipes: [],
      setSlot: (key, recipe) =>
        set((state) => ({
          slots: {
            ...state.slots,
            [key]: recipe,
          },
        })),
      removeSlot: (key) =>
        set((state) => {
          const next = { ...state.slots }
          delete next[key]
          return { slots: next }
        }),
      moveSlot: (from, to) =>
        set((state) => {
          if (from === to) return state
          const moving = state.slots[from]
          if (!moving) return state
          const targetExisting = state.slots[to]
          const next = { ...state.slots, [to]: moving }
          if (targetExisting) {
            next[from] = targetExisting
          } else {
            delete next[from]
          }
          return { slots: next }
        }),
      clearPlan: () => set({ slots: {}, checkedItems: {} }),
      toggleChecked: (itemKey) =>
        set((state) => ({
          checkedItems: {
            ...state.checkedItems,
            [itemKey]: !state.checkedItems[itemKey],
          },
        })),
      clearChecked: () => set({ checkedItems: {} }),
      recordRecentRecipes: (recipes) =>
        set((state) => {
          const combined = [...recipes, ...state.recentRecipes]
          const seen = new Set<string>()
          const unique: Recipe[] = []
          for (const r of combined) {
            if (!seen.has(r.id)) {
              seen.add(r.id)
              unique.push(r)
            }
            if (unique.length >= 16) break
          }
          return { recentRecipes: unique }
        }),
    }),
    {
      name: 'pansync-plan',
    },
  ),
)
