const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2'
const DEFAULT_USER_AGENT = 'PanSync/1.0 (pansync.vercel.app)'
const ATTRIBUTION =
  'Product data: Open Food Facts (ODbL) - https://world.openfoodfacts.org/'

export const DEFAULT_OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriscore_grade',
  'allergens',
  'allergens_tags',
  'ingredients_text',
  'ingredients_text_en',
  'categories_tags',
].join(',')

const BARCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const NOT_FOUND_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_ENTRIES = 500

// OpenFoodFacts search allows 10 req/min/IP; Vercel functions share IPs, so stay safely below 10.
const SEARCH_RATE_WINDOW_MS = 60 * 1000
const MAX_SEARCH_UPSTREAM_PER_WINDOW = 8

const ALLOWED_SEARCH_FILTERS = [
  'categories_tags',
  'brands_tags',
  'allergens_tags',
  'nutrition_grades_tags',
  'countries_tags',
] as const

export interface OpenFoodFactsProduct {
  barcode: string
  name: string
  brands: string | null
  quantity: string | null
  image: string | null
  nutriscoreGrade: 'a' | 'b' | 'c' | 'd' | 'e' | null
  allergens: string[]
  allergensKnown: boolean
  ingredientsText: string | null
  categories: string[]
  attribution: string
}

interface RawOFFProduct {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  quantity?: string
  image_front_small_url?: string
  image_front_url?: string
  nutriscore_grade?: string
  allergens?: string
  allergens_tags?: string[]
  ingredients_text?: string
  ingredients_text_en?: string
  categories_tags?: string[]
}

interface CacheEntry {
  expiresAt: number
  status: number
  cacheControl: string
  body: Record<string, unknown>
}

const responseCache = new Map<string, CacheEntry>()
const searchTimestamps: number[] = []

export function resetOpenFoodFactsStateForTests(): void {
  responseCache.clear()
  searchTimestamps.length = 0
}

function readUserAgent(): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  return proc?.env?.OPENFOODFACTS_USER_AGENT?.trim() || DEFAULT_USER_AGENT
}

function stripTaxonomyPrefix(tag: string): string {
  return tag
    .replace(/^[a-z]{2,3}:/i, '')
    .replace(/-/g, ' ')
    .trim()
}

export function normalizeNutriscore(
  raw: string | undefined,
): OpenFoodFactsProduct['nutriscoreGrade'] {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  if (lower === 'a' || lower === 'b' || lower === 'c' || lower === 'd' || lower === 'e') {
    return lower
  }
  return null
}

/**
 * Normalize a raw OpenFoodFacts product record, safely handling missing
 * allergen lists, absent/unknown Nutri-Score grades, and partial fields.
 */
export function normalizeOFFProduct(
  raw: RawOFFProduct,
  fallbackBarcode = '',
): OpenFoodFactsProduct {
  const barcode = String(raw.code ?? fallbackBarcode).trim()
  const name =
    raw.product_name?.trim() ||
    raw.product_name_en?.trim() ||
    'Unnamed product'

  const tagAllergens = Array.isArray(raw.allergens_tags)
    ? raw.allergens_tags.map(stripTaxonomyPrefix).filter(Boolean)
    : []

  const textAllergens =
    tagAllergens.length === 0 && typeof raw.allergens === 'string' && raw.allergens.trim()
      ? raw.allergens
          .split(',')
          .map(stripTaxonomyPrefix)
          .filter(Boolean)
      : []

  const allergens = Array.from(new Set([...tagAllergens, ...textAllergens]))
  const allergensKnown =
    allergens.length > 0 ||
    (Array.isArray(raw.allergens_tags) && raw.allergens_tags.length > 0)

  const categories = Array.isArray(raw.categories_tags)
    ? raw.categories_tags.map(stripTaxonomyPrefix).filter(Boolean).slice(0, 6)
    : []

  return {
    barcode,
    name,
    brands: raw.brands?.trim() || null,
    quantity: raw.quantity?.trim() || null,
    image: raw.image_front_small_url?.trim() || raw.image_front_url?.trim() || null,
    nutriscoreGrade: normalizeNutriscore(raw.nutriscore_grade),
    allergens,
    allergensKnown,
    ingredientsText:
      raw.ingredients_text_en?.trim() || raw.ingredients_text?.trim() || null,
    categories,
    attribution: ATTRIBUTION,
  }
}

function getCached(key: string): CacheEntry | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key)
    return null
  }
  return entry
}

