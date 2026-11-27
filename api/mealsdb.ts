const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1'
const ATTRIBUTION = 'Recipe data and imagery: TheMealDB (https://www.themealdb.com/)'

export const SUPPORTED_ENDPOINTS = [
  'search',
  'lookup',
  'filter',
  'list',
  'categories',
  'random',
  'randomselection',
  'latest',
] as const

export type MealDBEndpoint = (typeof SUPPORTED_ENDPOINTS)[number]

const NO_CACHE_ENDPOINTS = new Set<MealDBEndpoint>(['random', 'randomselection'])

export type BuildUpstreamResult =
  | { ok: true; endpoint: MealDBEndpoint; url: string }
  | { ok: false; status: number; error: string }

function getNonEmptyParam(params: URLSearchParams, key: string): string | null {
  const val = params.get(key)?.trim()
  return val && val.length > 0 ? val : null
}

/**
 * Validate incoming query parameters strictly against TheMealDB OpenAPI v1 spec
 * (https://www.themealdb.com/api/spec/openapi-v1.yaml) and construct a safe,
 * URL-encoded upstream request URL without ever interpolating unvalidated paths.
 */
export function buildUpstreamUrl(
  apiKey: string,
  params: URLSearchParams,
): BuildUpstreamResult {
  const rawEndpoint = getNonEmptyParam(params, 'endpoint')
  if (!rawEndpoint) {
    return {
      ok: false,
      status: 400,
      error: `Missing required "endpoint" query parameter. Supported: ${SUPPORTED_ENDPOINTS.join(', ')}.`,
    }
  }

  if (!SUPPORTED_ENDPOINTS.includes(rawEndpoint as MealDBEndpoint)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported endpoint "${rawEndpoint}". Supported: ${SUPPORTED_ENDPOINTS.join(', ')}.`,
    }
  }

  const endpoint = rawEndpoint as MealDBEndpoint
  const encodedKey = encodeURIComponent(apiKey)
  const upstreamQuery = new URLSearchParams()

  switch (endpoint) {
    case 'search': {
      const s = getNonEmptyParam(params, 's')
      const f = getNonEmptyParam(params, 'f')
      if ((s && f) || (!s && !f)) {
        return {
          ok: false,
          status: 400,
          error: 'Endpoint "search" requires exactly one of "s" (meal name) or "f" (single letter A-Z).',
        }
      }
      if (f) {
        if (!/^[A-Za-z]$/.test(f)) {
          return {
            ok: false,
            status: 400,
            error: 'Parameter "f" must be a single letter (A-Z).',
          }
        }
        upstreamQuery.set('f', f.toLowerCase())
      } else if (s) {
        upstreamQuery.set('s', s)
      }
      break
    }

    case 'lookup': {
      const id = getNonEmptyParam(params, 'i')
      if (!id || !/^[1-9]\d*$/.test(id)) {
        return {
          ok: false,
          status: 400,
          error: 'Endpoint "lookup" requires numeric meal ID parameter "i" (>= 1).',
        }
      }
      upstreamQuery.set('i', id)
      break
    }

    case 'filter': {
      const supplied: Array<[string, string]> = []
      const i = getNonEmptyParam(params, 'i')
      const c = getNonEmptyParam(params, 'c')
      const a = getNonEmptyParam(params, 'a')
      if (i) supplied.push(['i', i])
      if (c) supplied.push(['c', c])
      if (a) supplied.push(['a', a])

      if (supplied.length !== 1) {
        return {
          ok: false,
          status: 400,
          error: 'Endpoint "filter" requires exactly one of "i" (ingredient), "c" (category), or "a" (area).',
        }
      }
      upstreamQuery.set(supplied[0][0], supplied[0][1])
      break
    }

    case 'list': {
      const supplied: Array<[string, string]> = []
      const c = getNonEmptyParam(params, 'c')
      const a = getNonEmptyParam(params, 'a')
      const i = getNonEmptyParam(params, 'i')
      if (c) supplied.push(['c', c])
      if (a) supplied.push(['a', a])
      if (i) supplied.push(['i', i])

      if (supplied.length !== 1 || supplied[0][1] !== 'list') {
        return {
          ok: false,
          status: 400,
          error: 'Endpoint "list" requires exactly one of c=list, a=list, or i=list.',
        }
      }
      upstreamQuery.set(supplied[0][0], 'list')
      break
    }

    case 'categories':
    case 'random':
    case 'randomselection':
    case 'latest':
      break
  }

  const queryString = upstreamQuery.toString()
  const path = `${THEMEALDB_BASE_URL}/${encodedKey}/${endpoint}.php`
  return {
    ok: true,
    endpoint,
    url: queryString ? `${path}?${queryString}` : path,
  }
}

function readApiKey(): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  return proc?.env?.THEMEALDB_API_KEY?.trim() ?? ''
}

export async function GET(request: Request): Promise<Response> {
  const apiKey = readApiKey()
  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error:
          'THEMEALDB_API_KEY is not configured. Add it to .env.local for local dev or Vercel Environment Variables for deployment.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  const requestUrl = new URL(request.url)
  const built = buildUpstreamUrl(apiKey, requestUrl.searchParams)
  if (!built.ok) {
    return Response.json(
      { ok: false, error: built.error },
      {
        status: built.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const upstreamRes = await fetch(built.url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!upstreamRes.ok) {
      return Response.json(
        {
          ok: false,
          error: `TheMealDB upstream responded with HTTP ${upstreamRes.status}.`,
        },
        {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }

    const payload = (await upstreamRes.json()) as Record<string, unknown>
    const cacheHeader = NO_CACHE_ENDPOINTS.has(built.endpoint)
      ? 'no-store'
      : 'public, s-maxage=3600, stale-while-revalidate=86400'

    return Response.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': cacheHeader,
        'X-Attribution': ATTRIBUTION,
      },
    })
  } catch {
    return Response.json(
      {
        ok: false,
        error: 'Unable to reach TheMealDB upstream service.',
      },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } finally {
    clearTimeout(timer)
  }
}
