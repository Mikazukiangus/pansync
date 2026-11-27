import { filterLocalRecipesByDish } from '../data/mealdb'
import type { FridgeItem, MatchedRecipe, Recipe } from '../types'
import {
  ingredientMatches,
  isStapleIngredient,
  matchRecipes,
  normalize,
} from './matching'
import {
  MEAL_PRIORITIES,
  recipeMatchesPriorities,
  type MealPriorityId,
} from './priorities'

const PRIORITY_LABEL_BY_ID = new Map<MealPriorityId, string>(
  MEAL_PRIORITIES.map((p) => [p.id, p.label]),
)

const MISSING_STEP_CANDIDATES = [1, 2, 3, 5] as const

const NON_VEG_HINT_WORDS = new Set([
  'chicken',
  'beef',
  'pork',
  'bacon',
  'lamb',
  'duck',
  'turkey',
  'sausage',
  'chorizo',
  'ham',
  'salmon',
  'tuna',
  'cod',
  'fish',
  'prawn',
  'shrimp',
  'crab',
  'lobster',
  'anchovy',
])

const CARB_HINT_WORDS = new Set([
  'rice',
  'pasta',
  'spaghetti',
  'penne',
  'noodle',
  'bread',
  'potato',
  'sweet potato',
  'flour',
  'tortilla',
  'wrap',
  'couscous',
  'quinoa',
  'oat',
])

/**
 * Bounded Levenshtein edit distance for short ingredient and dish words.
 */
export function editDistance(a: string, b: string): number {
  const s = a.slice(0, 40).toLowerCase()
  const t = b.slice(0, 40).toLowerCase()
  if (s === t) return 0
  if (s.length === 0) return t.length
  if (t.length === 0) return s.length

  const prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  const curr = new Array<number>(t.length + 1).fill(0)

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      )
    }
    for (let j = 0; j <= t.length; j++) {
      prev[j] = curr[j]
    }
  }
  return prev[t.length]
}

