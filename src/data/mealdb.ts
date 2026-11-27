import { get, set } from 'idb-keyval'
import { normalize } from '../lib/matching'
import type { Recipe, RecipeIngredient } from '../types'
import fallbackRecipesRaw from './fallback-recipes.json'

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'
const RECIPES_CACHE_KEY = 'pansync-mealdb-recipes-v1'
const INGREDIENTS_CACHE_KEY = 'pansync-mealdb-ingredients-v1'
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CachedRecipesPayload {
  timestamp: number
  recipes: Recipe[]
}

interface CachedIngredientsPayload {
  timestamp: number
  ingredients: string[]
}

export interface MealDBRawMeal {
  idMeal: string
  strMeal: string
  strCategory?: string | null
  strArea?: string | null
  strCountry?: string | null
  strInstructions?: string | null
  strMealThumb?: string | null
  strYoutube?: string | null
  [key: string]: unknown
}

export function parseInstructions(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/\r?\n+/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:step\s*\d+[:.)\-\s]*|\d+[.)]\s*)/i, '')
        .trim(),
    )
    .filter((line) => line.length > 2)
}

/**
 * Flatten a raw TheMealDB meal object into our normalized Recipe shape.
 * Handles newer meals where strArea is null and strCountry carries the origin.
 */
export function mapMealToRecipe(meal: MealDBRawMeal): Recipe {
  const ingredients: RecipeIngredient[] = []
  const seen = new Set<string>()

  for (let i = 1; i <= 20; i++) {
    const rawName = meal[`strIngredient${i}`]
    const rawMeasure = meal[`strMeasure${i}`]
    if (typeof rawName !== 'string') continue
    const name = rawName.trim()
    if (!name) continue
    const measure = typeof rawMeasure === 'string' ? rawMeasure.trim() : ''
    const dedupeKey = `${normalize(name)}::${measure.toLowerCase()}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    ingredients.push({ name, measure })
  }

  return {
    id: String(meal.idMeal),
    name: meal.strMeal.trim(),
    image:
      typeof meal.strMealThumb === 'string' && meal.strMealThumb.trim()
        ? meal.strMealThumb.trim()
        : null,
    category:
      typeof meal.strCategory === 'string' && meal.strCategory.trim()
        ? meal.strCategory.trim()
        : 'Main',
    area:
      (typeof meal.strArea === 'string' && meal.strArea.trim()) ||
      (typeof meal.strCountry === 'string' && meal.strCountry.trim()) ||
      'International',
    instructions: parseInstructions(meal.strInstructions),
    youtube:
      typeof meal.strYoutube === 'string' && meal.strYoutube.trim()
        ? meal.strYoutube.trim()
        : null,
    ingredients,
  }
}

export function getFallbackRecipes(): Recipe[] {
  return fallbackRecipesRaw as Recipe[]
}

export function extractUniqueIngredients(recipes: readonly Recipe[]): string[] {
  const byNorm = new Map<string, string>()
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const norm = normalize(ing.name)
      if (norm && !byNorm.has(norm)) {
        byNorm.set(norm, ing.name)
      }
    }
  }
  return Array.from(byNorm.values()).sort((a, b) => a.localeCompare(b))
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch all recipes across a..z in parallel from TheMealDB.
 */
export async function fetchAllMealDBRecipes(): Promise<Recipe[]> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const responses = await Promise.all(
    letters.map((letter) =>
      fetchJsonWithTimeout<{ meals: MealDBRawMeal[] | null }>(
        `${API_BASE}/search.php?f=${letter}`,
      ),
    ),
  )

  const byId = new Map<string, Recipe>()
  for (const payload of responses) {
    if (!Array.isArray(payload.meals)) continue
    for (const rawMeal of payload.meals) {
      if (rawMeal?.idMeal && rawMeal?.strMeal) {
        byId.set(String(rawMeal.idMeal), mapMealToRecipe(rawMeal))
      }
    }
  }

  const recipes = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  if (recipes.length === 0) {
    throw new Error('TheMealDB returned zero recipes')
  }
  return recipes
}

export async function fetchMealDBIngredientsList(): Promise<string[]> {
  const data = await fetchJsonWithTimeout<{
    meals: Array<{ strIngredient?: string | null }> | null
  }>(`${API_BASE}/list.php?i=list`)

  if (!Array.isArray(data.meals) || data.meals.length === 0) {
    throw new Error('Empty ingredient list from TheMealDB')
  }

  const unique = new Map<string, string>()
  for (const entry of data.meals) {
    const name = entry.strIngredient?.trim()
    if (!name) continue
    const norm = normalize(name)
    if (norm && !unique.has(norm)) {
      unique.set(norm, name)
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b))
}

export interface LoadedRecipeDataset {
  recipes: Recipe[]
  ingredients: string[]
  isFallback: boolean
}

export interface DishSearchResult {
  recipes: Recipe[]
  fromNetwork: boolean
}

function scoreDishMatch(recipe: Recipe, lowerQuery: string, tokens: string[]): number {
  const lowerName = recipe.name.toLowerCase()
  const lowerCategory = recipe.category.toLowerCase()
  const lowerArea = recipe.area.toLowerCase()

  if (lowerName === lowerQuery) return 100
  if (lowerName.startsWith(lowerQuery)) return 85
  if (lowerName.includes(lowerQuery)) return 70

  const allTokensInName = tokens.every((t) => lowerName.includes(t))
  if (allTokensInName) return 55

  const combined = `${lowerName} ${lowerCategory} ${lowerArea}`
  if (tokens.every((t) => combined.includes(t))) return 35

  return 0
}

/**
 * Filter a local recipe list by dish name (also checking cuisine area & category
 * for multi-word queries like "Japanese curry" or "Italian pasta").
 */
export function filterLocalRecipesByDish(
  query: string,
  localPool: readonly Recipe[],
): Recipe[] {
  const lowerQuery = query.trim().toLowerCase()
  if (!lowerQuery) return []
  const tokens = lowerQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const scored: Array<{ recipe: Recipe; score: number }> = []
  for (const recipe of localPool) {
    const score = scoreDishMatch(recipe, lowerQuery, tokens)
    if (score > 0) {
      scored.push({ recipe, score })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.recipe.name.localeCompare(b.recipe.name)
  })
  return scored.map((entry) => entry.recipe)
}

/**
 * Search recipes by dish name via TheMealDB (`search.php?s=...`), merging any
 * additional local matches and gracefully falling back to localPool when offline.
 */
export async function searchMealsByName(
  query: string,
  localPool: readonly Recipe[] = [],
): Promise<DishSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { recipes: [], fromNetwork: false }
  }

  const localMatches = filterLocalRecipesByDish(trimmed, localPool)

  if (isSimulatedOffline()) {
    return { recipes: localMatches, fromNetwork: false }
  }

  try {
    const payload = await fetchJsonWithTimeout<{ meals: MealDBRawMeal[] | null }>(
      `${API_BASE}/search.php?s=${encodeURIComponent(trimmed)}`,
      8000,
    )

    const byId = new Map<string, Recipe>()
    if (Array.isArray(payload.meals)) {
      for (const rawMeal of payload.meals) {
        if (rawMeal?.idMeal && rawMeal?.strMeal) {
          const mapped = mapMealToRecipe(rawMeal)
          byId.set(mapped.id, mapped)
        }
      }
    }

    // Merge local matches (e.g. built-in fallback or multi-word matches) without duplicates
    for (const localRecipe of localMatches) {
      if (!byId.has(localRecipe.id)) {
        byId.set(localRecipe.id, localRecipe)
      }
    }

    const lowerQuery = trimmed.toLowerCase()
    const tokens = lowerQuery.split(/\s+/).filter(Boolean)
    const merged = Array.from(byId.values()).sort((a, b) => {
      const scoreDiff =
        scoreDishMatch(b, lowerQuery, tokens) - scoreDishMatch(a, lowerQuery, tokens)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name)
    })

    return { recipes: merged, fromNetwork: true }
  } catch {
    return { recipes: localMatches, fromNetwork: false }
  }
}

/**
 * Fetch a single recipe by its numeric TheMealDB ID (`lookup.php?i=...`).
 */
export async function fetchMealById(id: string): Promise<Recipe | null> {
  if (!/^\d+$/.test(id) || isSimulatedOffline()) return null
  try {
    const payload = await fetchJsonWithTimeout<{ meals: MealDBRawMeal[] | null }>(
      `${API_BASE}/lookup.php?i=${encodeURIComponent(id)}`,
      8000,
    )
    const rawMeal = Array.isArray(payload.meals) ? payload.meals[0] : null
    if (!rawMeal?.idMeal || !rawMeal?.strMeal) return null
    return mapMealToRecipe(rawMeal)
  } catch {
    return null
  }
}

function isSimulatedOffline(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('offline') === '1'
  } catch {
    return false
  }
}

/**
 * Load recipes & autocomplete ingredients with 7-day IndexedDB caching
 * and automatic fallback to `fallback-recipes.json` when offline/unreachable.
 */
export async function loadRecipeDataset(forceRefresh = false): Promise<LoadedRecipeDataset> {
  if (isSimulatedOffline()) {
    const fallback = getFallbackRecipes()
    return {
      recipes: fallback,
      ingredients: extractUniqueIngredients(fallback),
      isFallback: true,
    }
  }

  const now = Date.now()
  let cachedRecipes: CachedRecipesPayload | undefined
  let cachedIngredients: CachedIngredientsPayload | undefined

  if (!forceRefresh) {
    try {
      ;[cachedRecipes, cachedIngredients] = await Promise.all([
        get<CachedRecipesPayload>(RECIPES_CACHE_KEY),
        get<CachedIngredientsPayload>(INGREDIENTS_CACHE_KEY),
      ])
    } catch {
      // IndexedDB unavailable (e.g. strict private mode); continue with network/fallback
    }

    if (
      cachedRecipes &&
      cachedRecipes.recipes.length > 0 &&
      now - cachedRecipes.timestamp < CACHE_TTL_MS
    ) {
      const ingredients =
        cachedIngredients &&
        cachedIngredients.ingredients.length > 0 &&
        now - cachedIngredients.timestamp < CACHE_TTL_MS
          ? cachedIngredients.ingredients
          : extractUniqueIngredients(cachedRecipes.recipes)

      return {
        recipes: cachedRecipes.recipes,
        ingredients,
        isFallback: false,
      }
    }
  }

  try {
    const [recipes, ingredientsResult] = await Promise.all([
      fetchAllMealDBRecipes(),
      fetchMealDBIngredientsList().catch(() => null),
    ])

    const ingredients = ingredientsResult ?? extractUniqueIngredients(recipes)

    await Promise.all([
      set(RECIPES_CACHE_KEY, { timestamp: now, recipes } satisfies CachedRecipesPayload),
      set(INGREDIENTS_CACHE_KEY, {
        timestamp: now,
        ingredients,
      } satisfies CachedIngredientsPayload),
    ]).catch(() => {
      // Ignore storage quota errors
    })

    return {
      recipes,
      ingredients,
      isFallback: false,
    }
  } catch {
    // If an expired cache exists, prefer showing the cached 300 recipes over failing;
    // if no cache exists at all, serve the 20 built-in leftover-friendly recipes!
    if (cachedRecipes && cachedRecipes.recipes.length > 0) {
      return {
        recipes: cachedRecipes.recipes,
        ingredients:
          cachedIngredients?.ingredients ?? extractUniqueIngredients(cachedRecipes.recipes),
        isFallback: false,
      }
    }

    const fallback = getFallbackRecipes()
    return {
      recipes: fallback,
      ingredients: extractUniqueIngredients(fallback),
      isFallback: true,
    }
  }
}
