import type { OpenFoodFactsProduct } from '../data/openfoodfacts'
import type { Recipe } from '../types'
import { ingredientMatches, normalize } from './matching'

export type NutriScoreGrade = 'a' | 'b' | 'c' | 'd' | 'e'

export type AllergenId =
  | 'eggs'
  | 'gluten'
  | 'milk'
  | 'peanuts'
  | 'nuts'
  | 'soybeans'
  | 'crustaceans'
  | 'fish'
  | 'sesame'
  | 'mustard'
  | 'celery'
  | 'molluscs'

export interface AllergenMeta {
  id: AllergenId
  label: string
  emoji: string
}

export const ALLERGEN_META: Record<AllergenId, AllergenMeta> = {
  eggs: { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  gluten: { id: 'gluten', label: 'Gluten', emoji: '🌾' },
  milk: { id: 'milk', label: 'Dairy', emoji: '🥛' },
  peanuts: { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  nuts: { id: 'nuts', label: 'Tree nuts', emoji: '🌰' },
  soybeans: { id: 'soybeans', label: 'Soy', emoji: '🫘' },
  crustaceans: { id: 'crustaceans', label: 'Crustaceans', emoji: '🦐' },
  fish: { id: 'fish', label: 'Fish', emoji: '🐟' },
  sesame: { id: 'sesame', label: 'Sesame', emoji: '🌻' },
  mustard: { id: 'mustard', label: 'Mustard', emoji: '🟡' },
  celery: { id: 'celery', label: 'Celery', emoji: '🥬' },
  molluscs: { id: 'molluscs', label: 'Molluscs', emoji: '🦪' },
}

export interface IngredientNutritionProfile {
  /** Normalized match keyword */
  key: string
  /** Optional real OpenFoodFacts barcode for live batched hydration */
  barcode?: string
  kcalPer100g: number
  proteinPer100g: number
  /** Typical grams when measure has no weight unit (e.g. "1" or blank) */
  defaultGrams: number
  /** Nutri-Score weight: 1 (A) to 5 (E) */
  gradeScore: number
  allergens: readonly AllergenId[]
}

/**
 * OpenFoodFacts-aligned ingredient reference catalog.
 * Representative packaged items carry real OpenFoodFacts barcodes so
 * `/api/openfoodfacts?codes=...` can hydrate live nutriments, Nutri-Score,
 * and allergens in a single cached batch call.
 */
export const INGREDIENT_OFF_CATALOG: readonly IngredientNutritionProfile[] = [
  // Proteins & seafood
  { key: 'egg', kcalPer100g: 143, proteinPer100g: 12.6, defaultGrams: 55, gradeScore: 1.8, allergens: ['eggs'] },
  { key: 'chicken', kcalPer100g: 165, proteinPer100g: 31, defaultGrams: 220, gradeScore: 1.3, allergens: [] },
  { key: 'turkey', kcalPer100g: 150, proteinPer100g: 29, defaultGrams: 200, gradeScore: 1.3, allergens: [] },
  { key: 'ground beef', kcalPer100g: 250, proteinPer100g: 26, defaultGrams: 220, gradeScore: 3.1, allergens: [] },
  { key: 'beef', kcalPer100g: 215, proteinPer100g: 26, defaultGrams: 220, gradeScore: 2.7, allergens: [] },
  { key: 'pork', kcalPer100g: 242, proteinPer100g: 25, defaultGrams: 200, gradeScore: 3.0, allergens: [] },
  { key: 'bacon', kcalPer100g: 417, proteinPer100g: 15, defaultGrams: 60, gradeScore: 4.5, allergens: [] },
  { key: 'ham', kcalPer100g: 145, proteinPer100g: 21, defaultGrams: 80, gradeScore: 3.3, allergens: [] },
  { key: 'sausage', kcalPer100g: 301, proteinPer100g: 14, defaultGrams: 120, gradeScore: 4.3, allergens: [] },
  { key: 'lamb', kcalPer100g: 258, proteinPer100g: 25, defaultGrams: 220, gradeScore: 3.1, allergens: [] },
  { key: 'salmon', kcalPer100g: 208, proteinPer100g: 20, defaultGrams: 180, gradeScore: 1.6, allergens: ['fish'] },
  { key: 'tuna', barcode: '3263859883713', kcalPer100g: 132, proteinPer100g: 28, defaultGrams: 140, gradeScore: 1.5, allergens: ['fish'] },
  { key: 'cod', kcalPer100g: 82, proteinPer100g: 18, defaultGrams: 180, gradeScore: 1.2, allergens: ['fish'] },
  { key: 'fish', kcalPer100g: 130, proteinPer100g: 22, defaultGrams: 180, gradeScore: 1.4, allergens: ['fish'] },
  { key: 'shrimp', kcalPer100g: 99, proteinPer100g: 24, defaultGrams: 160, gradeScore: 1.6, allergens: ['crustaceans'] },
  { key: 'crab', kcalPer100g: 97, proteinPer100g: 19, defaultGrams: 140, gradeScore: 1.6, allergens: ['crustaceans'] },
  { key: 'lobster', kcalPer100g: 89, proteinPer100g: 19, defaultGrams: 160, gradeScore: 1.6, allergens: ['crustaceans'] },
  { key: 'mussel', kcalPer100g: 86, proteinPer100g: 12, defaultGrams: 180, gradeScore: 1.6, allergens: ['molluscs'] },
  { key: 'squid', kcalPer100g: 92, proteinPer100g: 16, defaultGrams: 150, gradeScore: 1.6, allergens: ['molluscs'] },
  { key: 'tofu', kcalPer100g: 94, proteinPer100g: 10, defaultGrams: 180, gradeScore: 1.2, allergens: ['soybeans'] },

  // Grains, breads, pastas & noodles
  { key: 'rice', barcode: '3038359007651', kcalPer100g: 130, proteinPer100g: 2.7, defaultGrams: 180, gradeScore: 1.6, allergens: [] },
  { key: 'egg noodle', kcalPer100g: 158, proteinPer100g: 5.5, defaultGrams: 180, gradeScore: 2.2, allergens: ['gluten', 'eggs'] },
  { key: 'noodle', kcalPer100g: 145, proteinPer100g: 5, defaultGrams: 180, gradeScore: 2.2, allergens: ['gluten'] },
  { key: 'pasta', barcode: '8076800195057', kcalPer100g: 350, proteinPer100g: 12.5, defaultGrams: 160, gradeScore: 1.5, allergens: ['gluten'] },
  { key: 'spaghetti', barcode: '8076800195057', kcalPer100g: 350, proteinPer100g: 12.5, defaultGrams: 160, gradeScore: 1.5, allergens: ['gluten'] },
  { key: 'penne', barcode: '8076802085738', kcalPer100g: 350, proteinPer100g: 12.5, defaultGrams: 160, gradeScore: 1.5, allergens: ['gluten'] },
  { key: 'bread', barcode: '3228857000166', kcalPer100g: 265, proteinPer100g: 9, defaultGrams: 70, gradeScore: 2.2, allergens: ['gluten'] },
  { key: 'tortilla', kcalPer100g: 310, proteinPer100g: 8, defaultGrams: 120, gradeScore: 2.6, allergens: ['gluten'] },
  { key: 'flour', barcode: '3021760401007', kcalPer100g: 364, proteinPer100g: 10, defaultGrams: 100, gradeScore: 2.0, allergens: ['gluten'] },
  { key: 'oat', barcode: '3168930009078', kcalPer100g: 375, proteinPer100g: 13.5, defaultGrams: 80, gradeScore: 1.2, allergens: ['gluten'] },
  { key: 'breadcrumb', kcalPer100g: 395, proteinPer100g: 13, defaultGrams: 50, gradeScore: 2.7, allergens: ['gluten'] },
  { key: 'couscous', kcalPer100g: 112, proteinPer100g: 3.8, defaultGrams: 160, gradeScore: 1.6, allergens: ['gluten'] },

  // Dairy & plant milks
  { key: 'milk', barcode: '3155250358788', kcalPer100g: 46, proteinPer100g: 3.3, defaultGrams: 150, gradeScore: 1.8, allergens: ['milk'] },
  { key: 'butter', barcode: '3228021170039', kcalPer100g: 717, proteinPer100g: 0.9, defaultGrams: 25, gradeScore: 4.6, allergens: ['milk'] },
  { key: 'cheddar', kcalPer100g: 403, proteinPer100g: 25, defaultGrams: 75, gradeScore: 3.8, allergens: ['milk'] },
  { key: 'parmesan', kcalPer100g: 431, proteinPer100g: 38, defaultGrams: 40, gradeScore: 3.7, allergens: ['milk'] },
  { key: 'halloumi', kcalPer100g: 321, proteinPer100g: 22, defaultGrams: 150, gradeScore: 3.7, allergens: ['milk'] },
  { key: 'cheese', kcalPer100g: 360, proteinPer100g: 23, defaultGrams: 75, gradeScore: 3.7, allergens: ['milk'] },
  { key: 'heavy cream', kcalPer100g: 340, proteinPer100g: 2.1, defaultGrams: 80, gradeScore: 4.3, allergens: ['milk'] },
  { key: 'cream', kcalPer100g: 240, proteinPer100g: 2.5, defaultGrams: 80, gradeScore: 3.9, allergens: ['milk'] },
  { key: 'yogurt', kcalPer100g: 63, proteinPer100g: 5.3, defaultGrams: 120, gradeScore: 1.5, allergens: ['milk'] },
  { key: 'coconut milk', barcode: '8850157400105', kcalPer100g: 185, proteinPer100g: 1.8, defaultGrams: 200, gradeScore: 3.4, allergens: [] },

  // Nuts, nut butters, legumes & seeds
  { key: 'peanut butter', barcode: '5010477348678', kcalPer100g: 598, proteinPer100g: 25, defaultGrams: 90, gradeScore: 3.2, allergens: ['peanuts'] },
  { key: 'peanut', kcalPer100g: 567, proteinPer100g: 26, defaultGrams: 40, gradeScore: 2.4, allergens: ['peanuts'] },
  { key: 'almond', kcalPer100g: 579, proteinPer100g: 21, defaultGrams: 40, gradeScore: 1.8, allergens: ['nuts'] },
  { key: 'cashew', kcalPer100g: 553, proteinPer100g: 18, defaultGrams: 40, gradeScore: 2.2, allergens: ['nuts'] },
  { key: 'walnut', kcalPer100g: 654, proteinPer100g: 15, defaultGrams: 40, gradeScore: 1.9, allergens: ['nuts'] },
  { key: 'hazelnut', kcalPer100g: 628, proteinPer100g: 15, defaultGrams: 40, gradeScore: 2.0, allergens: ['nuts'] },
  { key: 'nutella', barcode: '3017624010701', kcalPer100g: 539, proteinPer100g: 6.3, defaultGrams: 45, gradeScore: 5.0, allergens: ['milk', 'nuts', 'soybeans'] },
  { key: 'chickpea', barcode: '3083681085518', kcalPer100g: 139, proteinPer100g: 7.5, defaultGrams: 200, gradeScore: 1.0, allergens: [] },
  { key: 'lentil', kcalPer100g: 116, proteinPer100g: 9, defaultGrams: 160, gradeScore: 1.0, allergens: [] },
  { key: 'bean', kcalPer100g: 127, proteinPer100g: 8.7, defaultGrams: 200, gradeScore: 1.1, allergens: [] },
  { key: 'sesame', kcalPer100g: 573, proteinPer100g: 18, defaultGrams: 15, gradeScore: 2.4, allergens: ['sesame'] },
  { key: 'tahini', kcalPer100g: 595, proteinPer100g: 17, defaultGrams: 30, gradeScore: 2.6, allergens: ['sesame'] },

  // Vegetables & fruits
  { key: 'potato', kcalPer100g: 77, proteinPer100g: 2.0, defaultGrams: 250, gradeScore: 1.2, allergens: [] },
  { key: 'sweet potato', kcalPer100g: 86, proteinPer100g: 1.6, defaultGrams: 250, gradeScore: 1.1, allergens: [] },
  { key: 'eggplant', kcalPer100g: 25, proteinPer100g: 1.0, defaultGrams: 220, gradeScore: 1.0, allergens: [] },
  { key: 'zucchini', kcalPer100g: 17, proteinPer100g: 1.2, defaultGrams: 180, gradeScore: 1.0, allergens: [] },
  { key: 'spinach', kcalPer100g: 23, proteinPer100g: 2.9, defaultGrams: 100, gradeScore: 1.0, allergens: [] },
  { key: 'broccoli', kcalPer100g: 34, proteinPer100g: 2.8, defaultGrams: 180, gradeScore: 1.0, allergens: [] },
  { key: 'cauliflower', kcalPer100g: 25, proteinPer100g: 1.9, defaultGrams: 200, gradeScore: 1.0, allergens: [] },
  { key: 'carrot', kcalPer100g: 41, proteinPer100g: 0.9, defaultGrams: 120, gradeScore: 1.0, allergens: [] },
  { key: 'cabbage', kcalPer100g: 25, proteinPer100g: 1.3, defaultGrams: 150, gradeScore: 1.0, allergens: [] },
  { key: 'celery', kcalPer100g: 16, proteinPer100g: 0.7, defaultGrams: 80, gradeScore: 1.0, allergens: ['celery'] },
  { key: 'mushroom', kcalPer100g: 22, proteinPer100g: 3.1, defaultGrams: 150, gradeScore: 1.0, allergens: [] },
  { key: 'tomato', barcode: '8003170002012', kcalPer100g: 24, proteinPer100g: 1.2, defaultGrams: 200, gradeScore: 1.0, allergens: [] },
  { key: 'onion', kcalPer100g: 40, proteinPer100g: 1.1, defaultGrams: 110, gradeScore: 1.0, allergens: [] },
  { key: 'garlic', kcalPer100g: 149, proteinPer100g: 6.4, defaultGrams: 10, gradeScore: 1.1, allergens: [] },
  { key: 'pepper', kcalPer100g: 31, proteinPer100g: 1.0, defaultGrams: 120, gradeScore: 1.0, allergens: [] },
  { key: 'pea', kcalPer100g: 81, proteinPer100g: 5.4, defaultGrams: 100, gradeScore: 1.0, allergens: [] },
  { key: 'sweetcorn', kcalPer100g: 86, proteinPer100g: 3.3, defaultGrams: 100, gradeScore: 1.2, allergens: [] },
  { key: 'avocado', kcalPer100g: 160, proteinPer100g: 2.0, defaultGrams: 130, gradeScore: 1.6, allergens: [] },
  { key: 'banana', kcalPer100g: 89, proteinPer100g: 1.1, defaultGrams: 115, gradeScore: 1.2, allergens: [] },
  { key: 'apple', kcalPer100g: 52, proteinPer100g: 0.3, defaultGrams: 150, gradeScore: 1.0, allergens: [] },

  // Sauces, oils, sugars & baking
  { key: 'olive oil', barcode: '3560070948161', kcalPer100g: 884, proteinPer100g: 0, defaultGrams: 15, gradeScore: 2.6, allergens: [] },
  { key: 'oil', kcalPer100g: 884, proteinPer100g: 0, defaultGrams: 15, gradeScore: 3.4, allergens: [] },
  { key: 'soy sauce', barcode: '8715035110106', kcalPer100g: 53, proteinPer100g: 8, defaultGrams: 20, gradeScore: 3.6, allergens: ['soybeans', 'gluten'] },
  { key: 'mayonnaise', kcalPer100g: 680, proteinPer100g: 1.0, defaultGrams: 30, gradeScore: 4.5, allergens: ['eggs', 'mustard'] },
  { key: 'mustard', kcalPer100g: 66, proteinPer100g: 4.4, defaultGrams: 15, gradeScore: 2.8, allergens: ['mustard'] },
  { key: 'sugar', barcode: '3174660000105', kcalPer100g: 387, proteinPer100g: 0, defaultGrams: 50, gradeScore: 4.9, allergens: [] },
  { key: 'honey', kcalPer100g: 304, proteinPer100g: 0.3, defaultGrams: 30, gradeScore: 4.2, allergens: [] },
  { key: 'chocolate', kcalPer100g: 546, proteinPer100g: 5.0, defaultGrams: 80, gradeScore: 4.8, allergens: ['milk', 'soybeans'] },
]

export const HYDRATION_BARCODES: readonly string[] = Array.from(
  new Set(
    INGREDIENT_OFF_CATALOG.map((p) => p.barcode).filter((b): b is string => Boolean(b)),
  ),
)

const UNICODE_FRACS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 0.333,
  '⅔': 0.667,
}

function parseLeadingAmount(raw: string): { amount: number; rest: string } | null {
  let text = raw.trim().toLowerCase()
  if (!text) return null
  for (const [glyph, val] of Object.entries(UNICODE_FRACS)) {
    if (text.includes(glyph)) {
      text = text.replace(glyph, ` ${val} `).replace(/\s+/g, ' ').trim()
    }
  }

  const mixed = /^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/.exec(text)
  if (mixed && Number(mixed[3]) > 0) {
    return {
      amount: Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]),
      rest: mixed[4],
    }
  }

  const frac = /^(\d+)\/(\d+)\s*(.*)$/.exec(text)
  if (frac && Number(frac[2]) > 0) {
    return { amount: Number(frac[1]) / Number(frac[2]), rest: frac[3] }
  }

  const num = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(text)
  if (num) {
    return { amount: Number(num[1]), rest: num[2] }
  }

  return null
}

