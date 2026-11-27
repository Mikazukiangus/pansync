import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { formatExpiryLabel, getExpiryStatus } from '../lib/dates'
import type { ExpiryStatus } from '../types'

interface ExpiryBadgeProps {
  useBy: string
  today?: Date
  compact?: boolean
}

const STYLES: Record<ExpiryStatus, string> = {
  expired: 'bg-tomato-600 text-white ring-1 ring-tomato-700',
  today: 'bg-tomato-100 text-tomato-700 ring-1 ring-tomato-200',
  soon: 'bg-honey-100 text-honey-700 ring-1 ring-honey-500/30',
  fine: 'bg-sage-50 text-sage-700 ring-1 ring-sage-200',
  none: 'bg-cream-dark text-ink-muted ring-1 ring-parchment',
}

export function ExpiryBadge({ useBy, today, compact = false }: ExpiryBadgeProps) {
  const status = getExpiryStatus(useBy, today)
  const label = formatExpiryLabel(useBy, today)

  return (
    <span
      data-expiry-status={status}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${STYLES[status]}`}
    >
      {(status === 'expired' || status === 'today') && (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      {status === 'soon' && <Clock className="h-3.5 w-3.5 shrink-0" />}
      {status === 'fine' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      <span>{label}</span>
    </span>
  )
}
