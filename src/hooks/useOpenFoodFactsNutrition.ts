import { useEffect, useState } from 'react'
import {
  lookupProductsByBarcodes,
  type OpenFoodFactsProduct,
} from '../data/openfoodfacts'
import { HYDRATION_BARCODES } from '../lib/nutrition'

const emptyMap = new Map<string, OpenFoodFactsProduct>()
let sharedProductsMap: Map<string, OpenFoodFactsProduct> | null = null
let sharedHydrationPromise: Promise<Map<string, OpenFoodFactsProduct>> | null = null

export function resetNutritionHydrationForTests(): void {
  sharedProductsMap = null
  sharedHydrationPromise = null
}

/**
 * Hydrates representative OpenFoodFacts reference barcodes once per session
 * (batched into a single `/api/openfoodfacts?codes=...` call and cached in IndexedDB for 7 days).
 * Returns live products map as soon as hydrated without blocking initial render.
 */
export function useOpenFoodFactsProducts(): ReadonlyMap<string, OpenFoodFactsProduct> {
  const [productsMap, setProductsMap] = useState<ReadonlyMap<string, OpenFoodFactsProduct>>(
    () => sharedProductsMap ?? emptyMap,
  )

  useEffect(() => {
    if (sharedProductsMap) return

    let active = true
    if (!sharedHydrationPromise) {
      sharedHydrationPromise = lookupProductsByBarcodes(HYDRATION_BARCODES)
        .then((products) => {
          const map = new Map<string, OpenFoodFactsProduct>()
          for (const product of products) {
            if (product.barcode) {
              map.set(product.barcode, product)
            }
          }
          sharedProductsMap = map
          return map
        })
        .catch(() => {
          sharedProductsMap = emptyMap
          return emptyMap
        })
    }

    sharedHydrationPromise.then((map) => {
      if (active && map.size > 0) {
        setProductsMap(map)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return productsMap
}
