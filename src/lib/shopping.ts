import { DEFAULT_STAPLES } from '../data/aliases'
import type { FridgeItem, Recipe, ShoppingItem } from '../types'
import { ingredientMatches, isStapleIngredient, normalize } from './matching'

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
}

interface ParsedMeasure {
  amount: number
  unit: string
}

function parseSimpleMeasure(raw: string): ParsedMeasure | null {
  let text = raw.trim()
  if (!text) return null

  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (text.includes(glyph)) {
      text = text.replace(glyph, ` ${val} `).replace(/\s+/g, ' ').trim()
    }
  }

  // Match "1 1/2 cup", "1/2 tsp", "200g", "2 tbsp", "3"
  const mixedMatch = /^(\d+)\s+(\d+)\/(\d+)\s*([a-zA-Z]*)$/.exec(text)
  if (mixedMatch) {
    const whole = Number(mixedMatch[1])
    const num = Number(mixedMatch[2])
    const den = Number(mixedMatch[3])
    if (den !== 0) {
      return { amount: whole + num / den, unit: mixedMatch[4].toLowerCase() }
    }
  }

  const fracMatch = /^(\d+)\/(\d+)\s*([a-zA-Z]*)$/.exec(text)
  if (fracMatch) {
    const num = Number(fracMatch[1])
    const den = Number(fracMatch[2])
    if (den !== 0) {
      return { amount: num / den, unit: fracMatch[3].toLowerCase() }
    }
  }

  const numMatch = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/.exec(text)
  if (numMatch) {
    return {
      amount: Number(numMatch[1]),
      unit: numMatch[2].toLowerCase(),
    }
  }

  return null
}

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

/**
 * Merge duplicate measure strings cleanly (summing matching numeric units like
 * "200g" + "300g" -> "500g", while keeping distinct units readable).
 */
export function mergeMeasures(rawMeasures: readonly string[]): string[] {
  const unitSums = new Map<string, number>()
  const unparsed: string[] = []

  for (const raw of rawMeasures) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const parsed = parseSimpleMeasure(trimmed)
    if (parsed) {
      unitSums.set(parsed.unit, (unitSums.get(parsed.unit) ?? 0) + parsed.amount)
    } else if (!unparsed.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      unparsed.push(trimmed)
    }
  }

  const merged: string[] = []
  for (const [unit, total] of unitSums.entries()) {
    const amt = formatAmount(total)
    const compactUnits = new Set(['g', 'kg', 'ml', 'l', 'oz', 'lb'])
    merged.push(unit ? (compactUnits.has(unit) ? `${amt}${unit}` : `${amt} ${unit}`) : amt)
  }

  return [...merged, ...unparsed]
}

function toTitleCase(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Build a consolidated shopping list from planned recipes:
 * - Merges duplicate ingredients across recipes (including normalized aliases)
 * - Removes anything already in the user's fridge
 * - Removes anything on the staples list
 */
export function buildShoppingList(
  plannedRecipes: readonly Recipe[],
  fridgeItems: readonly FridgeItem[],
  staples: readonly string[] = DEFAULT_STAPLES,
): ShoppingItem[] {
  const buckets = new Map<
    string,
    {
      displayName: string
      rawMeasures: string[]
      recipeNames: Set<string>
    }
  >()

  for (const recipe of plannedRecipes) {
    for (const ing of recipe.ingredients) {
      const key = normalize(ing.name)
      if (!key) continue

      if (isStapleIngredient(ing.name, staples)) {
        continue
      }

      const inFridge = fridgeItems.some((fi) => ingredientMatches(fi.name, ing.name))
      if (inFridge) {
        continue
      }

      const existing = buckets.get(key)
      if (existing) {
        if (ing.measure.trim()) {
          existing.rawMeasures.push(ing.measure.trim())
        }
        existing.recipeNames.add(recipe.name)
      } else {
        buckets.set(key, {
          displayName: toTitleCase(key),
          rawMeasures: ing.measure.trim() ? [ing.measure.trim()] : [],
          recipeNames: new Set([recipe.name]),
        })
      }
    }
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      name: bucket.displayName,
      measures: mergeMeasures(bucket.rawMeasures),
      recipeNames: Array.from(bucket.recipeNames),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Format the shopping list as plain text for copying to the clipboard.
 */
export function formatShoppingListText(
  items: readonly ShoppingItem[],
  checkedMap: Readonly<Record<string, boolean>> = {},
): string {
  if (items.length === 0) return 'PanSync Shopping List — Nothing needed!'
  const lines = items.map((item) => {
    const tick = checkedMap[item.key] ? '[x]' : '[ ]'
    const qty = item.measures.length > 0 ? ` (${item.measures.join(' + ')})` : ''
    return `${tick} ${item.name}${qty}`
  })
  return `PanSync Shopping List\n${lines.join('\n')}`
}
