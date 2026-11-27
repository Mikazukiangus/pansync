import { get, set } from 'idb-keyval'

export interface OpenFoodFactsNutriments {
  kcalPer100g: number | null
  proteinPer100g: number | null
  fatPer100g: number | null
  carbsPer100g: number | null
  sugarsPer100g: number | null
}

export interface OpenFoodFactsProduct {
  barcode: string
  name: string
  brands: string | null
  quantity: string | null
  image: string | null
  nutriscoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null
  nutriments?: OpenFoodFactsNutriments | null
  allergens: string[]
  allergensKnown: boolean
  ingredientsText: string | null
  categories: string[]
  attribution: string
}

export interface OpenFoodFactsSearchParams {
  categories_tags?: string
  brands_tags?: string
  allergens_tags?: string
  nutrition_grades_tags?: string
  countries_tags?: string
  page_size?: number
}

const OFF_PROXY_PATH = '/api/openfoodfacts'
const BARCODE_CACHE_PREFIX = 'pansync-off-barcode-v1:'
const SEARCH_CACHE_PREFIX = 'pansync-off-search-v1:'
const BARCODE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedProductRecord {
  timestamp: number
  product: OpenFoodFactsProduct | null
}

interface CachedSearchRecord {
  timestamp: number
  products: OpenFoodFactsProduct[]
}

function cleanBarcode(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, '')
}

/**
 * Look up a packaged food product by barcode via `/api/openfoodfacts?barcode=...`.
 * Results are cached in IndexedDB for 7 days to minimize upstream calls.
 */
export async function lookupProductByBarcode(
  rawBarcode: string,
): Promise<OpenFoodFactsProduct | null> {
  const barcode = cleanBarcode(rawBarcode)
  if (!/^\d{8,14}$/.test(barcode)) return null

  const cacheKey = `${BARCODE_CACHE_PREFIX}${barcode}`
  const now = Date.now()

  try {
    const cached = await get<CachedProductRecord>(cacheKey)
    if (cached && now - cached.timestamp < BARCODE_TTL_MS) {
      return cached.product
    }
  } catch {
    // IndexedDB unavailable; continue to API
  }

  const res = await fetch(`${OFF_PROXY_PATH}?barcode=${encodeURIComponent(barcode)}`)
  if (res.status === 404) {
    await set(cacheKey, {
      timestamp: now,
      product: null,
    } satisfies CachedProductRecord).catch(() => {})
    return null
  }

  if (!res.ok) {
    throw new Error(`OpenFoodFacts lookup failed with HTTP ${res.status}`)
  }

  const payload = (await res.json()) as {
    ok?: boolean
    product?: OpenFoodFactsProduct
  }
  const product = payload.product ?? null

  await set(cacheKey, {
    timestamp: now,
    product,
  } satisfies CachedProductRecord).catch(() => {})

  return product
}

/**
 * Batch lookup multiple barcodes: serves any already-cached items from IndexedDB
 * and fetches only missing barcodes in a single `/api/openfoodfacts?codes=...` request.
 */
export async function lookupProductsByBarcodes(
  rawBarcodes: readonly string[],
): Promise<OpenFoodFactsProduct[]> {
  const uniqueBarcodes = Array.from(
    new Set(rawBarcodes.map(cleanBarcode).filter((b) => /^\d{8,14}$/.test(b))),
  )
  if (uniqueBarcodes.length === 0) return []

  const now = Date.now()
  const found: OpenFoodFactsProduct[] = []
  const missing: string[] = []

  for (const code of uniqueBarcodes) {
    try {
      const cached = await get<CachedProductRecord>(`${BARCODE_CACHE_PREFIX}${code}`)
      if (cached && now - cached.timestamp < BARCODE_TTL_MS) {
        if (cached.product) found.push(cached.product)
        continue
      }
    } catch {
      // Ignore storage error
    }
    missing.push(code)
  }

  if (missing.length === 0) {
    return found
  }

  const res = await fetch(
    `${OFF_PROXY_PATH}?codes=${encodeURIComponent(missing.slice(0, 20).join(','))}&page_size=${Math.min(20, missing.length)}`,
  )
  if (!res.ok) {
    throw new Error(`OpenFoodFacts batch lookup failed with HTTP ${res.status}`)
  }

  const payload = (await res.json()) as { products?: OpenFoodFactsProduct[] }
  const fetched = Array.isArray(payload.products) ? payload.products : []

  await Promise.all(
    fetched.map((product) =>
      set(`${BARCODE_CACHE_PREFIX}${product.barcode}`, {
        timestamp: now,
        product,
      } satisfies CachedProductRecord).catch(() => {}),
    ),
  )

  return [...found, ...fetched]
}

/**
 * Structured filter search via `/api/openfoodfacts`.
 * NOTE: OpenFoodFacts search allows only 10 req/min/IP — call only on explicit user submit,
 * never on search-as-you-type keystrokes.
 */
export async function searchOpenFoodFacts(
  params: OpenFoodFactsSearchParams,
): Promise<OpenFoodFactsProduct[]> {
  const query = new URLSearchParams()
  if (params.categories_tags?.trim()) {
    query.set('categories_tags', params.categories_tags.trim())
  }
  if (params.brands_tags?.trim()) {
    query.set('brands_tags', params.brands_tags.trim())
  }
  if (params.allergens_tags?.trim()) {
    query.set('allergens_tags', params.allergens_tags.trim())
  }
  if (params.nutrition_grades_tags?.trim()) {
    query.set('nutrition_grades_tags', params.nutrition_grades_tags.trim())
  }
  if (params.countries_tags?.trim()) {
    query.set('countries_tags', params.countries_tags.trim())
  }
  if (params.page_size) {
    query.set('page_size', String(Math.min(10, Math.max(1, params.page_size))))
  }

  const queryString = query.toString()
  if (!queryString) return []

  const cacheKey = `${SEARCH_CACHE_PREFIX}${queryString}`
  const now = Date.now()

  try {
    const cached = await get<CachedSearchRecord>(cacheKey)
    if (cached && now - cached.timestamp < SEARCH_TTL_MS) {
      return cached.products
    }
  } catch {
    // Ignore storage error
  }

  const res = await fetch(`${OFF_PROXY_PATH}?${queryString}`)
  if (!res.ok) {
    throw new Error(`OpenFoodFacts search failed with HTTP ${res.status}`)
  }

  const payload = (await res.json()) as { products?: OpenFoodFactsProduct[] }
  const products = Array.isArray(payload.products) ? payload.products : []

  await set(cacheKey, {
    timestamp: now,
    products,
  } satisfies CachedSearchRecord).catch(() => {})

  return products
}
