import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  extractUniqueIngredients,
  getFallbackRecipes,
  loadRecipeDataset,
  type LoadedRecipeDataset,
} from '../data/mealdb'
import type { Recipe } from '../types'

const EMPTY_RECIPES: Recipe[] = []
const EMPTY_INGREDIENTS: string[] = []

let sharedPromise: Promise<LoadedRecipeDataset> | null = null
let sharedCache: LoadedRecipeDataset | null = null

export function resetRecipesMemoryCacheForTests() {
  sharedPromise = null
  sharedCache = null
}

export function useRecipes() {
  const [dataset, setDataset] = useState<LoadedRecipeDataset | null>(() => sharedCache)
  const [loading, setLoading] = useState<boolean>(() => sharedCache === null)

  useEffect(() => {
    if (sharedCache) {
      return
    }

    let cancelled = false
    if (!sharedPromise) {
      sharedPromise = loadRecipeDataset()
    }

    sharedPromise
      .then((result) => {
        sharedCache = result
        if (!cancelled) {
          setDataset(result)
          setLoading(false)
        }
      })
      .catch(() => {
        const fallback = getFallbackRecipes()
        const result: LoadedRecipeDataset = {
          recipes: fallback,
          ingredients: extractUniqueIngredients(fallback),
          isFallback: true,
        }
        sharedCache = result
        if (!cancelled) {
          setDataset(result)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    sharedPromise = loadRecipeDataset(true)
    const result = await sharedPromise
    sharedCache = result
    setDataset(result)
    setLoading(false)
  }, [])

  const recipes: Recipe[] = dataset?.recipes ?? EMPTY_RECIPES
  const ingredientSuggestions: string[] = dataset?.ingredients ?? EMPTY_INGREDIENTS
  const isFallback = dataset?.isFallback ?? false

  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const r of getFallbackRecipes()) {
      map.set(r.id, r)
    }
    for (const r of recipes) {
      map.set(r.id, r)
    }
    return map
  }, [recipes])

  return {
    recipes,
    recipesById,
    ingredientSuggestions,
    loading,
    isFallback,
    refresh,
  }
}
