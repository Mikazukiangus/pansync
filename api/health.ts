const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1'
const ATTRIBUTION = 'Recipe data and imagery: TheMealDB (https://www.themealdb.com/)'

function readApiKey(): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  return proc?.env?.THEMEALDB_API_KEY?.trim() ?? ''
}

export async function GET(request: Request): Promise<Response> {
  const apiKey = readApiKey()
  const apiKeyConfigured = apiKey.length > 0
  const url = new URL(request.url)
  const shouldProbe = url.searchParams.get('probe') === '1'
  const strict = url.searchParams.get('strict') === '1'

  let upstream: 'not_checked' | 'ok' | 'degraded' | 'unreachable' = 'not_checked'
  let upstreamLatencyMs: number | null = null

  if (shouldProbe && apiKeyConfigured) {
    const start = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    try {
      const res = await fetch(
        `${THEMEALDB_BASE_URL}/${encodeURIComponent(apiKey)}/list.php?c=list`,
        { signal: controller.signal },
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

  const healthy =
    (!strict || apiKeyConfigured) &&
    upstream !== 'degraded' &&
    upstream !== 'unreachable'

  return Response.json(
    {
      ok: healthy,
      service: 'pansync-api',
      provider: 'TheMealDB',
      apiVersion: 'v1',
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