/**
 * Estimate ingredient weight in grams from a recipe measure string.
 */
export function estimateIngredientGrams(measure: string, defaultGrams: number): number {
  const parsed = parseLeadingAmount(measure)
  if (!parsed || parsed.amount <= 0) return defaultGrams

  const { amount, rest } = parsed
  if (/^kg\b|^kilogram/.test(rest)) return amount * 1000
  if (/^g\b|^gram/.test(rest)) return amount
  if (/^lb\b|^pound/.test(rest)) return amount * 453.6
  if (/^oz\b|^ounce/.test(rest)) return amount * 28.35
  if (/^l\b|^litre|^liter/.test(rest)) return amount * 1000
  if (/^ml\b/.test(rest)) return amount
  if (/^cup/.test(rest)) return amount * 160
  if (/^tbsp|^tbs|^tablespoon/.test(rest)) return amount * 15
  if (/^tsp|^teaspoon/.test(rest)) return amount * 5
  if (/^can\b|^tin\b/.test(rest)) return amount * 400
  if (/^clove/.test(rest)) return amount * 5
  if (/^slice|^rasher/.test(rest)) return amount * 30
  if (/^handful/.test(rest)) return amount * 45

  // Plain numeric count (e.g. "2" eggs, "1" onion)
  return Math.min(amount * defaultGrams, 1200)
}

