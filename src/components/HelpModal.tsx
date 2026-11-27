import {
  CalendarDays,
  HelpCircle,
  Keyboard,
  Refrigerator,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect } from 'react'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-parchment bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="help-modal-title" className="font-display text-xl font-semibold text-ink">
                How PanSync Works
              </h2>
              <p className="text-xs text-ink-muted">
                Quick guide to smart matching, expiry priority, and shortcuts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full p-2 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-parchment bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-sage-600" />
              <span>Smart Ingredient Matching</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              PanSync understands aliases and plurals automatically — typing{' '}
              <strong className="text-ink">cooked rice</strong> matches{' '}
              <strong className="text-ink">rice</strong>,{' '}
              <strong className="text-ink">scallion</strong> matches{' '}
              <strong className="text-ink">spring onions</strong>, and{' '}
              <strong className="text-ink">courgette</strong> matches{' '}
              <strong className="text-ink">zucchini</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-parchment bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Refrigerator className="h-4 w-4 text-tomato-600" />
              <span>Use-By Priority in Fridge Mode</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              Flip on <strong className="text-ink">Use my fridge</strong> to rank recipes that rescue ingredients expiring today or within 3 days at the top. Everything in your Fridge is also subtracted from your Shopping List.
            </p>
          </div>

          <div className="rounded-2xl border border-parchment bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <SlidersHorizontal className="h-4 w-4 text-sage-700" />
              <span>Staples &amp; Allergen Exclusions</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              Pantry staples (salt, pepper, oil, water, plus any you add on the <strong className="text-ink">Fridge</strong> page) always count as &ldquo;have&rdquo; and stay off your shopping list. Set dietary preferences and excluded items in <strong className="text-ink">Preferences</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-parchment bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-sage-700" />
              <span>Weekly Plan Without Dragging</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
              On <strong className="text-ink">Plan</strong>, browse weeks via the overview calendar, drag recipes into Breakfast, Lunch, or Dinner slots — or simply tap any recipe in the sidebar or click <strong className="text-ink">Choose meal</strong> on an empty slot.
            </p>
          </div>

          <div className="rounded-2xl border border-parchment bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Keyboard className="h-4 w-4 text-ink-muted" />
              <span>Keyboard Shortcuts</span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="font-mono font-semibold text-ink">/</dt>
              <dd className="text-ink-muted">Focus ingredient search on Find</dd>
              <dt className="font-mono font-semibold text-ink">↑ / ↓ + Enter</dt>
              <dd className="text-ink-muted">Pick ingredient suggestion</dd>
              <dt className="font-mono font-semibold text-ink">Esc</dt>
              <dd className="text-ink-muted">Close any open dialog or dropdown</dd>
            </dl>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl bg-sage-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sage-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
