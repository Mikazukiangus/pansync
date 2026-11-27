import { clear } from 'idb-keyval'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GET as offGET,
  normalizeOFFProduct,
  resetOpenFoodFactsStateForTests,
} from '../../api/openfoodfacts'
import {
  lookupProductByBarcode,
  lookupProductsByBarcodes,
  searchOpenFoodFacts,
} from '../data/openfoodfacts'

function setEnvUserAgent(value: string | undefined) {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  if (!proc?.env) return
  if (value === undefined) {
    delete proc.env.OPENFOODFACTS_USER_AGENT
  } else {
    proc.env.OPENFOODFACTS_USER_AGENT = value
  }
}

describe('serverless /api/openfoodfacts handler', () => {
  beforeEach(async () => {
    resetOpenFoodFactsStateForTests()
    setEnvUserAgent(undefined)
    await clear()
  })

  afterEach(() => {
    setEnvUserAgent(undefined)
    vi.restoreAllMocks()
  })

  it('normalizes products cleanly when allergens and Nutri-Score are missing or unknown', () => {
    const partial = normalizeOFFProduct(
      {
        code: '12345678',
        product_name: 'Plain Rolled Oats',
        nutriscore_grade: 'unknown',
      },
      '12345678',
    )

    expect(partial.name).toBe('Plain Rolled Oats')
    expect(partial.nutriscoreGrade).toBeNull()
    expect(partial.allergens).toEqual([])
    expect(partial.allergensKnown).toBe(false)
    expect(partial.brands).toBeNull()

    const full = normalizeOFFProduct({
      code: '3017624010701',
      product_name: 'Nutella',
      brands: 'Ferrero',
      nutriscore_grade: 'E',
      allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    })

    expect(full.nutriscoreGrade).toBe('e')
    expect(full.allergens).toEqual(['milk', 'nuts', 'soybeans'])
    expect(full.allergensKnown).toBe(true)
  })

  it('sends custom User-Agent, caches barcode lookups in memory, and sets edge Cache-Control', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 1,
          code: '3017624010701',
          product: {
            code: '3017624010701',
            product_name: 'Nutella',
            brands: 'Ferrero',
            nutriscore_grade: 'e',
            allergens_tags: ['en:milk', 'en:nuts'],
          },
        }),
        { status: 200 },
      ),
    )

    const first = await offGET(
      new Request('http://localhost/api/openfoodfacts?barcode=3017624010701'),
    )
    expect(first.status).toBe(200)
    expect(first.headers.get('X-Cache')).toBe('MISS')
    expect(first.headers.get('Cache-Control')).toContain('s-maxage=86400')

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(String(calledUrl)).toContain(
      'https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=',
    )
    expect((calledInit?.headers as Record<string, string>)['User-Agent']).toBe(
      'PanSync/1.0 (pansync.vercel.app)',
    )

    const firstJson = (await first.json()) as {
      ok: boolean
      product: { name: string; nutriscoreGrade: string }
    }
    expect(firstJson.ok).toBe(true)
    expect(firstJson.product.name).toBe('Nutella')
    expect(firstJson.product.nutriscoreGrade).toBe('e')

    // Second call hits server memory cache with zero upstream fetches
    const second = await offGET(
      new Request('http://localhost/api/openfoodfacts?barcode=3017624010701'),
    )
    expect(second.status).toBe(200)
    expect(second.headers.get('X-Cache')).toBe('HIT')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('validates barcodes and handles product-not-found (status: 0) with 404', async () => {
    const badRes = await offGET(
      new Request('http://localhost/api/openfoodfacts?barcode=not-a-code'),
    )
    expect(badRes.status).toBe(400)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 0, status_verbose: 'product not found' }), {
        status: 200,
      }),
    )
    const missingRes = await offGET(
      new Request('http://localhost/api/openfoodfacts?barcode=0000000000000'),
    )
    expect(missingRes.status).toBe(404)
  })

  it('enforces sliding-window rate guard on search queries to protect shared Vercel IPs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ count: 0, products: [] }), { status: 200 }),
    )

    // 8 distinct uncached searches allowed within 1 minute
    for (let i = 1; i <= 8; i++) {
      const res = await offGET(
        new Request(`http://localhost/api/openfoodfacts?brands_tags=brand-${i}`),
      )
      expect(res.status).toBe(200)
    }

    // 9th distinct uncached search triggers local 429 guard with Retry-After
    const throttled = await offGET(
      new Request('http://localhost/api/openfoodfacts?brands_tags=brand-9'),
    )
    expect(throttled.status).toBe(429)
    expect(Number(throttled.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1)
  })

  it('caches client barcode lookups and batches uncached codes in src/data/openfoodfacts.ts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('barcode=3017624010701')) {
        return new Response(
          JSON.stringify({
            ok: true,
            found: true,
            product: {
              barcode: '3017624010701',
              name: 'Nutella',
              brands: 'Ferrero',
              quantity: '400g',
              image: null,
              nutriscoreGrade: 'e',
              allergens: ['milk', 'nuts'],
              allergensKnown: true,
              ingredientsText: null,
              categories: [],
              attribution: 'Open Food Facts',
            },
          }),
          { status: 200 },
        )
      }
      if (url.includes('codes=5449000000996')) {
        return new Response(
          JSON.stringify({
            ok: true,
            products: [
              {
                barcode: '5449000000996',
                name: 'Sparkling Water',
                brands: null,
                quantity: null,
                image: null,
                nutriscoreGrade: null,
                allergens: [],
                allergensKnown: false,
                ingredientsText: null,
                categories: [],
                attribution: 'Open Food Facts',
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ ok: true, products: [] }), { status: 200 })
    })

    const first = await lookupProductByBarcode('3017624010701')
    expect(first?.name).toBe('Nutella')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Repeat call served from IndexedDB cache
    const cached = await lookupProductByBarcode('3017624010701')
    expect(cached?.barcode).toBe('3017624010701')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Batch lookup only fetches the uncached barcode
    const batch = await lookupProductsByBarcodes(['3017624010701', '5449000000996'])
    expect(batch).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    // Structured search also caches in IndexedDB
    await searchOpenFoodFacts({ categories_tags: 'en:breakfast-cereals' })
    await searchOpenFoodFacts({ categories_tags: 'en:breakfast-cereals' })
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})
