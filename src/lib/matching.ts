import {
  CORE_STAPLE_VARIANTS,
  DEFAULT_STAPLES,
  FALSE_COMPOUND_MATCHES,
  INGREDIENT_ALIASES,
  WORD_SYNONYMS,
} from '../data/aliases'
import type {
  FridgeItem,
  IngredientMatchDetail,
  MatchedRecipe,
  Recipe,
  RecipeIngredient,
} from '../types'
import { getExpiryStatus, getExpiryUrgencyBonus } from './dates'

const IRREGULAR_SINGULARS: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  tomatoes: 'tomato',
  potatoes: 'potato',
  chillies: 'chilli',
  chilies: 'chili',
}

const INVARIANT_S_WORDS = new Set([
  'asparagus',
  'couscous',
  'hummus',
  'molasses',
  'lemongrass',
  'watercress',
  'swiss',
  'citrus',
  'glass',
  'bass',
  'haggis',
])

function singularizeWord(word: string): string {
  if (word.length <= 2 || INVARIANT_S_WORDS.has(word)) {
    return word
  }
  if (IRREGULAR_SINGULARS[word]) {
    return IRREGULAR_SINGULARS[word]
  }
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`
  }
  if (word.endsWith('oes') && word.length > 4) {
    return word.slice(0, -2)
  }
  if (
    word.length > 4 &&
    (word.endsWith('ches') ||
      word.endsWith('shes') ||
      word.endsWith('xes') ||
      word.endsWith('zes'))
  ) {
    return word.slice(0, -2)
  }
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1)
  }
  return word
}

/**
 * Normalize an ingredient name:
 * 1. lowercase & trim
 * 2. strip parenthetical notes & punctuation, turn hyphens/slashes into spaces
 * 3. strip simple English plurals word-by-word
 * 4. apply canonical UK/US & leftover alias maps
 */
export function normalize(raw: string): string {
  if (!raw) return ''
  let cleaned = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/['’.,;:!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  if (INGREDIENT_ALIASES[cleaned]) {
    cleaned = INGREDIENT_ALIASES[cleaned]
  }

  const singularWords = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => singularizeWord(w))

  let normalized = singularWords.join(' ')

  if (INGREDIENT_ALIASES[normalized]) {
    normalized = INGREDIENT_ALIASES[normalized]
  }

  const wordSwapped = normalized
    .split(' ')
    .map((w) => WORD_SYNONYMS[w] ?? w)
    .join(' ')

  return INGREDIENT_ALIASES[wordSwapped] ?? wordSwapped
}

/**
 * Returns true if `userIngredient` matches `recipeIngredient`:
 * - Exact match after normalizing, OR
 * - `userIngredient` appears as a contiguous whole-word sequence inside `recipeIngredient`
 *   (e.g. "chicken" matches "chicken breast", "onion" matches "spring onion",
 *    while "pea" never matches "peanut" and "egg" never matches "eggplant").
 */
export function ingredientMatches(userIngredient: string, recipeIngredient: string): boolean {
  const u = normalize(userIngredient)
  const r = normalize(recipeIngredient)
  if (!u || !r) return false
  if (u === r) return true

  const blockedCompounds = FALSE_COMPOUND_MATCHES[u]
  if (blockedCompounds?.some((blocked) => r.includes(blocked))) {
    return false
  }

  const uWords = u.split(' ')
  const rWords = r.split(' ')
  if (uWords.length > rWords.length) return false

  for (let i = 0; i <= rWords.length - uWords.length; i++) {
    let allMatch = true
    for (let j = 0; j < uWords.length; j++) {
      if (rWords[i + j] !== uWords[j]) {
        allMatch = false
        break
      }
    }
    if (allMatch) return true
  }

  return false
}

/**
 * Determines whether a recipe ingredient counts as a pantry staple.
 */
export function isStapleIngredient(
  recipeIngredient: string,
  staples: readonly string[] = DEFAULT_STAPLES,
): boolean {
  const normRecipe = normalize(recipeIngredient)
  if (!normRecipe) return false

  const normalizedStaples = new Set(staples.map((s) => normalize(s)).filter(Boolean))

  // Handle combined "salt and pepper" / "salt & pepper"
  if (
    (normRecipe === 'salt and pepper' || normRecipe === 'salt & pepper') &&
    normalizedStaples.has('salt') &&
    normalizedStaples.has('pepper')
  ) {
    return true
  }

  for (const staple of normalizedStaples) {
    if (normRecipe === staple) return true

    const coreVariants = CORE_STAPLE_VARIANTS[staple]
    if (coreVariants) {
      if (coreVariants.some((variant) => normalize(variant) === normRecipe)) {
        return true
      }
      continue
    }

    // Custom user-added staples match whole-word just like user ingredients
    if (ingredientMatches(staple, normRecipe)) {
      return true
    }
  }

  return false
}

export interface MatchOptions {
  staples?: readonly string[]
  fridgeMode?: boolean
  fridgeItems?: readonly FridgeItem[]
  maxMissing?: number | null
  excludedIngredients?: readonly string[]
  today?: Date
}

/**
 * Evaluate a single recipe against the user's available ingredients & staples.
 */
export function evaluateRecipe(
  recipe: Recipe,
  userIngredients: readonly string[],
  options: MatchOptions = {},
): MatchedRecipe {
  const {
    staples = DEFAULT_STAPLES,
    fridgeMode = false,
    fridgeItems = [],
    today = new Date(),
  } = options

  const cleanUserItems = Array.from(
    new Map(
      userIngredients
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [normalize(item), item]),
    ).values(),
  )

  const haveIngredients: RecipeIngredient[] = []
  const missingIngredients: RecipeIngredient[] = []
  const stapleIngredients: RecipeIngredient[] = []
  const details: IngredientMatchDetail[] = []
  const usedUserItemsSet = new Set<string>()
  const usedFridgeIds = new Set<string>()

  let expiryBonusTotal = 0
  let expiringUsedCount = 0

  for (const ing of recipe.ingredients) {
    if (isStapleIngredient(ing.name, staples)) {
      stapleIngredients.push(ing)
      details.push({ ingredient: ing, status: 'staple' })
      continue
    }

    const matchingUserItems = cleanUserItems.filter((u) => ingredientMatches(u, ing.name))

    if (matchingUserItems.length > 0) {
      haveIngredients.push(ing)

      // Pick best matching user item (and in fridge mode, most urgent matching fridge item)
      let chosenUserItem = matchingUserItems[0]
      let bestExpiryStatus = undefined

      if (fridgeItems.length > 0) {
        const matchingFridge = fridgeItems.filter((fi) =>
          ingredientMatches(fi.name, ing.name),
        )
        if (matchingFridge.length > 0) {
          matchingFridge.sort(
            (a, b) =>
              getExpiryUrgencyBonus(b.useBy, today) -
              getExpiryUrgencyBonus(a.useBy, today),
          )
          const topFridge = matchingFridge[0]
          chosenUserItem = topFridge.name
          bestExpiryStatus = getExpiryStatus(topFridge.useBy, today)

          if (!usedFridgeIds.has(topFridge.id)) {
            usedFridgeIds.add(topFridge.id)
            if (fridgeMode) {
              expiryBonusTotal += getExpiryUrgencyBonus(topFridge.useBy, today)
            }
            if (
              bestExpiryStatus === 'expired' ||
              bestExpiryStatus === 'today' ||
              bestExpiryStatus === 'soon'
            ) {
              expiringUsedCount += 1
            }
          }
        }
      }

      usedUserItemsSet.add(chosenUserItem)
      details.push({
        ingredient: ing,
        status: 'have',
        matchedUserItem: chosenUserItem,
        matchedExpiry: bestExpiryStatus,
      })
    } else {
      missingIngredients.push(ing)
      details.push({ ingredient: ing, status: 'missing' })
    }
  }

  const nonStapleTotal = haveIngredients.length + missingIngredients.length
  const shareScore = nonStapleTotal > 0 ? haveIngredients.length / nonStapleTotal : 1
  const usedUserItems = Array.from(usedUserItemsSet)
  const usedBonus = usedUserItems.length * 0.15
  const score = Number((shareScore + usedBonus + expiryBonusTotal).toFixed(4))

  return {
    recipe,
    score,
    usedCount: usedUserItems.length,
    usedUserItems,
    missingCount: missingIngredients.length,
    missingIngredients,
    haveIngredients,
    stapleIngredients,
    details,
    expiringUsedCount,
  }
}

/**
 * Filter and rank all recipes against the user's ingredients.
 */
export function matchRecipes(
  recipes: readonly Recipe[],
  userIngredients: readonly string[],
  options: MatchOptions = {},
): MatchedRecipe[] {
  const { maxMissing = null, excludedIngredients = [] } = options
  const hasQuery = userIngredients.some((i) => normalize(i).length > 0)

  const filteredRecipes = excludedIngredients.length
    ? recipes.filter(
        (recipe) =>
          !recipe.ingredients.some((ing) =>
            excludedIngredients.some((ex) => ingredientMatches(ex, ing.name)),
          ),
      )
    : recipes

  if (!hasQuery) {
    return []
  }

  const evaluated = filteredRecipes
    .map((recipe) => evaluateRecipe(recipe, userIngredients, options))
    .filter((m) => m.usedCount > 0)
    .filter((m) => (maxMissing === null ? true : m.missingCount <= maxMissing))

  evaluated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
    if (b.usedCount !== a.usedCount) return b.usedCount - a.usedCount
    return a.recipe.name.localeCompare(b.recipe.name)
  })

  return evaluated
}
