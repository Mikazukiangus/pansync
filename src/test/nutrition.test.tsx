import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeCard } from '../components/RecipeCard'
import { resetNutritionHydrationForTests } from '../hooks/useOpenFoodFactsNutrition'
import {
  estimateIngredientGrams,
  estimateRecipeNutrition,
} from '../lib/nutrition'
import type { Recipe } from '../types'

const breadOmelette: Recipe = {
  id: '52905',
  name: 'Bread omelette',
  image: null,
  category: 'Breakfast',
  area: 'India',
  instructions: ['Whisk eggs and toast bread in skillet.'],
  youtube: null,
  ingredients: [
    { name: 'Eggs', measure: '2' },
    { name: 'Bread', measure: '2 slices' },
    { name: 'Olive Oil', measure: '1 tbsp' },
  ],
}

const peanutButterCookies: Recipe = {
  id: '52958',
  name: 'Peanut Butter Cookies',
  image: null,
  category: 'Dessert',
  area: 'American',
  instructions: ['Mix and bake.'],
  youtube: null,
  ingredients: [
    { name: 'Peanut Butter', measure: '1 cup' },
    { name: 'Sugar', measure: '1/2 cup' },
    { name: 'Egg', measure: '1' },
  ],
}

describe('OpenFoodFacts recipe nutrition & allergen estimation', () => {
  beforeEach(() => {
    resetNutritionHydrationForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses ingredient measures into gram weights accurately', () => {
    expect(estimateIngredientGrams('200g', 100)).toBe(200)
    expect(estimateIngredientGrams('1/2 cup', 100)).toBe(80)
    expect(estimateIngredientGrams('2 tbsp', 100)).toBe(30)
    expect(estimateIngredientGrams('2', 55)).toBe(110)
  })

  it('estimates Nutri-Score, kcal/protein, and allergens for recipes cleanly', () => {
    const omeletteStats = estimateRecipeNutrition(breadOmelette)
    expect(omeletteStats.nutriscoreGrade).toMatch(/^[ab]$/)
    expect(omeletteStats.caloriesPerServing).toBeGreaterThan(150)
    expect(omeletteStats.proteinPerServing).toBeGreaterThan(5)
    expect(omeletteStats.allergens.map((a) => a.id)).toEqual(
      expect.arrayContaining(['eggs', 'gluten']),
    )

    const cookieStats = estimateRecipeNutrition(peanutButterCookies)
    expect(cookieStats.nutriscoreGrade).toMatch(/^[de]$/)
    expect(cookieStats.allergens.map((a) => a.id)).toEqual(
      expect.arrayContaining(['peanuts', 'eggs']),
    )
  })

  it('renders Nutri-Score, allergen chips, and kcal/protein cleanly on RecipeCard without overlaying image', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, products: [] }), { status: 200 }),
    )

    render(
      <MemoryRouter>
        <RecipeCard recipe={peanutButterCookies} onPlanClick={() => {}} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Peanut Butter Cookies/i)).toBeInTheDocument()
    expect(screen.getByText(/Est\. [DE]/i)).toBeInTheDocument()
    expect(screen.getByText(/kcal · \d+g P/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Allergens:.*Peanuts/i)).toBeInTheDocument()
  })
})