function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function findClosestIngredientSuggestion(
  rawInput: string,
  candidates: readonly string[],
): string | null {
  const norm = normalize(rawInput)
  if (!norm || norm.length < 3) return null

  let bestCandidate: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const maxAllowed = norm.length >= 5 ? 2 : 1

  for (const candidate of candidates) {
    const candNorm = normalize(candidate)
    if (!candNorm || candNorm === norm) continue

    // Strong prefix/substring match (e.g. "parm" -> "Parmesan")
    if (norm.length >= 4 && (candNorm.startsWith(norm) || norm.startsWith(candNorm))) {
      const lengthDiff = Math.abs(candNorm.length - norm.length)
      const score = 0.5 + lengthDiff * 0.05
      if (score < bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
      continue
    }

    if (Math.abs(candNorm.length - norm.length) <= 2) {
      const dist = editDistance(norm, candNorm)
      if (dist <= maxAllowed && dist < bestScore) {
        bestScore = dist
        bestCandidate = candidate
        continue
      }
    }

    // Also compare against individual words in multi-word ingredients (e.g. "chiken" -> "Chicken" from "Chicken Breast")
    if (!norm.includes(' ')) {
      for (const word of candNorm.split(' ')) {
        if (word.length < 3 || Math.abs(word.length - norm.length) > 2) continue
        const wordDist = editDistance(norm, word)
        if (wordDist <= maxAllowed && wordDist + 0.1 < bestScore) {
          bestScore = wordDist + 0.1
          bestCandidate = capitalizeWords(word)
        }
      }
    }
  }

  return bestCandidate
}

export interface PriorityRecoveryOption {
  id: MealPriorityId
  label: string
  unlockedCount: number
}

export interface ExclusionRecoveryOption {
  ingredient: string
  unlockedCount: number
}

export interface SuggestedIngredientAddition {
  name: string
  unlockedCount: number
}

export interface TypoSuggestion {
  original: string
  replacement: string | null
}

export interface RelaxMissingSuggestion {
  nextMaxMissing: number | null
  label: string
  unlockedCount: number
  anyMissingCount: number
}

export interface IngredientNoMatchDiagnosis {
  headline: string
  reasons: string[]
  stapleOnlyInputs: string[]
  unrecognizedInputs: TypoSuggestion[]
  dishModeMatchCount: number
  dishModeQuery: string | null
  relaxMissing: RelaxMissingSuggestion | null
  closestMatch: MatchedRecipe | null
  priorityRemovals: PriorityRecoveryOption[]
  clearAllPrioritiesCount: number
  exclusionRemovals: ExclusionRecoveryOption[]
  suggestedAdditions: SuggestedIngredientAddition[]
}

export interface DiagnoseIngredientParams {
  recipes: readonly Recipe[]
  ingredientSuggestions: readonly string[]
  activeIngredients: readonly string[]
  staples: readonly string[]
  fridgeMode: boolean
  fridgeItems: readonly FridgeItem[]
  maxMissing: number | null
  excludedIngredients: readonly string[]
  selectedPriorities: readonly MealPriorityId[]
}

export function diagnoseIngredientNoMatch(
  params: DiagnoseIngredientParams,
): IngredientNoMatchDiagnosis {
  const {
    recipes,
    ingredientSuggestions,
    activeIngredients,
    staples,
    fridgeMode,
    fridgeItems,
    maxMissing,
    excludedIngredients,
    selectedPriorities,
  } = params

  const reasons: string[] = []
  const effectiveFridgeItems = fridgeMode ? fridgeItems : []

  const filterByPriorities = (list: MatchedRecipe[]): MatchedRecipe[] =>
    selectedPriorities.length > 0
      ? list.filter((m) => recipeMatchesPriorities(m.recipe, selectedPriorities))
      : list

  // 1. Inspect each user-entered ingredient: staple-only vs unrecognized/typo
  const stapleInputs: string[] = []
  const unrecognizedInputs: TypoSuggestion[] = []
  let recognizedNonStapleCount = 0

  for (const item of activeIngredients) {
    if (!normalize(item)) continue
    if (isStapleIngredient(item, staples)) {
      stapleInputs.push(item)
      continue
    }
    const appearsInAnyRecipe = recipes.some((recipe) =>
      recipe.ingredients.some(
        (ing) => !isStapleIngredient(ing.name, staples) && ingredientMatches(item, ing.name),
      ),
    )
    if (appearsInAnyRecipe) {
      recognizedNonStapleCount += 1
    } else {
      unrecognizedInputs.push({
        original: item,
        replacement: findClosestIngredientSuggestion(item, ingredientSuggestions),
      })
    }
  }

  const stapleOnlyInputs =
    recognizedNonStapleCount === 0 && unrecognizedInputs.length === 0 ? stapleInputs : []

  // Check if a single unrecognized input actually matches a dish name (user typed a dish in ingredient mode!)
  let dishModeMatchCount = 0
  let dishModeQuery: string | null = null
  if (activeIngredients.length === 1 && unrecognizedInputs.length === 1) {
    const candidateDish = activeIngredients[0].trim()
    const dishHits = filterLocalRecipesByDish(candidateDish, recipes)
    if (dishHits.length > 0) {
      dishModeMatchCount = dishHits.length
      dishModeQuery = candidateDish
    }
  }

  // 2. Check maxMissing relaxation (keeping current dietary & exclusion filters)
  let relaxMissing: RelaxMissingSuggestion | null = null
  const unconstrainedMissingMatches = filterByPriorities(
    matchRecipes(recipes, activeIngredients, {
      staples,
      fridgeMode,
      fridgeItems: effectiveFridgeItems,
      maxMissing: null,
      excludedIngredients,
    }),
  )

  if (maxMissing !== null && unconstrainedMissingMatches.length > 0) {
    let chosenStep: number | null = null
    let chosenCount = unconstrainedMissingMatches.length

    for (const step of MISSING_STEP_CANDIDATES) {
      if (step <= maxMissing) continue
      const countAtStep = unconstrainedMissingMatches.filter(
        (m) => m.missingCount <= step,
      ).length
      if (countAtStep > 0) {
        chosenStep = step
        chosenCount = countAtStep
        break
      }
    }

    relaxMissing = {
      nextMaxMissing: chosenStep,
      label: chosenStep !== null ? `Allow ≤ ${chosenStep} missing` : 'Allow any missing',
      unlockedCount: chosenCount,
      anyMissingCount: unconstrainedMissingMatches.length,
    }
  }

  // 3. Check dietary preference counterfactuals
  const matchesWithoutPriorities =
    selectedPriorities.length > 0
      ? matchRecipes(recipes, activeIngredients, {
          staples,
          fridgeMode,
          fridgeItems: effectiveFridgeItems,
          maxMissing,
          excludedIngredients,
        })
      : []

  const clearAllPrioritiesCount = matchesWithoutPriorities.length
  const priorityRemovals: PriorityRecoveryOption[] = []

  if (selectedPriorities.length > 0) {
    for (const pid of selectedPriorities) {
      const remaining = selectedPriorities.filter((p) => p !== pid)
      const countWithoutOne =
        remaining.length === 0
          ? matchesWithoutPriorities.length
          : matchesWithoutPriorities.filter((m) =>
              recipeMatchesPriorities(m.recipe, remaining),
            ).length
      if (countWithoutOne > 0) {
        priorityRemovals.push({
          id: pid,
          label: PRIORITY_LABEL_BY_ID.get(pid) ?? pid,
          unlockedCount: countWithoutOne,
        })
      }
    }
    priorityRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)
  }

  // 4. Check excluded-ingredient counterfactuals
  const exclusionRemovals: ExclusionRecoveryOption[] = []
  if (excludedIngredients.length > 0) {
    for (const excluded of excludedIngredients) {
      const remainingExclusions = excludedIngredients.filter((e) => e !== excluded)
      const countWithoutExclusion = filterByPriorities(
        matchRecipes(recipes, activeIngredients, {
          staples,
          fridgeMode,
          fridgeItems: effectiveFridgeItems,
          maxMissing,
          excludedIngredients: remainingExclusions,
        }),
      ).length
      if (countWithoutExclusion > 0) {
        exclusionRemovals.push({
          ingredient: excluded,
          unlockedCount: countWithoutExclusion,
        })
      }
    }
    exclusionRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)
  }

  // 5. Closest match across relaxed filters so users see how close they are
  const allUnfilteredMatches = matchRecipes(recipes, activeIngredients, {
    staples,
    fridgeMode,
    fridgeItems: effectiveFridgeItems,
    maxMissing: null,
    excludedIngredients: [],
  })
  const closestPool =
    unconstrainedMissingMatches.length > 0 ? unconstrainedMissingMatches : allUnfilteredMatches
  const closestMatch =
    closestPool.length > 0
      ? [...closestPool].sort((a, b) => {
          if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
          return b.score - a.score
        })[0]
      : null

  // 6. Compute "+ Add 1 more ingredient" suggestions that immediately unlock recipes
  const suggestedAdditions: SuggestedIngredientAddition[] = []
  const existingNorms = new Set(activeIngredients.map((i) => normalize(i)).filter(Boolean))

  // Eligible recipes respecting current exclusions + dietary preferences
  const eligibleRecipes = recipes.filter((recipe) => {
    if (
      excludedIngredients.length > 0 &&
      recipe.ingredients.some((ing) =>
        excludedIngredients.some((ex) => ingredientMatches(ex, ing.name)),
      )
    ) {
      return false
    }
    return recipeMatchesPriorities(recipe, selectedPriorities)
  })

  if (maxMissing !== null && unconstrainedMissingMatches.length > 0) {
    // Find missing ingredients in near-miss recipes (missing == maxMissing + 1) that immediately satisfy maxMissing!
    const nearMisses = unconstrainedMissingMatches.filter(
      (m) => m.missingCount === maxMissing + 1,
    )
    const candidateMap = new Map<string, { display: string; count: number }>()
    for (const m of nearMisses) {
      for (const miss of m.missingIngredients) {
        const norm = normalize(miss.name)
        if (!norm || existingNorms.has(norm)) continue
        const existing = candidateMap.get(norm)
        if (existing) {
          existing.count += 1
        } else {
          candidateMap.set(norm, { display: miss.name, count: 1 })
        }
      }
    }
    const ranked = Array.from(candidateMap.values()).sort((a, b) => b.count - a.count)
    for (const item of ranked.slice(0, 5)) {
      const exactUnlocked = filterByPriorities(
        matchRecipes(recipes, [...activeIngredients, item.display], {
          staples,
          fridgeMode: false,
          maxMissing,
          excludedIngredients,
        }),
      ).length
      if (exactUnlocked > 0) {
        suggestedAdditions.push({ name: item.display, unlockedCount: exactUnlocked })
      }
    }

    // If closest recipes need 2-3 items to meet strict maxMissing (e.g. Missing 0), offer exact missing bundles
    if (suggestedAdditions.length === 0) {
      const sortedClosest = [...unconstrainedMissingMatches].sort(
        (a, b) => a.missingCount - b.missingCount || b.score - a.score,
      )
      const seenBundles = new Set<string>()
      for (const m of sortedClosest.slice(0, 4)) {
        const neededCount = m.missingCount - maxMissing
        if (neededCount >= 2 && neededCount <= 3) {
          const bundleItems = m.missingIngredients.slice(0, neededCount).map((i) => i.name)
          const bundleLabel = bundleItems.join(', ')
          const bundleKey = bundleItems.map((b) => normalize(b)).sort().join('|')
          if (seenBundles.has(bundleKey)) continue
          seenBundles.add(bundleKey)
          const unlocked = filterByPriorities(
            matchRecipes(recipes, [...activeIngredients, ...bundleItems], {
              staples,
              fridgeMode: false,
              maxMissing,
              excludedIngredients,
            }),
          ).length
          if (unlocked > 0) {
            suggestedAdditions.push({ name: bundleLabel, unlockedCount: unlocked })
          }
        }
      }
    }
  }

  // If still fewer than 4 suggestions (e.g. unrecognized/staple input), suggest high-unlock versatile ingredients
  if (suggestedAdditions.length < 4 && eligibleRecipes.length > 0) {
    const freqMap = new Map<string, { display: string; freq: number }>()
    for (const recipe of eligibleRecipes) {
      const seenInRecipe = new Set<string>()
      for (const ing of recipe.ingredients) {
        if (isStapleIngredient(ing.name, staples)) continue
        const norm = normalize(ing.name)
        if (!norm || existingNorms.has(norm) || seenInRecipe.has(norm)) continue
        seenInRecipe.add(norm)
        const existing = freqMap.get(norm)
        if (existing) {
          existing.freq += 1
        } else {
          freqMap.set(norm, { display: ing.name, freq: 1 })
        }
      }
    }

    const topCandidates = Array.from(freqMap.values())
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 12)

    const alreadySuggested = new Set(suggestedAdditions.map((s) => normalize(s.name)))
    for (const cand of topCandidates) {
      if (suggestedAdditions.length >= 5) break
      if (alreadySuggested.has(normalize(cand.display))) continue
      const unlocked = filterByPriorities(
        matchRecipes(recipes, [...activeIngredients, cand.display], {
          staples,
          fridgeMode: false,
          maxMissing,
          excludedIngredients,
        }),
      ).length
      if (unlocked > 0) {
        suggestedAdditions.push({ name: cand.display, unlockedCount: unlocked })
        alreadySuggested.add(normalize(cand.display))
      }
    }
  }

  // 7. Build plain-language headline & diagnostic bullets (Recognize + Diagnose)
  let headline = 'No recipes matched your current combination'

  if (stapleOnlyInputs.length > 0) {
    headline = 'Pantry staples alone need at least one main ingredient'
    reasons.push(
      `${stapleOnlyInputs.map((s) => `"${s}"`).join(', ')} ${stapleOnlyInputs.length === 1 ? 'is' : 'are'} already assumed in your Pantry Staples, so PanSync waits for a core ingredient (like eggs, rice, garlic, or vegetables) to rank dishes.`,
    )
  }

  if (dishModeQuery && dishModeMatchCount > 0) {
    headline = `"${dishModeQuery}" looks like a dish name rather than an ingredient`
    reasons.push(
      `No recipe lists "${dishModeQuery}" as a raw ingredient, but ${dishModeMatchCount} ${dishModeMatchCount === 1 ? 'recipe matches' : 'recipes match'} it by dish name.`,
    )
  } else if (unrecognizedInputs.length > 0) {
    const names = unrecognizedInputs.map((u) => `"${u.original}"`).join(', ')
    if (recognizedNonStapleCount === 0) {
      headline = `We couldn't find recipes using ${names}`
    }
    const typoHints = unrecognizedInputs
      .filter((u) => u.replacement)
      .map((u) => `"${u.original}" → "${u.replacement}"`)
    reasons.push(
      typoHints.length > 0
        ? `${names} didn't match any ingredient in our ${recipes.length}-recipe catalog (possible spelling match: ${typoHints.join(', ')}).`
        : `${names} isn't listed in any of the ${recipes.length} currently loaded recipes.`,
    )
  }

  // Check direct conflicts between user's ingredients and dietary filters / exclusions
  if (selectedPriorities.includes('vegetarian') && selectedPriorities.includes('crustacean')) {
    headline = 'Conflicting dietary filters selected'
    reasons.push(
      '"Vegetarian" excludes fish and shellfish, so it cannot be combined with "Crustacean".',
    )
  } else if (selectedPriorities.length > 0) {
    const normActiveWords = activeIngredients.flatMap((i) => normalize(i).split(' '))
    if (
      selectedPriorities.includes('vegetarian') &&
      normActiveWords.some((w) => NON_VEG_HINT_WORDS.has(w))
    ) {
      reasons.push(
        'Your ingredient list includes meat or seafood, while "Vegetarian" is active in Dietary preferences.',
      )
    }
    if (
      selectedPriorities.includes('no-carbs') &&
      normActiveWords.some((w) => CARB_HINT_WORDS.has(w))
    ) {
      reasons.push(
        'Your ingredient list includes a carbohydrate staple, while "No carbs" is active in Dietary preferences.',
      )
    }
  }

  const selfExcluded = activeIngredients.filter((ing) =>
    excludedIngredients.some((ex) => ingredientMatches(ex, ing) || ingredientMatches(ing, ex)),
  )
  if (selfExcluded.length > 0) {
    headline = 'An ingredient you searched for is also in your Excluded list'
    reasons.push(
      `${selfExcluded.map((s) => `"${s}"`).join(', ')} is currently blocked under Preferences → Excluded ingredients.`,
    )
  }

  if (relaxMissing) {
    if (headline === 'No recipes matched your current combination') {
      headline =
        maxMissing === 0
          ? 'No recipes can be cooked with zero extra ingredients yet'
          : `No recipes matched within "≤ ${maxMissing} missing"`
    }
    reasons.push(
      `${relaxMissing.anyMissingCount} ${relaxMissing.anyMissingCount === 1 ? 'recipe uses' : 'recipes use'} your ingredients, but ${relaxMissing.anyMissingCount === 1 ? 'it needs' : 'they need'} more than ${maxMissing} extra ${maxMissing === 1 ? 'ingredient' : 'ingredients'}.`,
    )
  }

  if (clearAllPrioritiesCount > 0) {
    const activeLabels = selectedPriorities
      .map((id) => PRIORITY_LABEL_BY_ID.get(id) ?? id)
      .join(', ')
    if (headline === 'No recipes matched your current combination') {
      headline = 'Dietary filters hid your matching recipes'
    }
    reasons.push(
      `${clearAllPrioritiesCount} matching ${clearAllPrioritiesCount === 1 ? 'recipe was' : 'recipes were'} filtered out by your active dietary preferences (${activeLabels}).`,
    )
  }

  if (exclusionRemovals.length > 0 && selfExcluded.length === 0) {
    if (headline === 'No recipes matched your current combination') {
      headline = 'Excluded ingredients hid your matching recipes'
    }
    const exSummary = exclusionRemovals
      .map((e) => `"${e.ingredient}" (${e.unlockedCount})`)
      .join(', ')
    reasons.push(`Recipes using your ingredients were hidden by excluded items: ${exSummary}.`)
  }

  if (reasons.length === 0) {
    reasons.push(
      'None of the loaded recipes combine your current ingredients under the active filters. Adding one versatile ingredient or relaxing a filter will open up options.',
    )
  }

  return {
    headline,
    reasons,
    stapleOnlyInputs,
    unrecognizedInputs,
    dishModeMatchCount,
    dishModeQuery,
    relaxMissing,
    closestMatch,
    priorityRemovals,
    clearAllPrioritiesCount,
    exclusionRemovals,
    suggestedAdditions,
  }
}

