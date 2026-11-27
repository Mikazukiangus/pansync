import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

describe('End-to-end user flow (Find -> Recipe -> Favourite -> Plan & Shopping List)', () => {
  beforeEach(async () => {
    await clear()
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

    // Simulate offline so built-in fallback recipes & offline banner appear deterministically
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds leftover recipes offline, ticks have/missing on detail, saves favourite, and subtracts fridge from shopping list', async () => {
    const user = userEvent.setup()

    // Put Garlic in the Fridge tracker so we can confirm Shopping List subtracts it later
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

    // 1. Offline fallback banner appears
    expect(await screen.findByText(/Offline recipes:/i)).toBeInTheDocument()

    // 2. Enter "rice, egg, onion" in the Find input
    const input = screen.getByLabelText(/What's in your fridge\?/i)
    await user.type(input, 'rice, egg, onion{Enter}')

    // Golden Egg & Scallion Fried Rice ranks at the top using all 3 items
    const recipeHeading = await screen.findByRole('heading', {
      name: /Golden Egg & Scallion Fried Rice/i,
    })
    expect(recipeHeading).toBeInTheDocument()

    const card = recipeHeading.closest('article')!
    expect(within(card).getByText(/Uses 3 of yours/i)).toBeInTheDocument()

    // 3. Open the Recipe detail page
    await user.click(recipeHeading)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Golden Egg & Scallion Fried Rice/i,
      }),
    ).toBeInTheDocument()

    // Rice, Eggs, Spring Onions, plus Garlic (from Fridge!) are "have"; Soy Sauce is "missing"
    expect(screen.getByText(/Have 4/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing 1/i)).toBeInTheDocument()

    // 4. Favourite the recipe and add it to Monday Dinner
    await user.click(screen.getByRole('button', { name: /Favourite/i }))
    expect(useFavourites.getState().isFavourite('fb-fried-rice')).toBe(true)

    await user.click(screen.getByRole('button', { name: /Add to plan/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Save to .*Dinner/i }))

    // 5. Navigate to Plan page and verify Shopping List leaves out Garlic (in fridge) & Oil/Pepper (staples),
    // while keeping Rice/Eggs/Spring Onions (not in Fridge tracker, only typed in search) and Soy Sauce!
    const navLinks = screen.getAllByRole('link', { name: /Plan/i })
    await user.click(navLinks[0])

    expect(
      await screen.findByRole('heading', { name: /Weekly Meal Plan/i }),
    ).toBeInTheDocument()

    expect(screen.getByText('Soy Sauce')).toBeInTheDocument()
    expect(screen.queryByText('Garlic')).not.toBeInTheDocument()
    expect(screen.queryByText('Vegetable Oil')).not.toBeInTheDocument()
  })
})
