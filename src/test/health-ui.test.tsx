import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiHealthStatus } from '../components/ApiHealthStatus'

describe('ApiHealthStatus indicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows green "All OK" status in keyless mode when /api/health?probe=1 succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          apiKeyConfigured: false,
          upstream: 'ok',
          upstreamLatencyMs: 142,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(<ApiHealthStatus />)

    const badge = await screen.findByText(/API Health: All OK \(142ms\)/i)
    const statusEl = badge.closest('[role="status"]')!
    expect(statusEl).toHaveAttribute('data-api-health', 'ok')
    expect(statusEl.className).toContain('bg-emerald-50')
    expect(screen.queryByText(/key not configured/i)).not.toBeInTheDocument()
  })

  it('shows red error state when upstream is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          upstream: 'unreachable',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(<ApiHealthStatus />)

    const badge = await screen.findByText(/API Health: Upstream unreachable/i)
    const statusEl = badge.closest('[role="status"]')!
    expect(statusEl).toHaveAttribute('data-api-health', 'error')
    expect(statusEl.className).toContain('bg-tomato-50')
  })

  it('shows red error state when /api/health network call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    render(<ApiHealthStatus />)

    const badge = await screen.findByText(/API Health: Unreachable/i)
    const statusEl = badge.closest('[role="status"]')!
    expect(statusEl).toHaveAttribute('data-api-health', 'error')
    expect(statusEl.className).toContain('bg-tomato-50')
  })
})