export interface PriorityOnlyNoMatchDiagnosis {
  headline: string
  reasons: string[]
  priorityRemovals: PriorityRecoveryOption[]
  exclusionRemovals: ExclusionRecoveryOption[]
  totalWithoutPriorities: number
}

export function diagnosePriorityOnlyNoMatch(
  recipes: readonly Recipe[],
  selectedPriorities: readonly MealPriorityId[],
  excludedIngredients: readonly string[],
): PriorityOnlyNoMatchDiagnosis {
  const reasons: string[] = []
  let headline = 'No recipes match all selected dietary filters together'

  if (selectedPriorities.includes('vegetarian') && selectedPriorities.includes('crustacean')) {
    headline = '"Vegetarian" and "Crustacean" can’t match at the same time'
    reasons.push(
      'Vegetarian recipes exclude all fish and shellfish, while Crustacean requires prawns, crab, or lobster. Remove one of the two filters to see matches.',
    )
  } else {
    const labels = selectedPriorities
      .map((id) => PRIORITY_LABEL_BY_ID.get(id) ?? id)
      .join(' + ')
    reasons.push(
      `Zero recipes in the current ${recipes.length}-recipe catalog satisfy ${labels} simultaneously.`,
    )
  }

  const nonExcludedRecipes =
    excludedIngredients.length > 0
      ? recipes.filter(
          (recipe) =>
            !recipe.ingredients.some((ing) =>
              excludedIngredients.some((ex) => ingredientMatches(ex, ing.name)),
            ),
        )
      : recipes

  const priorityRemovals: PriorityRecoveryOption[] = []
  for (const pid of selectedPriorities) {
    const remaining = selectedPriorities.filter((p) => p !== pid)
    const count =
      remaining.length === 0
        ? nonExcludedRecipes.length
        : nonExcludedRecipes.filter((r) => recipeMatchesPriorities(r, remaining)).length
    if (count > 0) {
      priorityRemovals.push({
        id: pid,
        label: PRIORITY_LABEL_BY_ID.get(pid) ?? pid,
        unlockedCount: count,
      })
    }
  }
  priorityRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)

  const exclusionRemovals: ExclusionRecoveryOption[] = []
  if (excludedIngredients.length > 0) {
    for (const excluded of excludedIngredients) {
      const remainingEx = excludedIngredients.filter((e) => e !== excluded)
      const count = recipes.filter((recipe) => {
        if (
          remainingEx.length > 0 &&
          recipe.ingredients.some((ing) =>
            remainingEx.some((ex) => ingredientMatches(ex, ing.name)),
          )
        ) {
          return false
        }
        return recipeMatchesPriorities(recipe, selectedPriorities)
      }).length
      if (count > 0) {
        exclusionRemovals.push({ ingredient: excluded, unlockedCount: count })
      }
    }
    exclusionRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)
    if (exclusionRemovals.length > 0) {
      reasons.push(
        `Your excluded ingredients (${exclusionRemovals.map((e) => `"${e.ingredient}"`).join(', ')}) also hid matching recipes.`,
      )
    }
  }

  return {
    headline,
    reasons,
    priorityRemovals,
    exclusionRemovals,
    totalWithoutPriorities: nonExcludedRecipes.length,
  }
}

