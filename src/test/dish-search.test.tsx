import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import {
  filterLocalRecipesByDish,
  getFallbackRecipes,
  searchMealsByName,
} from '../data/mealdb'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

describe('Dish-name search data layer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters local fallback recipes by dish name and ranks exact/starts-with matches first', () => {
    const fallback = getFallbackRecipes()
    const matches = filterLocalRecipesByDish('Fried Rice', fallback)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].name).toMatch(/Fried Rice/i)
  })

  it('fetches live TheMealDB dishes via search.php?s= and maps them cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          meals: [
            {
              idMeal: '52771',
              strMeal: 'Spicy Arrabiata Penne',
              strCategory: 'Vegetarian',
              strArea: 'Italian',
              strInstructions: 'Bring a large pot of water to a boil.\nCook pasta al dente.',
              strMealThumb: 'https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg',
              strIngredient1: 'penne rigate',
              strMeasure1: '1 pound',
              strIngredient2: 'olive oil',
              strMeasure2: '1/4 cup',
              strIngredient3: 'garlic',
              strMeasure3: '3 cloves',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const result = await searchMealsByName('Arrabiata', getFallbackRecipes())
    expect(result.fromNetwork).toBe(true)
    expect(result.recipes.some((r) => r.id === '52771' && r.name === 'Spicy Arrabiata Penne')).toBe(
      true,
    )
  })

  it('falls back seamlessly to localPool when network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Offline'))
    const result = await searchMealsByName('Shakshuka', getFallbackRecipes())
    expect(result.fromNetwork).toBe(false)
    expect(result.recipes.length).toBeGreaterThan(0)
    expect(result.recipes[0].name).toMatch(/Shakshuka/i)
  })
})

describe('Dish-name search mode on Find page', () => {
  beforeEach(async () => {
    await clear()
    localStorage.clear()
    resetRecipesMemoryCacheForTests()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    useSearch.getState().clearIngredients()
    useSearch.getState().setFridgeMode(false)
    useSearch.getState().setMaxMissing(null)
    useSearch.getState().setSearchMode('ingredients')
    useSearch.getState().clearDishQuery()
    useSettings.getState().resetStaples()
    useSettings.getState().clearDietaryPreferences()
    for (const id of [...useFavourites.getState().ids]) {
      useFavourites.getState().removeFavourite(id)
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to By ingredients mode and switches cleanly to By dish name to find and open a recipe', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('search.php?s=Arrabiata')) {
        return new Response(
          JSON.stringify({
            meals: [
              {
                idMeal: '52771',
                strMeal: 'Spicy Arrabiata Penne',
                strCategory: 'Vegetarian',
                strArea: 'Italian',
                strInstructions: 'Boil water and cook penne.\nSimmer tomato sauce with garlic.',
                strMealThumb: null,
                strIngredient1: 'penne rigate',
                strMeasure1: '1 pound',
                strIngredient2: 'garlic',
                strMeasure2: '3 cloves',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error('Simulated offline for dataset bootstrap')
    })

    // Add Garlic to fridge so dish card also highlights matching fridge ingredients
    useFridge.getState().addItem({
      name: 'Garlic',
      quantity: '1 bulb',
      useBy: '2026-12-05',
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    // Default mode is still "By ingredients" so existing UI & tests stay untouched
    expect(await screen.findByLabelText(/What's in your fridge\?/i)).toBeInTheDocument()

    // Switch to "By dish name"
    const dishModeBtn = screen.getByRole('button', { name: /By dish name/i })
    await user.click(dishModeBtn)
    expect(dishModeBtn).toHaveAttribute('aria-pressed', 'true')

    // Type dish name and submit
    const dishInput = screen.getByLabelText(/Search dish by name/i)
    await user.type(dishInput, 'Arrabiata{Enter}')

    const heading = await screen.findByRole('heading', { name: /Spicy Arrabiata Penne/i })
    expect(heading).toBeInTheDocument()

    // Shows fridge match summary on the dish card
    const card = heading.closest('article')!
    expect(within(card).getByText(/Uses 1 of yours/i)).toBeInTheDocument()

    // Clicking the live-searched dish opens its Recipe detail page cleanly
    await user.click(heading)
    expect(
      await screen.findByRole('heading', { level: 1, name: /Spicy Arrabiata Penne/i }),
    ).toBeInTheDocument()
  })
})
