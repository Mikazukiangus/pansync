const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1'
const THEMEALDB_KEYLESS_PROBE_URL =
  'https://www.themealdb.com/api/spec/openapi-v1.yaml'
const OFF_PROBE_URL =
  'https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=code'
const DEFAULT_OFF_USER_AGENT = 'PanSync/1.0 (pansync.vercel.app)'
const ATTRIBUTION = 'Recipe data and imagery: TheMealDB (https://www.themealdb.com/)'

function readEnv(key: string): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  return proc?.env?.[key]?.trim() ?? ''
}

export async function GET(request: Request): Promise<Response> {
  const apiKey = readEnv('THEMEALDB_API_KEY')
  const apiKeyConfigured = apiKey.length > 0
  const offUserAgent = readEnv('OPENFOODFACTS_USER_AGENT') || DEFAULT_OFF_USER_AGENT
  const url = new URL(request.url)
  const shouldProbe = url.searchParams.get('probe') === '1'
  const probeOff = url.searchParams.get('provider') === 'openfoodfacts'

  let upstream: 'not_checked' | 'ok' | 'degraded' | 'unreachable' = 'not_checked'
  let upstreamLatencyMs: number | null = null

  if (shouldProbe) {
    const start = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    try {
      const res = probeOff
        ? await fetch(OFF_PROBE_URL, {
            signal: controller.signal,
            headers: {
              'User-Agent': offUserAgent,
              Accept: 'application/json',
            },
          })
        : await fetch(
            apiKeyConfigured
              ? `${THEMEALDB_BASE_URL}/${encodeURIComponent(apiKey)}/list.php?c=list`
              : THEMEALDB_KEYLESS_PROBE_URL,
            {
              method: apiKeyConfigured ? 'GET' : 'HEAD',
              signal: controller.signal,
            },
          )
      upstreamLatencyMs = Date.now() - start
      upstream = res.ok ? 'ok' : 'degraded'
    } catch {
      upstreamLatencyMs = Date.now() - start
      upstream = 'unreachable'
    } finally {
      clearTimeout(timer)
    }
  }

  const healthy = upstream !== 'degraded' && upstream !== 'unreachable'

  return Response.json(
    {
      ok: healthy,
      service: 'pansync-api',
      provider: probeOff ? 'OpenFoodFacts' : 'TheMealDB',
      apiVersion: probeOff ? 'v2' : 'v1',
      apiKeyConfigured,
      upstream,
      ...(upstreamLatencyMs !== null ? { upstreamLatencyMs } : {}),
      attribution: ATTRIBUTION,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Attribution': ATTRIBUTION,
      },
    },
  )
}
