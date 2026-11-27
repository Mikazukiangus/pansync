import { render, screen } from '@testing-library/react'
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

describe('Recipe detail page — pax scaling & undo have ingredient', () => {
  beforeEach(async () => {
    await clear()
    resetRecipesMemoryCacheForTests()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    useSearch.getState().clearIngredients()
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

  it('scales ingredient measures by number of pax (default 2 pax)', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/recipe/fb-fried-rice']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Golden Egg & Scallion Fried Rice/i,
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('2 pax')).toBeInTheDocument()
    expect(screen.getByText('3 cups chilled')).toBeInTheDocument()

    // Decrease to 1 pax -> halves amounts
    await user.click(screen.getByRole('button', { name: /Decrease pax/i }))
    expect(screen.getByText('1 pax')).toBeInTheDocument()
    expect(screen.getByText('1.5 cups chilled')).toBeInTheDocument()

    // Increase to 4 pax -> doubles base amounts
    const incBtn = screen.getByRole('button', { name: /Increase pax/i })
    await user.click(incBtn)
    await user.click(incBtn)
    await user.click(incBtn)
    expect(screen.getByText('4 pax')).toBeInTheDocument()
    expect(screen.getByText('6 cups chilled')).toBeInTheDocument()
  })

  it('lets the user click the tick on a have ingredient to mark it as missing', async () => {
    const user = userEvent.setup()

    useSearch.getState().addIngredients('rice, eggs')
    useFridge.getState().addItem({
      name: 'Garlic',
      quantity: '1 bulb',
      useBy: '2026-12-05',
    })

    render(
      <MemoryRouter initialEntries={['/recipe/fb-fried-rice']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Golden Egg & Scallion Fried Rice/i,
      }),
    ).toBeInTheDocument()

    // Initially Have 3 (Rice, Eggs, Garlic) and Missing 2 (Spring Onions, Soy Sauce)
    expect(screen.getByText(/Have 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing 2/i)).toBeInTheDocument()

    // Mark missing Soy Sauce as have via "I have this"
    const soyRow = screen.getByText('Soy Sauce').closest('li')!
    expect(soyRow).toHaveAttribute('data-ingredient-status', 'missing')
    await user.click(soyRow.querySelector('button[class*="underline"]')!)

    expect(soyRow).toHaveAttribute('data-ingredient-status', 'have')
    expect(screen.getByText(/Have 4/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing 1/i)).toBeInTheDocument()
    expect(useFridge.getState().items.some((i) => i.name === 'Soy Sauce')).toBe(true)

    // Undo Soy Sauce by clicking its green tick -> goes back to missing and removes from fridge
    await user.click(screen.getByRole('button', { name: /Mark Soy Sauce as missing/i }))
    expect(soyRow).toHaveAttribute('data-ingredient-status', 'missing')
    expect(screen.getByText(/Have 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing 2/i)).toBeInTheDocument()
    expect(useFridge.getState().items.some((i) => i.name === 'Soy Sauce')).toBe(false)

    // Also undo a pre-existing "have" item (Eggs from search) by clicking its tick
    const eggsRow = screen.getByText('Eggs').closest('li')!
    expect(eggsRow).toHaveAttribute('data-ingredient-status', 'have')
    await user.click(screen.getByRole('button', { name: /Mark Eggs as missing/i }))
    expect(eggsRow).toHaveAttribute('data-ingredient-status', 'missing')
    expect(screen.getByText(/Have 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Missing 3/i)).toBeInTheDocument()

    // Clicking the missing icon restores Eggs back to "have"
    await user.click(screen.getByRole('button', { name: /Mark Eggs as have/i }))
    expect(eggsRow).toHaveAttribute('data-ingredient-status', 'have')
    expect(screen.getByText(/Have 3/i)).toBeInTheDocument()
  })
})