function gradeToNumber(grade: NutriScoreGrade): number {
  switch (grade) {
    case 'a':
      return 1
    case 'b':
      return 2
    case 'c':
      return 3
    case 'd':
      return 4
    case 'e':
      return 5
  }
}

function numberToGrade(score: number): NutriScoreGrade {
  if (score <= 1.65) return 'a'
  if (score <= 2.45) return 'b'
  if (score <= 3.25) return 'c'
  if (score <= 4.05) return 'd'
  return 'e'
}

function mapOffAllergenTag(raw: string): AllergenId | null {
  const clean = raw.toLowerCase().trim()
  if (clean.includes('egg')) return 'eggs'
  if (clean.includes('gluten') || clean.includes('wheat') || clean.includes('barley') || clean.includes('rye')) {
    return 'gluten'
  }
  if (clean.includes('milk') || clean.includes('dairy') || clean.includes('lactose')) {
    return 'milk'
  }
  if (clean.includes('peanut')) return 'peanuts'
  if (clean.includes('nut') || clean.includes('almond') || clean.includes('hazelnut') || clean.includes('walnut') || clean.includes('cashew')) {
    return 'nuts'
  }
  if (clean.includes('soy')) return 'soybeans'
  if (clean.includes('crustacean') || clean.includes('shrimp') || clean.includes('prawn') || clean.includes('crab')) {
    return 'crustaceans'
  }
  if (clean.includes('fish')) return 'fish'
  if (clean.includes('sesame')) return 'sesame'
  if (clean.includes('mustard')) return 'mustard'
  if (clean.includes('celery')) return 'celery'
  if (clean.includes('mollusc')) return 'molluscs'
  return null
}

