import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { getFallbackRecipes } from '../data/mealdb'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import { formatLocalDate, getWeekDates, getWeekStartMonday } from '../lib/dates'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

describe('Heuristic #7 & #3 — Direct calendar date jump & Search/Favourites undo', () => {
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
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls directly to and highlights the exact selected date card when clicked in the calendar', async () => {
    const user = userEvent.setup()
    const scrolledIds: string[] = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledIds.push(this.id)
    })

    try {
      const today = new Date()
      const thisMonday = getWeekStartMonday(today)
      const thisWeekDates = getWeekDates(thisMonday)
      // Pick Saturday (index 5) or Friday (index 4) if today happens to be Saturday so we test a non-today date too
      const targetIndex = formatLocalDate(thisWeekDates[5]) === formatLocalDate(today) ? 4 : 5
      const targetDate = thisWeekDates[targetIndex]
      const targetYmd = formatLocalDate(targetDate)

      render(
        <MemoryRouter initialEntries={['/plan']}>
          <AppRoutes />
        </MemoryRouter>,
      )

      expect(
        await screen.findByRole('heading', { name: /Weekly Meal Plan/i }),
      ).toBeInTheDocument()

      const overviewCalendar = screen.getByLabelText('Meal plan overview calendar')
      const targetCell = overviewCalendar.querySelector(`[data-date="${targetYmd}"]`)!
      await user.click(targetCell)

      // Smoothly scrolled directly to #plan-day-<YYYY-MM-DD> instead of leaving user at Monday
      expect(scrolledIds).toContain(`plan-day-${targetYmd}`)

      const targetCard = document.getElementById(`plan-day-${targetYmd}`)!
      expect(targetCard).toHaveAttribute('data-selected-date', 'true')
      expect(within(targetCard).getByText('Selected')).toBeInTheDocument()
      expect(document.activeElement).toBe(targetCard)
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('provides one-click Undo when removing an ingredient, clearing all ingredients, or clearing a dish search', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    const input = await screen.findByLabelText(/What's in your fridge\?/i)
    await user.type(input, 'Rice, Eggs, Onion{Enter}')
    expect(useSearch.getState().manualIngredients).toEqual(['Rice', 'Eggs', 'Onion'])

    // 1. Remove single ingredient ("Eggs") -> Undo restores exact order
    await user.click(screen.getByRole('button', { name: 'Remove Eggs' }))
    expect(useSearch.getState().manualIngredients).toEqual(['Rice', 'Onion'])
    expect(screen.getByText(/Removed "Eggs" from search\./i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo$/i }))
    expect(useSearch.getState().manualIngredients).toEqual(['Rice', 'Eggs', 'Onion'])

    // 2. Clear all ingredients -> Undo restores all 3
    await user.click(screen.getByRole('button', { name: /Clear all/i }))
    expect(useSearch.getState().manualIngredients).toEqual([])
    expect(screen.getByText(/Cleared 3 ingredients from search\./i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo$/i }))
    expect(useSearch.getState().manualIngredients).toEqual(['Rice', 'Eggs', 'Onion'])

    // 3. Switch to Dish search, enter "Shakshuka", clear dish search -> Undo restores dish query & results
    await user.click(screen.getByRole('button', { name: /By dish name/i }))
    const dishInput = screen.getByLabelText(/Search dish by name/i)
    await user.type(dishInput, 'Shakshuka{Enter}')

    expect(
      await screen.findByRole('heading', { level: 3, name: /Shakshuka/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Clear dish search/i }))
    expect(useSearch.getState().dishQuery).toBe('')
    expect(screen.getByText(/Cleared dish search "Shakshuka"\./i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo$/i }))
    expect(useSearch.getState().dishQuery).toBe('Shakshuka')
    expect(
      await screen.findByRole('heading', { level: 3, name: /Shakshuka/i }),
    ).toBeInTheDocument()
  })

  it('provides one-click Undo when deleting a dish from My Favourites (even when removing the last favourite)', async () => {
    const user = userEvent.setup()
    const [firstRecipe] = getFallbackRecipes()
    useFavourites.getState().toggleFavourite(firstRecipe)
    useFavourites.getState().dismissLastRemoved()

    render(
      <MemoryRouter initialEntries={['/favourites']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { level: 3, name: firstRecipe.name }),
    ).toBeInTheDocument()

    // Remove the only favourite -> empty state + Undo banner appear
    await user.click(
      screen.getByRole('button', {
        name: `Remove ${firstRecipe.name} from favourites`,
      }),
    )
    expect(screen.getByText(/No favourites saved yet/i)).toBeInTheDocument()
    expect(screen.getByText(/from Favourites\./i)).toBeInTheDocument()

    // Click Undo -> favourite is restored immediately
    await user.click(screen.getByRole('button', { name: /^Undo$/i }))
    expect(
      await screen.findByRole('heading', { level: 3, name: firstRecipe.name }),
    ).toBeInTheDocument()
    expect(useFavourites.getState().isFavourite(firstRecipe.id)).toBe(true)
  })
})
