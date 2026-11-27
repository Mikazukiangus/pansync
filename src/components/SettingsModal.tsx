import { RotateCcw, ShieldAlert, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useSettings } from '../store/useSettings'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    staples,
    excludedIngredients,
    addStaple,
    removeStaple,
    resetStaples,
    addExcluded,
    removeExcluded,
  } = useSettings()

  const [newStaple, setNewStaple] = useState('')
  const [newExcluded, setNewExcluded] = useState('')

  if (!open) return null

  const handleAddStaple = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaple.trim()) return
    addStaple(newStaple)
    setNewStaple('')
  }

  const handleAddExcluded = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExcluded.trim()) return
    addExcluded(newExcluded)
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
        className="w-full max-w-lg rounded-3xl border border-parchment bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="font-display text-xl font-semibold text-ink">
                Pantry & Dietary Preferences
              </h2>
              <p className="text-xs text-ink-muted">
                Saved automatically in your browser
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full p-2 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Staples section */}
        <div className="mt-6 rounded-2xl border border-parchment bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sage-600" />
              <h3 className="font-sans text-sm font-semibold text-ink">
                Pantry Staples
              </h3>
            </div>
            <button
              type="button"
              onClick={resetStaples}
              className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset defaults
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Staples always count as &ldquo;have&rdquo; in recipes and are left off your shopping list.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {staples.map((staple) => (
              <span
                key={staple}
                className="inline-flex items-center gap-1.5 rounded-full bg-sage-50 px-3 py-1 text-xs font-medium text-sage-800 ring-1 ring-sage-200"
              >
                {staple}
                <button
                  type="button"
                  onClick={() => removeStaple(staple)}
                  aria-label={`Remove staple ${staple}`}
                  className="rounded-full p-0.5 text-sage-600 hover:bg-sage-200 hover:text-sage-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddStaple} className="mt-3 flex gap-2">
            <input
              type="text"
              value={newStaple}
              onChange={(e) => setNewStaple(e.target.value)}
              placeholder="Add staple (e.g. butter, soy sauce, flour)..."
              className="flex-1 rounded-xl border border-parchment bg-cream/60 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sage-700"
            >
              Add
            </button>
          </form>
        </div>

        {/* Excluded ingredients / allergens section */}
        <div className="mt-4 rounded-2xl border border-parchment bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-tomato-600" />
            <h3 className="font-sans text-sm font-semibold text-ink">
              Allergens & Disliked Ingredients
            </h3>
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
                    className="rounded-full p-0.5 text-tomato-600 hover:bg-tomato-200"
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
              onChange={(e) => setNewExcluded(e.target.value)}
              placeholder="Exclude ingredient (e.g. peanuts, shrimp, cilantro)..."
              className="flex-1 rounded-xl border border-parchment bg-cream/60 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-tomato-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/85"
            >
              Exclude
            </button>
          </form>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
