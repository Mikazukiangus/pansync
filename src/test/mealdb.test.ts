import { clear } from 'idb-keyval'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getFallbackRecipes,
  loadRecipeDataset,
  mapMealToRecipe,
} from '../data/mealdb'

describe('mealdb loader, IndexedDB cache, and fallback', () => {
  beforeEach(async () => {
    await clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps raw TheMealDB payloads cleanly including strCountry fallback when strArea is null', () => {
    const mapped = mapMealToRecipe({
      idMeal: '53099',
      strMeal: 'Belgian Waterzooi Chicken',
      strCategory: 'Chicken',
      strArea: null,
      strCountry: 'Belgium',
      strInstructions: '1. Poach chicken.\r\n2. Stir in cream and vegetables.',
      strMealThumb: 'https://example.com/waterzooi.jpg',
      strYoutube: 'https://youtube.com/watch?v=test',
      strIngredient1: 'Chicken Breast',
      strMeasure1: '500g',
      strIngredient2: 'Carrots',
      strMeasure2: '2 sliced',
      strIngredient3: '',
      strMeasure3: '',
    })

    expect(mapped.area).toBe('Belgium')
    expect(mapped.ingredients).toEqual([
      { name: 'Chicken Breast', measure: '500g' },
      { name: 'Carrots', measure: '2 sliced' },
    ])
    expect(mapped.instructions).toEqual([
      'Poach chicken.',
      'Stir in cream and vegetables.',
    ])
  })

  it('serves built-in fallback recipes when network fails and IndexedDB cache is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'))

    const dataset = await loadRecipeDataset()
    expect(dataset.isFallback).toBe(true)
    expect(dataset.recipes.length).toBe(getFallbackRecipes().length)
    expect(dataset.recipes.length).toBeGreaterThanOrEqual(20)
  })

  it('caches fetched recipes in IndexedDB and avoids refetching while cache is fresh', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('list.php?i=list')) {
        return new Response(
          JSON.stringify({
            meals: [{ strIngredient: 'Rice' }, { strIngredient: 'Eggs' }],
          }),
          { status: 200 },
        )
      }
      if (url.includes('search.php?f=a')) {
        return new Response(
          JSON.stringify({
            meals: [
              {
                idMeal: '52768',
                strMeal: 'Apple Frangipane Tart',
                strCategory: 'Dessert',
                strArea: 'British',
                strInstructions: 'Bake until golden.',
                strMealThumb: 'https://example.com/tart.jpg',
                strIngredient1: 'Apples',
                strMeasure1: '3',
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ meals: null }), { status: 200 })
    })

    const firstLoad = await loadRecipeDataset()
    expect(firstLoad.isFallback).toBe(false)
    expect(firstLoad.recipes).toHaveLength(1)
    expect(firstLoad.recipes[0].name).toBe('Apple Frangipane Tart')

    const callCountAfterFirst = fetchSpy.mock.calls.length
    expect(callCountAfterFirst).toBe(27) // 26 letters + 1 ingredient list

    // Second load hits IndexedDB cache without making network requests
    const secondLoad = await loadRecipeDataset()
    expect(secondLoad.isFallback).toBe(false)
    expect(secondLoad.recipes[0].id).toBe('52768')
    expect(fetchSpy.mock.calls.length).toBe(callCountAfterFirst)
  })
})
