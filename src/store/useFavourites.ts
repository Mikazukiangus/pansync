import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipe } from '../types'

export interface RemovedFavouriteSnapshot {
  recipe: Recipe
  index: number
}

interface FavouritesState {
  ids: string[]
  recipesById: Record<string, Recipe>
  lastRemoved: RemovedFavouriteSnapshot | null
  toggleFavourite: (recipe: Recipe) => void
  removeFavourite: (id: string) => void
  undoRemoveFavourite: () => void
  dismissLastRemoved: () => void
  isFavourite: (id: string) => boolean
}

export const useFavourites = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      recipesById: {},
      lastRemoved: null,
      toggleFavourite: (recipe) =>
        set((state) => {
          const index = state.ids.indexOf(recipe.id)
          if (index !== -1) {
            const storedRecipe = state.recipesById[recipe.id] ?? recipe
            const nextMap = { ...state.recipesById }
            delete nextMap[recipe.id]
            return {
              ids: state.ids.filter((id) => id !== recipe.id),
              recipesById: nextMap,
              lastRemoved: { recipe: storedRecipe, index },
            }
          }
          return {
            ids: [recipe.id, ...state.ids],
            recipesById: {
              ...state.recipesById,
              [recipe.id]: recipe,
            },
            lastRemoved:
              state.lastRemoved?.recipe.id === recipe.id ? null : state.lastRemoved,
          }
        }),
      removeFavourite: (id) =>
        set((state) => {
          const nextMap = { ...state.recipesById }
          delete nextMap[id]
          return {
            ids: state.ids.filter((x) => x !== id),
            recipesById: nextMap,
            lastRemoved: null,
          }
        }),
      undoRemoveFavourite: () =>
        set((state) => {
          if (!state.lastRemoved) return state
          const { recipe, index } = state.lastRemoved
          if (state.ids.includes(recipe.id)) {
            return { lastRemoved: null }
          }
          const nextIds = [...state.ids]
          const insertAt = Math.max(0, Math.min(index, nextIds.length))
          nextIds.splice(insertAt, 0, recipe.id)
          return {
            ids: nextIds,
            recipesById: {
              ...state.recipesById,
              [recipe.id]: recipe,
            },
            lastRemoved: null,
          }
        }),
      dismissLastRemoved: () => set({ lastRemoved: null }),
      isFavourite: (id) => get().ids.includes(id),
    }),
    {
      name: 'pansync-favourites',
      partialize: (state) => ({
        ids: state.ids,
        recipesById: state.recipesById,
      }),
    },
  ),
)
