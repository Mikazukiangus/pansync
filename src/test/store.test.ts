import { beforeEach, describe, expect, it } from 'vitest'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSettings } from '../store/useSettings'
import type { Recipe } from '../types'

const mockRecipe: Recipe = {
  id: 'r-101',
  name: 'Crispy Potato Hash',
  image: null,
  category: 'Breakfast',
  area: 'British',
  instructions: ['Crisp potatoes in skillet.'],
  youtube: null,
  ingredients: [
    { name: 'Potatoes', measure: '400g' },
    { name: 'Onion', measure: '1' },
  ],
}

describe('persisted Zustand stores', () => {
  beforeEach(() => {
    localStorage.clear()
    useFridge.getState().clearFridge()
    usePlan.getState().clearPlan()
    useSettings.getState().resetStaples()
    for (const id of [...useFavourites.getState().ids]) {
      useFavourites.getState().removeFavourite(id)
    }
  })

  it('adds, edits, marks used, and persists fridge items to localStorage', () => {
    useFridge.getState().addItem({
      name: 'Greek Yogurt',
      quantity: '500g',
      useBy: '2026-11-29',
    })

    const items = useFridge.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Greek Yogurt')

    useFridge.getState().updateItem(items[0].id, { quantity: '250g' })
    expect(useFridge.getState().items[0].quantity).toBe('250g')

    const persistedRaw = localStorage.getItem('pansync-fridge')
    expect(persistedRaw).toContain('Greek Yogurt')
    expect(persistedRaw).toContain('250g')

    useFridge.getState().markUsed(items[0].id)
    expect(useFridge.getState().items).toHaveLength(0)
  })

  it('toggles favourites and persists them', () => {
    expect(useFavourites.getState().isFavourite(mockRecipe.id)).toBe(false)
    useFavourites.getState().toggleFavourite(mockRecipe)
    expect(useFavourites.getState().isFavourite(mockRecipe.id)).toBe(true)
    expect(localStorage.getItem('pansync-favourites')).toContain('Crispy Potato Hash')

    useFavourites.getState().toggleFavourite(mockRecipe)
    expect(useFavourites.getState().isFavourite(mockRecipe.id)).toBe(false)
  })

  it('sets, moves, removes plan slots and persists checked shopping items', () => {
    usePlan.getState().setSlot('Mon-Dinner', mockRecipe)
    expect(usePlan.getState().slots['Mon-Dinner']?.name).toBe('Crispy Potato Hash')

    usePlan.getState().moveSlot('Mon-Dinner', 'Wed-Lunch')
    expect(usePlan.getState().slots['Mon-Dinner']).toBeUndefined()
    expect(usePlan.getState().slots['Wed-Lunch']?.id).toBe('r-101')

    usePlan.getState().toggleChecked('onion')
    expect(usePlan.getState().checkedItems['onion']).toBe(true)
    expect(localStorage.getItem('pansync-plan')).toContain('Wed-Lunch')
  })

  it('manages custom staples and dietary exclusions in settings', () => {
    useSettings.getState().addStaple('Soy Sauce')
    expect(useSettings.getState().staples).toContain('soy sauce')
    expect(localStorage.getItem('pansync-settings')).toContain('soy sauce')

    useSettings.getState().addExcluded('Peanuts')
    expect(useSettings.getState().excludedIngredients).toContain('peanuts')
  })
})