function matchCatalogProfile(
  ingredientName: string,
): IngredientNutritionProfile | null {
  const norm = normalize(ingredientName)
  if (!norm) return null
  // Ignore black/white seasoning pepper when matching vegetable "pepper"
  if (norm === 'pepper' || norm === 'black pepper' || norm === 'white pepper') {
    return null
  }
  for (const entry of INGREDIENT_OFF_CATALOG) {
    if (norm === entry.key || ingredientMatches(entry.key, norm)) {
      return entry
    }
  }
  return null
}

export interface RecipeNutritionEstimate {
  nutriscoreGrade: NutriScoreGrade | null
  caloriesPerServing: number | null
  proteinPerServing: number | null
  servingsAssumed: number
  allergens: AllergenMeta[]
  liveProductsUsed: number
}

/**
 * Estimate per-serving Nutri-Score, calories, protein, and allergens for ANY recipe
 * using our OpenFoodFacts-backed ingredient reference catalog + optional live hydrated
 * OpenFoodFacts barcode records.
 */
export function estimateRecipeNutrition(
  recipe: Recipe,
  liveProductsByBarcode?: ReadonlyMap<string, OpenFoodFactsProduct>,
): RecipeNutritionEstimate {
  let totalKcal = 0
  let totalProtein = 0
  let weightedGradeSum = 0
  let gradeWeightSum = 0
  let matchedCount = 0
  let liveProductsUsed = 0
  const allergenSet = new Set<AllergenId>()

  for (const ing of recipe.ingredients) {
    const profile = matchCatalogProfile(ing.name)
    if (!profile) continue

    matchedCount++
    const live =
      profile.barcode && liveProductsByBarcode
        ? liveProductsByBarcode.get(profile.barcode)
        : undefined

    if (live) liveProductsUsed++

    const kcalPer100g = live?.nutriments?.kcalPer100g ?? profile.kcalPer100g
    const proteinPer100g = live?.nutriments?.proteinPer100g ?? profile.proteinPer100g
    const gradeScore = live?.nutriscoreGrade
      ? gradeToNumber(live.nutriscoreGrade)
      : profile.gradeScore

    const grams = estimateIngredientGrams(ing.measure, profile.defaultGrams)
    const ingKcal = (grams / 100) * kcalPer100g
    const ingProtein = (grams / 100) * proteinPer100g

    totalKcal += ingKcal
    totalProtein += ingProtein

    // Weight Nutri-Score by caloric contribution so oils/sugars aren't drowned out by water weight
    const weight = Math.max(20, ingKcal)
    weightedGradeSum += gradeScore * weight
    gradeWeightSum += weight

    for (const a of profile.allergens) {
      allergenSet.add(a)
    }
    if (live?.allergens?.length) {
      for (const rawTag of live.allergens) {
        const mapped = mapOffAllergenTag(rawTag)
        if (mapped) allergenSet.add(mapped)
      }
    }
  }

  const servingsAssumed =
    recipe.category.toLowerCase() === 'dessert'
      ? 4
      : recipe.ingredients.length >= 8
        ? 4
        : 2

  const isDessert = recipe.category.toLowerCase() === 'dessert'

  if (matchedCount === 0 || totalKcal <= 0) {
    return {
      nutriscoreGrade: null,
      caloriesPerServing: null,
      proteinPerServing: null,
      servingsAssumed,
      allergens: Array.from(allergenSet).map((id) => ALLERGEN_META[id]),
      liveProductsUsed,
    }
  }

  const rawAvgGrade = gradeWeightSum > 0 ? weightedGradeSum / gradeWeightSum : 2.5
  const adjustedGrade = isDessert ? Math.min(5, rawAvgGrade + 0.6) : rawAvgGrade

  const caloriesPerServing = Math.max(
    80,
    Math.min(1100, Math.round(totalKcal / servingsAssumed / 10) * 10),
  )
  const proteinPerServing = Math.max(
    1,
    Math.min(85, Math.round(totalProtein / servingsAssumed)),
  )

  return {
    nutriscoreGrade: numberToGrade(adjustedGrade),
    caloriesPerServing,
    proteinPerServing,
    servingsAssumed,
    allergens: Array.from(allergenSet).map((id) => ALLERGEN_META[id]),
    liveProductsUsed,
  }
}