export interface DishNoMatchDiagnosis {
  headline: string
  reasons: string[]
  priorityRemovals: PriorityRecoveryOption[]
  clearAllPrioritiesCount: number
  exclusionRemovals: ExclusionRecoveryOption[]
  ingredientModeMatchCount: number
  similarDishNames: string[]
}

export function diagnoseDishNoMatch(params: {
  query: string
  rawDishMatches: readonly Recipe[]
  dishMatchesAfterExclusions: readonly Recipe[]
  recipes: readonly Recipe[]
  staples: readonly string[]
  selectedPriorities: readonly MealPriorityId[]
  excludedIngredients: readonly string[]
}): DishNoMatchDiagnosis {
  const {
    query,
    rawDishMatches,
    dishMatchesAfterExclusions,
    recipes,
    staples,
    selectedPriorities,
    excludedIngredients,
  } = params

  const trimmed = query.trim()
  const reasons: string[] = []
  let headline = `No recipes found for "${trimmed}"`

  const priorityRemovals: PriorityRecoveryOption[] = []
  if (selectedPriorities.length > 0 && dishMatchesAfterExclusions.length > 0) {
    headline = `Dietary filters hid ${dishMatchesAfterExclusions.length} matching ${dishMatchesAfterExclusions.length === 1 ? 'dish' : 'dishes'}`
    const labels = selectedPriorities
      .map((id) => PRIORITY_LABEL_BY_ID.get(id) ?? id)
      .join(', ')
    reasons.push(
      `We found ${dishMatchesAfterExclusions.length} ${dishMatchesAfterExclusions.length === 1 ? 'recipe' : 'recipes'} for "${trimmed}", but ${dishMatchesAfterExclusions.length === 1 ? 'it doesn’t' : 'none of them'} match ${labels}.`,
    )
    for (const pid of selectedPriorities) {
      const remaining = selectedPriorities.filter((p) => p !== pid)
      const count =
        remaining.length === 0
          ? dishMatchesAfterExclusions.length
          : dishMatchesAfterExclusions.filter((r) =>
              recipeMatchesPriorities(r, remaining),
            ).length
      if (count > 0) {
        priorityRemovals.push({
          id: pid,
          label: PRIORITY_LABEL_BY_ID.get(pid) ?? pid,
          unlockedCount: count,
        })
      }
    }
    priorityRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)
  }

  const exclusionRemovals: ExclusionRecoveryOption[] = []
  if (excludedIngredients.length > 0 && rawDishMatches.length > 0) {
    if (dishMatchesAfterExclusions.length === 0) {
      headline = `Excluded ingredients hid ${rawDishMatches.length} matching ${rawDishMatches.length === 1 ? 'dish' : 'dishes'}`
    }
    for (const excluded of excludedIngredients) {
      const remainingEx = excludedIngredients.filter((e) => e !== excluded)
      const afterEx = rawDishMatches.filter(
        (recipe) =>
          !recipe.ingredients.some((ing) =>
            remainingEx.some((ex) => ingredientMatches(ex, ing.name)),
          ),
      )
      const count =
        selectedPriorities.length > 0
          ? afterEx.filter((r) => recipeMatchesPriorities(r, selectedPriorities)).length
          : afterEx.length
      if (count > 0) {
        exclusionRemovals.push({ ingredient: excluded, unlockedCount: count })
      }
    }
    exclusionRemovals.sort((a, b) => b.unlockedCount - a.unlockedCount)
    reasons.push(
      `${rawDishMatches.length} matching ${rawDishMatches.length === 1 ? 'dish contains' : 'dishes contain'} an excluded ingredient (${excludedIngredients.join(', ')}).`,
    )
  }

  // Check if query actually matches recipes as an ingredient list (e.g. "rice, egg" or "broccoli")
  const candidateIngredients = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ingredientModeMatches = matchRecipes(recipes, candidateIngredients, {
    staples,
    excludedIngredients,
  }).filter((m) => recipeMatchesPriorities(m.recipe, selectedPriorities))

  if (rawDishMatches.length === 0 && ingredientModeMatches.length > 0) {
    reasons.push(
      `"${trimmed}" matches ${ingredientModeMatches.length} ${ingredientModeMatches.length === 1 ? 'recipe' : 'recipes'} as an ingredient — try switching to "By ingredients".`,
    )
  }

  // Fuzzy dish suggestions by word similarity / partial token match
  const queryTokens = normalize(trimmed)
    .split(' ')
    .filter((t) => t.length >= 3)
  const scoredSimilar: Array<{ name: string; score: number }> = []

  if (queryTokens.length > 0) {
    for (const recipe of recipes) {
      if (!recipeMatchesPriorities(recipe, selectedPriorities)) continue
      const titleTokens = normalize(recipe.name)
        .split(' ')
        .filter((t) => t.length >= 3)
      let score = 0
      for (const qt of queryTokens) {
        for (const tt of titleTokens) {
          if (tt === qt) {
            score += 3
          } else if (tt.includes(qt) || qt.includes(tt)) {
            score += 2
          } else if (Math.abs(tt.length - qt.length) <= 2 && editDistance(qt, tt) <= 2) {
            score += 1.5
          }
        }
      }
      if (score > 0) {
        scoredSimilar.push({ name: recipe.name, score })
      }
    }
  }

  scoredSimilar.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const similarDishNames = scoredSimilar.slice(0, 4).map((s) => s.name)

  if (reasons.length === 0) {
    reasons.push(
      similarDishNames.length > 0
        ? `No exact title matched "${trimmed}", but we found close dish matches you can jump to below.`
        : `No dish titles matched "${trimmed}". Try a shorter keyword (e.g. "Pasta", "Curry", "Rice") or search by the ingredients in that dish.`,
    )
  }

  return {
    headline,
    reasons,
    priorityRemovals,
    clearAllPrioritiesCount: dishMatchesAfterExclusions.length,
    exclusionRemovals,
    ingredientModeMatchCount: ingredientModeMatches.length,
    similarDishNames,
  }
}
