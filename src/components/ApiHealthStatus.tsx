import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface HealthResponse {
  ok?: boolean
  upstream?: 'not_checked' | 'ok' | 'degraded' | 'unreachable'
  upstreamLatencyMs?: number
}

type HealthState =
  | { status: 'checking' }
  | { status: 'ok'; latencyMs?: number }
  | { status: 'error'; detail: string }

async function fetchApiHealth(): Promise<HealthState> {
  try {
    const res = await fetch('/api/health?probe=1', { cache: 'no-store' })
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return { status: 'error', detail: 'Unavailable' }
    }
    const data = (await res.json()) as HealthResponse
    if (res.ok && data.ok && data.upstream !== 'degraded' && data.upstream !== 'unreachable') {
      return { status: 'ok', latencyMs: data.upstreamLatencyMs }
    }
    return {
      status: 'error',
      detail:
        data.upstream === 'unreachable'
          ? 'Upstream unreachable'
          : 'Degraded',
    }
  } catch {
    return { status: 'error', detail: 'Unreachable' }
  }
}

export function ApiHealthStatus() {
  const [health, setHealth] = useState<HealthState>({ status: 'checking' })
  const [refreshing, setRefreshing] = useState(false)

  const runCheck = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    const next = await fetchApiHealth()
    setHealth(next)
    if (isManual) setRefreshing(false)
  }, [])

  useEffect(() => {
    let active = true
    fetchApiHealth().then((next) => {
      if (active) setHealth(next)
    })
    return () => {
      active = false
    }
  }, [])

  const badgeStyle =
    health.status === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : health.status === 'error'
        ? 'border-tomato-200 bg-tomato-50 text-tomato-700'
        : 'border-parchment bg-white text-ink-muted'

  const dotStyle =
    health.status === 'ok'
      ? 'bg-emerald-500'
      : health.status === 'error'
        ? 'bg-tomato-500'
        : 'bg-ink-subtle animate-pulse'

  const label =
    health.status === 'ok'
      ? `API Health: All OK${health.latencyMs !== undefined ? ` (${health.latencyMs}ms)` : ''}`
      : health.status === 'error'
        ? `API Health: ${health.detail}`
        : 'API Health: Checking…'

  return (
    <footer
      aria-label="API health status"
      className="flex items-center justify-center pt-4 pb-2"
    >
      <div
        role="status"
        data-api-health={health.status}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition ${badgeStyle}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotStyle}`} aria-hidden="true" />
        <span>{label}</span>
        <button
          type="button"
          onClick={() => void runCheck(true)}
          disabled={refreshing}
          aria-label="Recheck API health"
          className="ml-0.5 rounded-full p-0.5 opacity-70 transition hover:opacity-100 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </footer>
  )
}
