import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipe } from '../types'

interface FavouritesState {
  ids: string[]
  recipesById: Record<string, Recipe>
  toggleFavourite: (recipe: Recipe) => void
  removeFavourite: (id: string) => void
  isFavourite: (id: string) => boolean
}

export const useFavourites = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      recipesById: {},
      toggleFavourite: (recipe) =>
        set((state) => {
          const exists = state.ids.includes(recipe.id)
          if (exists) {
            const nextMap = { ...state.recipesById }
            delete nextMap[recipe.id]
            return {
              ids: state.ids.filter((id) => id !== recipe.id),
              recipesById: nextMap,
            }
          }
          return {
            ids: [recipe.id, ...state.ids],
            recipesById: {
              ...state.recipesById,
              [recipe.id]: recipe,
            },
          }
        }),
      removeFavourite: (id) =>
        set((state) => {
          const nextMap = { ...state.recipesById }
          delete nextMap[id]
          return {
            ids: state.ids.filter((x) => x !== id),
            recipesById: nextMap,
          }
        }),
      isFavourite: (id) => get().ids.includes(id),
    }),
    {
      name: 'pansync-favourites',
    },
  ),
)
