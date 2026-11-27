import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as healthGET } from '../../api/health'
import { buildUpstreamUrl, GET as mealsdbGET } from '../../api/mealsdb'

function setEnvKey(value: string | undefined) {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  if (!proc?.env) return
  if (value === undefined) {
    delete proc.env.THEMEALDB_API_KEY
  } else {
    proc.env.THEMEALDB_API_KEY = value
  }
}

describe('serverless /api/health and /api/mealsdb handlers', () => {
  beforeEach(() => {
    setEnvKey(undefined)
  })

  afterEach(() => {
    setEnvKey(undefined)
    vi.restoreAllMocks()
  })

  it('reports health status without leaking or hardcoding API keys', async () => {
    const resUnset = await healthGET(new Request('http://localhost/api/health'))
    expect(resUnset.status).toBe(200)
    const bodyUnset = (await resUnset.json()) as Record<string, unknown>
    expect(bodyUnset.ok).toBe(true)
    expect(bodyUnset.apiKeyConfigured).toBe(false)
    expect(bodyUnset.upstream).toBe('not_checked')

    setEnvKey('secret-test-key-999')
    const resSet = await healthGET(new Request('http://localhost/api/health'))
    const rawText = await resSet.text()
    expect(rawText).not.toContain('secret-test-key-999')
    const bodySet = JSON.parse(rawText) as Record<string, unknown>
    expect(bodySet.apiKeyConfigured).toBe(true)
  })

  it('probes upstream when ?probe=1 is requested and key is configured', async () => {
    setEnvKey('probe-key')
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ meals: [] }), { status: 200 }))

    const res = await healthGET(new Request('http://localhost/api/health?probe=1'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.upstream).toBe('ok')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.themealdb.com/api/json/v1/probe-key/list.php?c=list',
      expect.any(Object),
    )
  })

  it('returns 503 from /api/mealsdb when THEMEALDB_API_KEY is not configured', async () => {
    const res = await mealsdbGET(
      new Request('http://localhost/api/mealsdb?endpoint=search&f=a'),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(String(body.error)).toContain('THEMEALDB_API_KEY')
  })

  it('validates all OpenAPI v1 endpoints and rejects malformed queries', () => {
    expect(
      buildUpstreamUrl('k1', new URLSearchParams('endpoint=search&s=Arrabiata')),
    ).toEqual({
      ok: true,
      endpoint: 'search',
      url: 'https://www.themealdb.com/api/json/v1/k1/search.php?s=Arrabiata',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=search&f=A'))).toEqual({
      ok: true,
      endpoint: 'search',
      url: 'https://www.themealdb.com/api/json/v1/k1/search.php?f=a',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=lookup&i=52772'))).toEqual({
      ok: true,
      endpoint: 'lookup',
      url: 'https://www.themealdb.com/api/json/v1/k1/lookup.php?i=52772',
    })

    expect(
      buildUpstreamUrl('k1', new URLSearchParams('endpoint=filter&i=chicken_breast')),
    ).toEqual({
      ok: true,
      endpoint: 'filter',
      url: 'https://www.themealdb.com/api/json/v1/k1/filter.php?i=chicken_breast',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=list&i=list'))).toEqual({
      ok: true,
      endpoint: 'list',
      url: 'https://www.themealdb.com/api/json/v1/k1/list.php?i=list',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=categories'))).toEqual({
      ok: true,
      endpoint: 'categories',
      url: 'https://www.themealdb.com/api/json/v1/k1/categories.php',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=random'))).toEqual({
      ok: true,
      endpoint: 'random',
      url: 'https://www.themealdb.com/api/json/v1/k1/random.php',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=randomselection'))).toEqual({
      ok: true,
      endpoint: 'randomselection',
      url: 'https://www.themealdb.com/api/json/v1/k1/randomselection.php',
    })

    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=latest'))).toEqual({
      ok: true,
      endpoint: 'latest',
      url: 'https://www.themealdb.com/api/json/v1/k1/latest.php',
    })

    // Shorthand query support (?s=Arrabiata, ?f=a, ?i=52772, ?random=1)
    expect(buildUpstreamUrl('k1', new URLSearchParams('s=Arrabiata'))).toEqual({
      ok: true,
      endpoint: 'search',
      url: 'https://www.themealdb.com/api/json/v1/k1/search.php?s=Arrabiata',
    })
    expect(buildUpstreamUrl('k1', new URLSearchParams('f=a'))).toEqual({
      ok: true,
      endpoint: 'search',
      url: 'https://www.themealdb.com/api/json/v1/k1/search.php?f=a',
    })
    expect(buildUpstreamUrl('k1', new URLSearchParams('i=52772'))).toEqual({
      ok: true,
      endpoint: 'lookup',
      url: 'https://www.themealdb.com/api/json/v1/k1/lookup.php?i=52772',
    })
    expect(buildUpstreamUrl('k1', new URLSearchParams('random=1'))).toEqual({
      ok: true,
      endpoint: 'random',
      url: 'https://www.themealdb.com/api/json/v1/k1/random.php',
    })

    // Validation failures
    expect(buildUpstreamUrl('k1', new URLSearchParams('')).ok).toBe(false)
    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=unknown')).ok).toBe(false)
    expect(
      buildUpstreamUrl('k1', new URLSearchParams('endpoint=search&s=a&f=a')).ok,
    ).toBe(false)
    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=search&f=ab')).ok).toBe(
      false,
    )
    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=lookup&i=abc')).ok).toBe(
      false,
    )
    expect(buildUpstreamUrl('k1', new URLSearchParams('endpoint=list&c=other')).ok).toBe(
      false,
    )
  })

  it('proxies valid requests with proper cache & attribution headers and hides key on failure', async () => {
    setEnvKey('my-private-key')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ meals: [{ idMeal: '52772', strMeal: 'Teriyaki' }] }), {
        status: 200,
      }),
    )

    const okRes = await mealsdbGET(
      new Request('http://localhost/api/mealsdb?endpoint=lookup&i=52772'),
    )
    expect(okRes.status).toBe(200)
    expect(okRes.headers.get('X-Attribution')).toContain('TheMealDB')
    expect(okRes.headers.get('Cache-Control')).toContain('s-maxage=3600')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.themealdb.com/api/json/v1/my-private-key/lookup.php?i=52772',
      expect.any(Object),
    )

    const randomRes = await mealsdbGET(
      new Request('http://localhost/api/mealsdb?endpoint=random'),
    )
    expect(randomRes.headers.get('Cache-Control')).toBe('no-store')

    // Upstream failure must never leak the API key
    fetchSpy.mockRejectedValueOnce(
      new Error('Failed fetching https://www.themealdb.com/api/json/v1/my-private-key/latest.php'),
    )
    const errRes = await mealsdbGET(
      new Request('http://localhost/api/mealsdb?endpoint=latest'),
    )
    expect(errRes.status).toBe(502)
    const errText = await errRes.text()
    expect(errText).not.toContain('my-private-key')
  })
})
