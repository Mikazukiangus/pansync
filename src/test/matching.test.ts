import { describe, expect, it } from 'vitest'
import {
  evaluateRecipe,
  ingredientMatches,
  isStapleIngredient,
  matchRecipes,
  normalize,
} from '../lib/matching'
import type { FridgeItem, Recipe } from '../types'

const sampleRecipes: Recipe[] = [
  {
    id: 'fried-rice',
    name: 'Egg Fried Rice',
    image: null,
    category: 'Side',
    area: 'Chinese',
    instructions: ['Stir-fry everything.'],
    youtube: null,
    ingredients: [
      { name: 'Rice', measure: '2 cups' },
      { name: 'Eggs', measure: '2' },
      { name: 'Spring Onions', measure: '3 chopped' },
      { name: 'Vegetable Oil', measure: '1 tbsp' },
      { name: 'Salt', measure: 'pinch' },
      { name: 'Soy Sauce', measure: '1 tbsp' },
    ],
  },
  {
    id: 'omelette',
    name: 'Herb Omelette',
    image: null,
    category: 'Breakfast',
    area: 'French',
    instructions: ['Whisk and cook.'],
    youtube: null,
    ingredients: [
      { name: 'Eggs', measure: '3' },
      { name: 'Black Pepper', measure: 'pinch' },
      { name: 'Salt', measure: 'pinch' },
      { name: 'Olive Oil', measure: '1 tsp' },
    ],
  },
  {
    id: 'fajitas',
    name: 'Chicken & Pepper Skillet',
    image: null,
    category: 'Chicken',
    area: 'Mexican',
    instructions: ['Sizzle chicken and peppers.'],
    youtube: null,
    ingredients: [
      { name: 'Chicken Breast', measure: '350g' },
      { name: 'Red Pepper', measure: '1 sliced' },
      { name: 'Onion', measure: '1' },
      { name: 'Garlic', measure: '2 cloves' },
      { name: 'Cumin', measure: '1 tsp' },
    ],
  },
]

describe('matching logic', () => {
  it('normalizes plurals, casing, whitespace, and UK/US or leftover aliases', () => {
    expect(normalize('  Cooked Rice  ')).toBe('rice')
    expect(normalize('Scallions')).toBe(normalize('Spring Onion'))
    expect(normalize('Aubergines')).toBe(normalize('Eggplant'))
    expect(normalize('Courgette')).toBe(normalize('Zucchinis'))
    expect(normalize('Minced Beef')).toBe(normalize('Ground Beef'))
    expect(normalize('Tomatoes')).toBe('tomato')
    expect(normalize('Berries')).toBe('berry')
    expect(normalize('Asparagus')).toBe('asparagus')
  })

  it('matches whole-word parts without substring or culinary compound false positives', () => {
    expect(ingredientMatches('chicken', 'Chicken Breast')).toBe(true)
    expect(ingredientMatches('scallion', 'Spring Onions')).toBe(true)
    expect(ingredientMatches('onion', 'Spring Onions')).toBe(true)
    expect(ingredientMatches('egg', 'Eggplant')).toBe(false)
    expect(ingredientMatches('egg', 'Egg Plants')).toBe(false)
    expect(ingredientMatches('egg', 'Egg Noodles')).toBe(false)
    expect(ingredientMatches('rice', 'Rice Vinegar')).toBe(false)
    expect(ingredientMatches('butter', 'Peanut Butter')).toBe(false)
    expect(ingredientMatches('milk', 'Coconut Milk')).toBe(false)
    expect(ingredientMatches('pea', 'Peanut Butter')).toBe(false)
  })

  it('treats core and custom staples as have and never confuses vegetables with seasoning', () => {
    expect(isStapleIngredient('Salt', ['salt', 'pepper', 'oil', 'water'])).toBe(true)
    expect(isStapleIngredient('Black Pepper', ['salt', 'pepper', 'oil', 'water'])).toBe(true)
    expect(isStapleIngredient('Olive Oil', ['salt', 'pepper', 'oil', 'water'])).toBe(true)
    expect(isStapleIngredient('Boiling Water', ['salt', 'pepper', 'oil', 'water'])).toBe(true)
    // Red Pepper is a vegetable, NOT black pepper seasoning
    expect(isStapleIngredient('Red Pepper', ['salt', 'pepper', 'oil', 'water'])).toBe(false)
    // Custom staple added in settings
    expect(isStapleIngredient('Soy Sauce', ['salt', 'pepper', 'oil', 'water', 'soy sauce'])).toBe(
      true,
    )
  })

  it('scores recipes by non-staple coverage + items used and supports maxMissing filter', () => {
    const evalFriedRice = evaluateRecipe(sampleRecipes[0], [
      'cooked rice',
      'egg',
      'scallions',
    ])
    // Non-staples: Rice, Eggs, Spring Onions, Soy Sauce -> 3 have, 1 missing
    // Vegetable Oil + Salt are staples -> never missing
    expect(evalFriedRice.usedCount).toBe(3)
    expect(evalFriedRice.missingCount).toBe(1)
    expect(evalFriedRice.stapleIngredients).toHaveLength(2)

    const ranked = matchRecipes(sampleRecipes, ['cooked rice', 'egg', 'scallions'])
    expect(ranked[0].recipe.id).toBe('fried-rice')

    const zeroMissing = matchRecipes(sampleRecipes, ['cooked rice', 'egg', 'scallions'], {
      maxMissing: 0,
    })
    expect(zeroMissing.map((r) => r.recipe.id)).toEqual(['omelette'])
  })

  it('boosts recipes that use sooner-expiring items in fridge mode', () => {
    const today = new Date(2026, 10, 27)
    const pair: Recipe[] = [
      {
        id: 'spinach-pasta',
        name: 'Spinach Pasta',
        image: null,
        category: 'Pasta',
        area: 'Italian',
        instructions: ['Cook pasta and wilt spinach.'],
        youtube: null,
        ingredients: [
          { name: 'Spinach', measure: '100g' },
          { name: 'Pasta', measure: '200g' },
        ],
      },
      {
        id: 'carrot-pasta',
        name: 'Roasted Carrot Pasta',
        image: null,
        category: 'Pasta',
        area: 'Italian',
        instructions: ['Roast carrots and toss with pasta.'],
        youtube: null,
        ingredients: [
          { name: 'Carrots', measure: '200g' },
          { name: 'Pasta', measure: '200g' },
        ],
      },
    ]

    const fridgeItems: FridgeItem[] = [
      {
        id: 'f1',
        name: 'Spinach',
        quantity: '1 bag',
        useBy: '2026-11-27', // expires today!
        addedAt: '2026-11-25',
      },
      {
        id: 'f2',
        name: 'Carrots',
        quantity: '4',
        useBy: '2026-12-08', // 11 days away
        addedAt: '2026-11-25',
      },
    ]

    const results = matchRecipes(pair, ['Spinach', 'Carrots'], {
      fridgeMode: true,
      fridgeItems,
      today,
    })

    expect(results).toHaveLength(2)
    expect(results[0].recipe.id).toBe('spinach-pasta')
    expect(results[0].score).toBeGreaterThan(results[1].score)
    expect(results[0].expiringUsedCount).toBe(1)
  })
})
