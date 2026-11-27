import { create } from 'zustand'
import { normalize } from '../lib/matching'

export type SearchMode = 'ingredients' | 'dish'

interface SearchState {
  searchMode: SearchMode
  dishQuery: string
  manualIngredients: string[]
  fridgeMode: boolean
  maxMissing: number | null
  setSearchMode: (mode: SearchMode) => void
  setDishQuery: (query: string) => void
  clearDishQuery: () => void
  addIngredients: (rawInput: string) => void
  setIngredients: (items: readonly string[]) => void
  removeIngredient: (name: string) => void
  clearIngredients: () => void
  setFridgeMode: (enabled: boolean) => void
  setMaxMissing: (max: number | null) => void
}

export const useSearch = create<SearchState>((set) => ({
  searchMode: 'ingredients',
  dishQuery: '',
  manualIngredients: [],
  fridgeMode: false,
  maxMissing: null,
  setSearchMode: (mode) => set({ searchMode: mode }),
  setDishQuery: (query) => set({ dishQuery: query }),
  clearDishQuery: () => set({ dishQuery: '' }),
  addIngredients: (rawInput) => {
    const parts = rawInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return

    set((state) => {
      const next = [...state.manualIngredients]
      for (const part of parts) {
        const norm = normalize(part)
        if (norm && !next.some((existing) => normalize(existing) === norm)) {
          next.push(part)
        }
      }
      return { manualIngredients: next }
    })
  },
  setIngredients: (items) => set({ manualIngredients: [...items] }),
  removeIngredient: (name) =>
    set((state) => ({
      manualIngredients: state.manualIngredients.filter(
        (item) => normalize(item) !== normalize(name),
      ),
    })),
  clearIngredients: () => set({ manualIngredients: [] }),
  setFridgeMode: (enabled) => set({ fridgeMode: enabled }),
  setMaxMissing: (max) => set({ maxMissing: max }),
}))