function setCached(key: string, entry: CacheEntry): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value
    if (oldestKey !== undefined) {
      responseCache.delete(oldestKey)
    }
  }
  responseCache.set(key, entry)
}

function consumeSearchQuota(now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  while (searchTimestamps.length > 0 && now - searchTimestamps[0] >= SEARCH_RATE_WINDOW_MS) {
    searchTimestamps.shift()
  }
  if (searchTimestamps.length >= MAX_SEARCH_UPSTREAM_PER_WINDOW) {
    const oldest = searchTimestamps[0]
    const retryAfterSec = Math.max(
      1,
      Math.ceil((SEARCH_RATE_WINDOW_MS - (now - oldest)) / 1000),
    )
    return { allowed: false, retryAfterSec }
  }
  searchTimestamps.push(now)
  return { allowed: true, retryAfterSec: 0 }
}

function sanitizeFields(rawFields: string | null): string | null {
  if (!rawFields || !rawFields.trim()) return DEFAULT_OFF_FIELDS
  const trimmed = rawFields.trim()
  if (!/^[a-z0-9_,]+$/i.test(trimmed)) {
    return null
  }
  return trimmed
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  cacheControl: string,
  cacheStatus: 'HIT' | 'MISS' | 'BYPASS',
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Cache': cacheStatus,
      'X-Attribution': ATTRIBUTION,
      ...extraHeaders,
    },
  })
}

