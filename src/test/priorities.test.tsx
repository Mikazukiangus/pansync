import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { getFallbackRecipes } from '../data/mealdb'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import { getRecipePriorities, recipeMatchesPriorities } from '../lib/priorities'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

describe('Meal recipe priorities', () => {
  it('classifies fallback recipes accurately across all priority categories', () => {
    const recipes = getFallbackRecipes()
    const byId = new Map(recipes.map((r) => [r.id, r]))

    const prawnPasta = byId.get('fb-lemon-prawn-courgette-pasta')!
    expect(getRecipePriorities(prawnPasta)).toContain('crustacean')
    expect(getRecipePriorities(prawnPasta)).toContain('high-protein')
    expect(getRecipePriorities(prawnPasta)).not.toContain('vegetarian')
    expect(getRecipePriorities(prawnPasta)).not.toContain('no-carbs')

    const shakshuka = byId.get('fb-courgette-shakshuka')!
    expect(getRecipePriorities(shakshuka)).toEqual(
      expect.arrayContaining(['high-protein', 'vegetarian', 'low-calorie', 'no-carbs']),
    )

    const chickenWraps = byId.get('fb-chicken-fajita-wraps')!
    expect(getRecipePriorities(chickenWraps)).toContain('high-protein')
    expect(getRecipePriorities(chickenWraps)).not.toContain('vegetarian')
    expect(getRecipePriorities(chickenWraps)).not.toContain('no-carbs')

    expect(recipeMatchesPriorities(shakshuka, ['vegetarian', 'no-carbs'])).toBe(true)
    expect(recipeMatchesPriorities(shakshuka, ['vegetarian', 'crustacean'])).toBe(false)
  })
})

describe('Find page meal priority category filters', () => {
  beforeEach(async () => {
    await clear()
    resetRecipesMemoryCacheForTests()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    useSearch.getState().clearIngredients()
    useSearch.getState().clearPriorities()
    useSearch.getState().setFridgeMode(false)
    useSearch.getState().setMaxMissing(null)
    useSettings.getState().resetStaples()
    for (const id of [...useFavourites.getState().ids]) {
      useFavourites.getState().removeFavourite(id)
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters recipes directly under the hero fridge bubble when priority categories are toggled', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Offline recipes:/i)).toBeInTheDocument()

    const crustaceanBtn = screen.getByRole('button', { name: /Crustacean/i })
    await user.click(crustaceanBtn)
    expect(crustaceanBtn).toHaveAttribute('aria-pressed', 'true')

    expect(
      await screen.findByRole('heading', {
        name: /Lemon, Garlic Prawn & Courgette Ribbon Pasta/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Golden Egg & Scallion Fried Rice/i }),
    ).not.toBeInTheDocument()
  })
})
