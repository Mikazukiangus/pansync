import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  formatShoppingListText,
  mergeMeasures,
} from '../lib/shopping'
import type { FridgeItem, Recipe } from '../types'

const mealA: Recipe = {
  id: 'a',
  name: 'Garlic Fried Rice',
  image: null,
  category: 'Side',
  area: 'Chinese',
  instructions: ['Stir-fry.'],
  youtube: null,
  ingredients: [
    { name: 'Rice', measure: '200g' },
    { name: 'Spring Onions', measure: '2' },
    { name: 'Garlic', measure: '2 cloves' },
    { name: 'Soy Sauce', measure: '1 tbsp' },
    { name: 'Vegetable Oil', measure: '1 tbsp' },
    { name: 'Salt', measure: 'pinch' },
  ],
}

const mealB: Recipe = {
  id: 'b',
  name: 'Noodle Stir Fry',
  image: null,
  category: 'Main',
  area: 'Asian',
  instructions: ['Toss noodles.'],
  youtube: null,
  ingredients: [
    { name: 'Scallions', measure: '3' }, // alias of Spring Onions -> should merge to 5!
    { name: 'Soy Sauce', measure: '2 tbsp' }, // should merge to 3 tbsp!
    { name: 'Egg Noodles', measure: '250g' },
    { name: 'Water', measure: '50ml' },
  ],
}

describe('shopping list builder', () => {
  it('merges numeric measures with matching units cleanly', () => {
    expect(mergeMeasures(['200g', '300g'])).toEqual(['500g'])
    expect(mergeMeasures(['1 tbsp', '2 tbsp'])).toEqual(['3 tbsp'])
    expect(mergeMeasures(['1/2 cup', '1 1/2 cup'])).toEqual(['2 cup'])
    expect(mergeMeasures(['2', '3'])).toEqual(['5'])
  })

  it('merges duplicate ingredients across meals and subtracts fridge & staples', () => {
    const fridge: FridgeItem[] = [
      {
        id: 'fr-1',
        name: 'Cooked Rice',
        quantity: '1 tub',
        useBy: '2026-11-28',
        addedAt: '2026-11-27',
      },
      {
        id: 'fr-2',
        name: 'Garlic',
        quantity: '1 bulb',
        useBy: '2026-12-05',
        addedAt: '2026-11-27',
      },
    ]

    const list = buildShoppingList([mealA, mealB], fridge, [
      'salt',
      'pepper',
      'oil',
      'water',
    ])

    // Rice & Garlic are in fridge -> excluded
    // Vegetable Oil, Salt, Water are staples -> excluded
    // Remaining: Egg Noodle (250g), Soy Sauce (3 tbsp), Spring Onion (5)
    expect(list.map((i) => i.key)).toEqual(['egg noodle', 'soy sauce', 'spring onion'])

    const soy = list.find((i) => i.key === 'soy sauce')!
    expect(soy.measures).toEqual(['3 tbsp'])
    expect(soy.recipeNames).toEqual(['Garlic Fried Rice', 'Noodle Stir Fry'])

    const scallionMerged = list.find((i) => i.key === 'spring onion')!
    expect(scallionMerged.measures).toEqual(['5'])
  })

  it('formats copyable clipboard text with checkmarks', () => {
    const list = buildShoppingList([mealB], [], ['salt', 'pepper', 'oil', 'water'])
    const text = formatShoppingListText(list, { 'soy sauce': true })
    expect(text).toContain('PanSync Shopping List')
    expect(text).toContain('[x] Soy Sauce (2 tbsp)')
    expect(text).toContain('[ ] Egg Noodle (250g)')
  })
})
