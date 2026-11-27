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

  it('supports undo restoration and batch removal on fridge items', () => {
    useFridge.getState().addItem({ name: 'Spinach', quantity: '1 bag', useBy: '2026-11-28' })
    useFridge.getState().addItem({ name: 'Eggs', quantity: '6', useBy: '2026-12-01' })
    const initial = useFridge.getState().items
    expect(initial).toHaveLength(2)

    const removed = initial[0]
    useFridge.getState().markUsed(removed.id)
    expect(useFridge.getState().items).toHaveLength(1)

    useFridge.getState().restoreItem(removed)
    expect(useFridge.getState().items).toHaveLength(2)

    const allIds = useFridge.getState().items.map((item) => item.id)
    useFridge.getState().removeItemsByIds(allIds)
    expect(useFridge.getState().items).toHaveLength(0)

    useFridge.getState().restoreItems(initial)
    expect(useFridge.getState().items).toHaveLength(2)
  })

  it('supports undo restoration of weekly plan slots and checked shopping items', () => {
    usePlan.getState().setSlot('Mon-Dinner', mockRecipe)
    usePlan.getState().toggleChecked('onion')
    const snapshotSlots = { ...usePlan.getState().slots }
    const snapshotChecked = { ...usePlan.getState().checkedItems }

    usePlan.getState().clearChecked()
    expect(usePlan.getState().checkedItems).toEqual({})
    usePlan.getState().restoreChecked(snapshotChecked)
    expect(usePlan.getState().checkedItems).toEqual({ onion: true })

    usePlan.getState().clearPlan()
    expect(usePlan.getState().slots).toEqual({})
    usePlan.getState().restorePlan(snapshotSlots, snapshotChecked)
    expect(usePlan.getState().slots['Mon-Dinner']?.id).toBe('r-101')
    expect(usePlan.getState().checkedItems).toEqual({ onion: true })

    usePlan.getState().setSlot('2026-11-23-Breakfast', mockRecipe)
    usePlan.getState().setSlot('2026-11-30-Lunch', mockRecipe)
    usePlan.getState().clearWeek(['2026-11-23'])
    expect(usePlan.getState().slots['2026-11-23-Breakfast']).toBeUndefined()
    expect(usePlan.getState().slots['2026-11-30-Lunch']?.id).toBe('r-101')
  })
})
