import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiHealthStatus } from '../components/ApiHealthStatus'

describe('ApiHealthStatus indicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows green "All OK" status when /api/health?probe=1 is healthy with key configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          apiKeyConfigured: true,
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
  })

  it('shows warning state when API key is not yet configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          apiKeyConfigured: false,
          upstream: 'not_checked',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    render(<ApiHealthStatus />)

    const badge = await screen.findByText(/API Health: Key not configured/i)
    expect(badge.closest('[role="status"]')).toHaveAttribute(
      'data-api-health',
      'missing_key',
    )
  })

  it('shows error state when /api/health is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    render(<ApiHealthStatus />)

    const badge = await screen.findByText(/API Health: API unreachable/i)
    const statusEl = badge.closest('[role="status"]')!
    expect(statusEl).toHaveAttribute('data-api-health', 'error')
    expect(statusEl.className).toContain('bg-tomato-50')
  })
})