async function fetchUpstreamOFF(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': readUserAgent(),
        Accept: 'application/json',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const params = url.searchParams

  const fields = sanitizeFields(params.get('fields'))
  if (!fields) {
    return jsonResponse(
      { ok: false, error: 'Invalid "fields" parameter. Use comma-separated field names.' },
      400,
      'no-store',
      'BYPASS',
    )
  }

  const rawBarcode = params.get('barcode')?.trim()
  const rawCodes = params.get('codes')?.trim()

  // 1. Primary path: single barcode lookup (/api/v2/product/{barcode}.json)
  if (rawBarcode !== undefined) {
    const barcode = rawBarcode.replace(/[\s-]+/g, '')
    if (!/^\d{8,14}$/.test(barcode)) {
      return jsonResponse(
        {
          ok: false,
          error: 'Invalid barcode. Expected an 8-to-14 digit numeric barcode (EAN/UPC/GTIN).',
        },
        400,
        'no-store',
        'BYPASS',
      )
    }

    const cacheKey = `barcode:${barcode}:${fields}`
    const cached = getCached(cacheKey)
    if (cached) {
      return jsonResponse(cached.body, cached.status, cached.cacheControl, 'HIT')
    }

    const upstreamUrl = `${OFF_BASE_URL}/product/${encodeURIComponent(barcode)}.json?fields=${encodeURIComponent(fields)}`

    try {
      const upstreamRes = await fetchUpstreamOFF(upstreamUrl)
      if (upstreamRes.status === 404) {
        const body = {
          ok: false,
          found: false,
          barcode,
          error: 'Product not found in OpenFoodFacts.',
        }
        setCached(cacheKey, {
          expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS,
          status: 404,
          cacheControl: 'public, s-maxage=600, stale-while-revalidate=3600',
          body,
        })
        return jsonResponse(
          body,
          404,
          'public, s-maxage=600, stale-while-revalidate=3600',
          'MISS',
        )
      }

      if (upstreamRes.status === 429 || upstreamRes.status === 503) {
        return jsonResponse(
          {
            ok: false,
            error: 'OpenFoodFacts is temporarily rate-limited or busy. Please retry shortly.',
          },
          upstreamRes.status,
          'no-store',
          'BYPASS',
          { 'Retry-After': upstreamRes.headers.get('retry-after') ?? '15' },
        )
      }

      if (!upstreamRes.ok) {
        return jsonResponse(
          {
            ok: false,
            error: `OpenFoodFacts upstream responded with HTTP ${upstreamRes.status}.`,
          },
          502,
          'no-store',
          'BYPASS',
        )
      }

      const payload = (await upstreamRes.json()) as {
        status?: number
        code?: string
        product?: RawOFFProduct
      }

      if (payload.status === 0 || !payload.product) {
        const body = {
          ok: false,
          found: false,
          barcode,
          error: 'Product not found in OpenFoodFacts.',
        }
        setCached(cacheKey, {
          expiresAt: Date.now() + NOT_FOUND_CACHE_TTL_MS,
          status: 404,
          cacheControl: 'public, s-maxage=600, stale-while-revalidate=3600',
          body,
        })
        return jsonResponse(
          body,
          404,
          'public, s-maxage=600, stale-while-revalidate=3600',
          'MISS',
        )
      }

      const product = normalizeOFFProduct(payload.product, barcode)
      const body = { ok: true, found: true, product }
      const cacheControl = 'public, s-maxage=86400, stale-while-revalidate=604800'

      setCached(cacheKey, {
        expiresAt: Date.now() + BARCODE_CACHE_TTL_MS,
        status: 200,
        cacheControl,
        body,
      })

      return jsonResponse(body, 200, cacheControl, 'MISS')
    } catch {
      return jsonResponse(
        { ok: false, error: 'Unable to reach OpenFoodFacts upstream service.' },
        502,
        'no-store',
        'BYPASS',
      )
    }
  }

  // 2. Secondary path: bulk barcodes (?codes=...) or structured v2 search
  // Protected by in-memory cache + 8 req/min sliding-window quota guard.
  const searchQuery = new URLSearchParams()
  let hasFilter = false

  if (rawCodes) {
    const cleanedCodes = rawCodes
      .split(',')
      .map((c) => c.trim().replace(/[\s-]+/g, ''))
      .filter(Boolean)

    if (
      cleanedCodes.length === 0 ||
      cleanedCodes.length > 20 ||
      cleanedCodes.some((c) => !/^\d{8,14}$/.test(c))
    ) {
      return jsonResponse(
        {
          ok: false,
          error: 'Parameter "codes" must contain 1 to 20 comma-separated numeric barcodes.',
        },
        400,
        'no-store',
        'BYPASS',
      )
    }
    searchQuery.set('code', Array.from(new Set(cleanedCodes)).sort().join(','))
    hasFilter = true
  }

  for (const filterKey of ALLOWED_SEARCH_FILTERS) {
    const val = params.get(filterKey)?.trim()
    if (val) {
      searchQuery.set(filterKey, val)
      hasFilter = true
    }
  }

  if (!hasFilter) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Provide "barcode" (recommended) or "codes", or at least one structured filter (categories_tags, brands_tags, allergens_tags, nutrition_grades_tags, countries_tags).',
      },
      400,
      'no-store',
      'BYPASS',
    )
  }

  const rawPageSize = Number(params.get('page_size') ?? '5')
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(10, Math.floor(rawPageSize))
      : 5

  searchQuery.set('page_size', String(pageSize))
  searchQuery.set('fields', fields)

  const cacheKey = `search:${searchQuery.toString()}`
  const cached = getCached(cacheKey)
  if (cached) {
    return jsonResponse(cached.body, cached.status, cached.cacheControl, 'HIT')
  }

  const quota = consumeSearchQuota()
  if (!quota.allowed) {
    return jsonResponse(
      {
        ok: false,
        error:
          'OpenFoodFacts search rate limit guard triggered (shared IP protection). Use the barcode endpoint or retry shortly.',
      },
      429,
      'no-store',
      'BYPASS',
      { 'Retry-After': String(quota.retryAfterSec) },
    )
  }

  const upstreamUrl = `${OFF_BASE_URL}/search?${searchQuery.toString()}`

  try {
    const upstreamRes = await fetchUpstreamOFF(upstreamUrl)
    if (upstreamRes.status === 429 || upstreamRes.status === 503) {
      return jsonResponse(
        {
          ok: false,
          error: 'OpenFoodFacts search is temporarily rate-limited or busy.',
        },
        upstreamRes.status,
        'no-store',
        'BYPASS',
        { 'Retry-After': upstreamRes.headers.get('retry-after') ?? '20' },
      )
    }

    if (!upstreamRes.ok) {
      return jsonResponse(
        {
          ok: false,
          error: `OpenFoodFacts upstream responded with HTTP ${upstreamRes.status}.`,
        },
        502,
        'no-store',
        'BYPASS',
      )
    }

    const payload = (await upstreamRes.json()) as {
      count?: number
      products?: RawOFFProduct[]
    }

    const products = Array.isArray(payload.products)
      ? payload.products.map((p) => normalizeOFFProduct(p))
      : []

    const body = {
      ok: true,
      count: typeof payload.count === 'number' ? payload.count : products.length,
      products,
    }
    const cacheControl = 'public, s-maxage=3600, stale-while-revalidate=86400'

    setCached(cacheKey, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      status: 200,
      cacheControl,
      body,
    })

    return jsonResponse(body, 200, cacheControl, 'MISS')
  } catch {
    return jsonResponse(
      { ok: false, error: 'Unable to reach OpenFoodFacts upstream service.' },
      502,
      'no-store',
      'BYPASS',
    )
  }
}
