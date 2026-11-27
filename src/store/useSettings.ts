import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_STAPLES } from '../data/aliases'
import { normalize } from '../lib/matching'

interface SettingsState {
  staples: string[]
  excludedIngredients: string[]
  addStaple: (name: string) => void
  removeStaple: (name: string) => void
  resetStaples: () => void
  addExcluded: (name: string) => void
  removeExcluded: (name: string) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      staples: [...DEFAULT_STAPLES],
      excludedIngredients: [],
      addStaple: (name) => {
        const cleaned = name.trim().toLowerCase()
        if (!cleaned) return
        set((state) => {
          if (state.staples.some((s) => normalize(s) === normalize(cleaned))) {
            return state
          }
          return { staples: [...state.staples, cleaned] }
        })
      },
      removeStaple: (name) =>
        set((state) => ({
          staples: state.staples.filter((s) => normalize(s) !== normalize(name)),
        })),
      resetStaples: () => set({ staples: [...DEFAULT_STAPLES] }),
      addExcluded: (name) => {
        const cleaned = name.trim().toLowerCase()
        if (!cleaned) return
        set((state) => {
          if (
            state.excludedIngredients.some((e) => normalize(e) === normalize(cleaned))
          ) {
            return state
          }
          return { excludedIngredients: [...state.excludedIngredients, cleaned] }
        })
      },
      removeExcluded: (name) =>
        set((state) => ({
          excludedIngredients: state.excludedIngredients.filter(
            (e) => normalize(e) !== normalize(name),
          ),
        })),
    }),
    {
      name: 'pansync-settings',
    },
  ),
)
