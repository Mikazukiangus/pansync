import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import {
  formatLocalDate,
  formatWeekRange,
  getWeekDates,
  getWeekStartMonday,
  makeDatedSlotKey,
} from '../lib/dates'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import type { Recipe } from '../types'

const sampleRecipe: Recipe = {
  id: 'fb-fried-rice',
  name: 'Golden Egg & Scallion Fried Rice',
  image: null,
  category: 'Side',
  area: 'Chinese',
  instructions: ['Fry rice.'],
  youtube: null,
  ingredients: [
    { name: 'Rice', measure: '3 cups' },
    { name: 'Soy Sauce', measure: '2 tbsp' },
  ],
}

const secondRecipe: Recipe = {
  id: 'fb-pasta',
  name: 'Creamy Tomato Pasta',
  image: null,
  category: 'Pasta',
  area: 'Italian',
  instructions: ['Boil pasta.'],
  youtube: null,
  ingredients: [{ name: 'Pasta', measure: '250g' }],
}

describe('Meal Planner — Overview Calendar, Dated Weeks, and 1-Week Expansion', () => {
  beforeEach(async () => {
    await clear()
    resetRecipesMemoryCacheForTests()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    for (const id of [...useFavourites.getState().ids]) {
      useFavourites.getState().removeFavourite(id)
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Simulated offline'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows at most 1 week expanded with dates, lets user scroll weeks, and shows planned days on overview calendar', async () => {
    const user = userEvent.setup()

    const today = new Date()
    const thisMonday = getWeekStartMonday(today)
    const thisWeekDates = getWeekDates(thisMonday)
    const thisWeekMondayYmd = formatLocalDate(thisWeekDates[0])

    const nextMonday = new Date(thisMonday)
    nextMonday.setDate(nextMonday.getDate() + 7)
    const nextWeekDates = getWeekDates(nextMonday)
    const nextWeekWednesdayYmd = formatLocalDate(nextWeekDates[2])

    // Pre-plan a meal in THIS week and a meal in NEXT week
    usePlan.getState().setSlot(makeDatedSlotKey(thisWeekMondayYmd, 'Dinner'), sampleRecipe)
    usePlan.getState().setSlot(makeDatedSlotKey(nextWeekWednesdayYmd, 'Lunch'), secondRecipe)

    render(
      <MemoryRouter initialEntries={['/plan']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: /Weekly Meal Plan/i }),
    ).toBeInTheDocument()

    // Strictly 7 day cards (1 week expanded) in linear order, each with Breakfast above Lunch above Dinner
    const expandedSection = screen.getByLabelText('Expanded week meal plan')
    const dayCards = expandedSection.querySelectorAll('[data-plan-date]')
    expect(dayCards).toHaveLength(7)

    const firstDaySlots = Array.from(dayCards[0].querySelectorAll('[data-slot-key]')).map(
      (el) => el.getAttribute('data-slot-key'),
    )
    expect(firstDaySlots).toEqual([
      `${thisWeekMondayYmd}-Breakfast`,
      `${thisWeekMondayYmd}-Lunch`,
      `${thisWeekMondayYmd}-Dinner`,
    ])

    // Current week range heading and this week's planned recipe are shown
    expect(
      within(expandedSection).getByRole('heading', {
        name: formatWeekRange(thisMonday),
      }),
    ).toBeInTheDocument()
    expect(within(expandedSection).getByText(sampleRecipe.name)).toBeInTheDocument()
    expect(within(expandedSection).queryByText(secondRecipe.name)).not.toBeInTheDocument()

    // Overview calendar shows planned indicators for both dates
    const overviewCalendar = screen.getByLabelText('Meal plan overview calendar')
    const thisMondayCell = overviewCalendar.querySelector(
      `[data-date="${thisWeekMondayYmd}"]`,
    )!
    expect(thisMondayCell).toHaveAttribute('data-planned-count', '1')
    expect(thisMondayCell).toHaveAttribute('data-in-expanded-week', 'true')

    const nextWedCell = overviewCalendar.querySelector(
      `[data-date="${nextWeekWednesdayYmd}"]`,
    )
    if (nextWedCell) {
      expect(nextWedCell).toHaveAttribute('data-planned-count', '1')
      expect(nextWedCell).toHaveAttribute('data-in-expanded-week', 'false')
    }

    // Step to next week via Next week button -> still only 1 week (7 days) expanded
    await user.click(screen.getByRole('button', { name: /Next week/i }))
    expect(
      within(expandedSection).getByRole('heading', {
        name: formatWeekRange(nextMonday),
      }),
    ).toBeInTheDocument()
    expect(expandedSection.querySelectorAll('[data-plan-date]')).toHaveLength(7)
    expect(within(expandedSection).getByText(secondRecipe.name)).toBeInTheDocument()
    expect(within(expandedSection).queryByText(sampleRecipe.name)).not.toBeInTheDocument()

    // Clearing the active week only clears next week, preserving this week's plan!
    await user.click(screen.getByRole('button', { name: /Clear week/i }))
    expect(within(expandedSection).queryByText(secondRecipe.name)).not.toBeInTheDocument()
    expect(
      usePlan.getState().slots[makeDatedSlotKey(thisWeekMondayYmd, 'Dinner')]?.id,
    ).toBe(sampleRecipe.id)

    // Click back on this week's Monday in the overview calendar -> jumps back to this week
    await user.click(
      overviewCalendar.querySelector(`[data-date="${thisWeekMondayYmd}"]`)!,
    )
    expect(
      within(expandedSection).getByRole('heading', {
        name: formatWeekRange(thisMonday),
      }),
    ).toBeInTheDocument()
    expect(within(expandedSection).getByText(sampleRecipe.name)).toBeInTheDocument()
  })
})
