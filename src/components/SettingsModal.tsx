import {
  ShieldAlert,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { normalize } from '../lib/matching'
import { MEAL_PRIORITIES } from '../lib/priorities'
import { useSettings } from '../store/useSettings'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    staples,
    excludedIngredients,
    dietaryPreferences = [],
    addExcluded,
    removeExcluded,
    toggleDietaryPreference,
    clearDietaryPreferences,
  } = useSettings()

  const [newExcluded, setNewExcluded] = useState('')
  const [excludedFeedback, setExcludedFeedback] = useState<string | null>(null)

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

  const handleAddExcluded = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = newExcluded.trim()
    if (!cleaned) {
      setExcludedFeedback('Enter an ingredient or allergen to exclude.')
      return
    }
    const norm = normalize(cleaned)
    if (excludedIngredients.some((ex) => normalize(ex) === norm)) {
      setExcludedFeedback(`"${cleaned}" is already excluded.`)
      return
    }
    if (staples.some((s) => normalize(s) === norm)) {
      setExcludedFeedback(`Excluded "${cleaned}". Note: it is also listed as a Pantry Staple.`)
    } else {
      setExcludedFeedback(null)
    }
    addExcluded(cleaned)
    setNewExcluded('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-parchment bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="font-display text-xl font-semibold text-ink">
                Preferences
              </h2>
              <p className="text-xs text-ink-muted">
                Saved automatically in your browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-full p-2 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dietary preferences section */}
        <div className="mt-6 rounded-2xl border border-parchment bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-sage-600" />
              <h3 className="font-sans text-sm font-semibold text-ink">
                Dietary preferences{dietaryPreferences.length > 0 ? ` (${dietaryPreferences.length})` : ''}
              </h3>
            </div>
            {dietaryPreferences.length > 0 && (
              <button
                type="button"
                onClick={clearDietaryPreferences}
                className="rounded-lg px-2 py-1 text-xs font-medium text-sage-700 transition hover:bg-sage-50 hover:text-sage-800"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Prioritize and filter recipes matching these meal categories on Find.
          </p>

          <div
            role="group"
            aria-label="Dietary preferences"
            className="mt-3 flex flex-wrap gap-2"
          >
            {MEAL_PRIORITIES.map((priority) => {
              const selected = dietaryPreferences.includes(priority.id)
              return (
                <button
                  key={priority.id}
                  type="button"
                  aria-pressed={selected}
                  title={priority.description}
                  onClick={() => toggleDietaryPreference(priority.id)}
                  className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    selected
                      ? 'bg-sage-600 text-white shadow-xs hover:bg-sage-700'
                      : 'border border-parchment bg-cream/60 text-ink hover:border-sage-400 hover:bg-sage-50'
                  }`}
                >
                  {priority.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Excluded ingredients / allergens section */}
        <div className="mt-4 rounded-2xl border border-parchment bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-tomato-600" />
              <h3 className="font-sans text-sm font-semibold text-ink">
                Allergens &amp; Disliked Ingredients ({excludedIngredients.length})
              </h3>
            </div>
            {excludedIngredients.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  for (const item of excludedIngredients) {
                    removeExcluded(item)
                  }
                  setExcludedFeedback(null)
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-tomato-50 hover:text-tomato-700"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Hide recipes containing any of these ingredients when searching.
          </p>

          {excludedIngredients.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {excludedIngredients.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tomato-50 px-3 py-1 text-xs font-medium text-tomato-700 ring-1 ring-tomato-200"
                >
                  No {item}
                  <button
                    type="button"
                    onClick={() => removeExcluded(item)}
                    aria-label={`Remove exclusion ${item}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-tomato-600 hover:bg-tomato-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleAddExcluded} className="mt-3 flex gap-2">
            <input
              type="text"
              value={newExcluded}
              onChange={(e) => {
                setNewExcluded(e.target.value)
                if (excludedFeedback) setExcludedFeedback(null)
              }}
              aria-label="Exclude ingredient"
              placeholder="Exclude ingredient (e.g. peanuts, shrimp, cilantro)..."
              className="flex-1 rounded-xl border border-parchment bg-cream/60 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-tomato-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-10 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/85"
            >
              Exclude
            </button>
          </form>
          {excludedFeedback && (
            <p role="status" className="mt-2 text-xs font-medium text-honey-700">
              {excludedFeedback}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl bg-sage-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sage-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
