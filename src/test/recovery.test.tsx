import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { clear } from 'idb-keyval'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../App'
import { DEFAULT_STAPLES } from '../data/aliases'
import { extractUniqueIngredients, getFallbackRecipes } from '../data/mealdb'
import { resetRecipesMemoryCacheForTests } from '../hooks/useRecipes'
import {
  diagnoseIngredientNoMatch,
  diagnosePriorityOnlyNoMatch,
} from '../lib/recovery'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

describe('Heuristic #9 — Error recognition, diagnosis, and recovery engine', () => {
  const fallback = getFallbackRecipes()
  const suggestions = extractUniqueIngredients(fallback)

  it('detects misspelled ingredients and suggests the closest known ingredient', () => {
    const diag = diagnoseIngredientNoMatch({
      recipes: fallback,
      ingredientSuggestions: suggestions,
      activeIngredients: ['chiken'],
      staples: DEFAULT_STAPLES,
      fridgeMode: false,
      fridgeItems: [],
      maxMissing: null,
      excludedIngredients: [],
      selectedPriorities: [],
    })

    expect(diag.unrecognizedInputs).toHaveLength(1)
    expect(diag.unrecognizedInputs[0].original).toBe('chiken')
    expect(diag.unrecognizedInputs[0].replacement?.toLowerCase()).toContain('chicken')
    expect(diag.suggestedAdditions.length).toBeGreaterThan(0)
  })

  it('explains staple-only searches and suggests main ingredients with exact unlock counts', () => {
    const diag = diagnoseIngredientNoMatch({
      recipes: fallback,
      ingredientSuggestions: suggestions,
      activeIngredients: ['olive oil'],
      staples: DEFAULT_STAPLES,
      fridgeMode: false,
      fridgeItems: [],
      maxMissing: null,
      excludedIngredients: [],
      selectedPriorities: [],
    })

    expect(diag.stapleOnlyInputs).toEqual(['olive oil'])
    expect(diag.headline).toMatch(/Pantry staples alone/i)
    expect(diag.suggestedAdditions.length).toBeGreaterThan(0)
    expect(diag.suggestedAdditions[0].unlockedCount).toBeGreaterThan(0)
  })

  it('diagnoses strict Missing 0 filter and suggests adding the exact missing ingredient', () => {
    const diag = diagnoseIngredientNoMatch({
      recipes: fallback,
      ingredientSuggestions: suggestions,
      activeIngredients: ['rice', 'egg', 'onion', 'garlic'],
      staples: DEFAULT_STAPLES,
      fridgeMode: false,
      fridgeItems: [],
      maxMissing: 0,
      excludedIngredients: [],
      selectedPriorities: [],
    })

    expect(diag.relaxMissing).not.toBeNull()
    expect(diag.relaxMissing?.nextMaxMissing).toBe(1)
    expect(diag.closestMatch?.recipe.name).toMatch(/Golden Egg & Scallion Fried Rice/i)
    expect(
      diag.suggestedAdditions.some((s) => /soy sauce/i.test(s.name)),
    ).toBe(true)
  })

  it('diagnoses mutually exclusive Vegetarian + Crustacean dietary filters with per-filter recovery counts', () => {
    const diag = diagnosePriorityOnlyNoMatch(
      fallback,
      ['vegetarian', 'crustacean'],
      [],
    )

    expect(diag.headline).toMatch(/Vegetarian.*Crustacean/i)
    expect(diag.priorityRemovals).toHaveLength(2)
    expect(diag.priorityRemovals.every((p) => p.unlockedCount > 0)).toBe(true)
  })
})

describe('Find page — Interactive no-match recovery UI', () => {
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

  it('explains why Missing 0 returned 0 matches and recovers in 1 click by adding the suggested ingredient', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    const input = await screen.findByLabelText(/What's in your fridge\?/i)
    await user.type(input, 'rice, egg, onion, garlic{Enter}')
    await user.click(screen.getByRole('button', { name: 'Missing 0' }))

    const recoveryRegion = await screen.findByRole('region', {
      name: /No matching recipes diagnosis and recovery/i,
    })
    expect(
      within(recoveryRegion).getByText(/No recipes can be cooked with zero extra ingredients yet/i),
    ).toBeInTheDocument()

    // Click "+ Add Soy Sauce" to satisfy Missing 0 immediately
    const addSoyBtn = within(recoveryRegion).getByRole('button', {
      name: /Add Soy Sauce/i,
    })
    await user.click(addSoyBtn)

    expect(
      await screen.findByRole('heading', { name: /Golden Egg & Scallion Fried Rice/i }),
    ).toBeInTheDocument()
  })

  it('detects when a dish name is typed into By ingredients and switches to By dish name in 1 click', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    const input = await screen.findByLabelText(/What's in your fridge\?/i)
    await user.type(input, 'Shakshuka{Enter}')

    const recoveryRegion = await screen.findByRole('region', {
      name: /No matching recipes diagnosis and recovery/i,
    })
    expect(
      within(recoveryRegion).getByText(/looks like a dish name rather than an ingredient/i),
    ).toBeInTheDocument()

    await user.click(
      within(recoveryRegion).getByRole('button', {
        name: /Search .*Shakshuka.* by dish name/i,
      }),
    )

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: /Shakshuka/i,
      }),
    ).toBeInTheDocument()
  })
})
