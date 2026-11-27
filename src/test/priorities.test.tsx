import { render, screen, within } from '@testing-library/react'
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

describe('Meal recipe priorities / Dietary preferences', () => {
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

describe('Dietary preferences inside the top-right Preferences modal', () => {
  beforeEach(async () => {
    await clear()
    localStorage.clear()
    resetRecipesMemoryCacheForTests()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    useSearch.getState().clearIngredients()
    useSearch.getState().setFridgeMode(false)
    useSearch.getState().setMaxMissing(null)
    useSettings.getState().resetStaples()
    useSettings.getState().clearDietaryPreferences()
    for (const id of [...useFavourites.getState().ids]) {
      useFavourites.getState().removeFavourite(id)
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens Preferences from the top-right button, shows Dietary preferences, and filters Find results', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Offline recipes:/i)).toBeInTheDocument()

    // Open Preferences modal from top-right button
    await user.click(screen.getByRole('button', { name: /Open preferences/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2, name: /^Preferences$/i })).toBeInTheDocument()
    expect(within(dialog).queryByText(/Pantry Staples/i)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { level: 3, name: /^Dietary preferences/i })).toBeInTheDocument()

    // Toggle Crustacean in Dietary preferences and close modal
    const crustaceanBtn = within(dialog).getByRole('button', { name: /Crustacean/i })
    await user.click(crustaceanBtn)
    expect(crustaceanBtn).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dialog).getByRole('button', { name: /Done/i }))

    expect(
      await screen.findByRole('heading', {
        name: /Lemon, Garlic Prawn & Courgette Ribbon Pasta/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Golden Egg & Scallion Fried Rice/i }),
    ).not.toBeInTheDocument()
  })

  it('shows Pantry Staples as the top section on the Fridge page and manages staples', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/fridge']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    const staplesSection = await screen.findByRole('region', { name: /Pantry staples/i })
    const addToFridgeHeading = screen.getByRole('heading', { name: /Add to fridge/i })
    expect(
      Boolean(
        staplesSection.compareDocumentPosition(addToFridgeHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true)

    const stapleInput = within(staplesSection).getByLabelText(/Add pantry staple/i)
    await user.type(stapleInput, 'Paprika')
    await user.click(within(staplesSection).getByRole('button', { name: /^Add$/i }))
    expect(within(staplesSection).getByText('paprika')).toBeInTheDocument()

    await user.click(within(staplesSection).getByRole('button', { name: /Remove staple paprika/i }))
    expect(within(staplesSection).queryByText('paprika')).not.toBeInTheDocument()
  })
})
