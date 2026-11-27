export interface RecipeIngredient {
  name: string
  measure: string
}

export interface Recipe {
  id: string
  name: string
  image: string | null
  category: string
  area: string
  instructions: string[]
  youtube: string | null
  ingredients: RecipeIngredient[]
  emoji?: string
  gradient?: string
  prepMinutes?: number
  isFallback?: boolean
}

export interface FridgeItem {
  id: string
  name: string
  quantity: string
  useBy: string // YYYY-MM-DD or ''
  addedAt: string
}

export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'fine' | 'none'

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export type MealSlotType = 'Lunch' | 'Dinner'
export type PlanSlotKey = `${DayOfWeek}-${MealSlotType}`

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const

export const MEAL_SLOTS: readonly MealSlotType[] = ['Lunch', 'Dinner'] as const

export interface IngredientMatchDetail {
  ingredient: RecipeIngredient
  status: 'have' | 'staple' | 'missing'
  matchedUserItem?: string
  matchedExpiry?: ExpiryStatus
}

export interface MatchedRecipe {
  recipe: Recipe
  score: number
  usedCount: number
  usedUserItems: string[]
  missingCount: number
  missingIngredients: RecipeIngredient[]
  haveIngredients: RecipeIngredient[]
  stapleIngredients: RecipeIngredient[]
  details: IngredientMatchDetail[]
  expiringUsedCount: number
}

export interface ShoppingItem {
  key: string
  name: string
  measures: string[]
  recipeNames: string[]
}
