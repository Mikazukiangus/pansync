import { Plus, Search, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { normalize } from '../lib/matching'

interface IngredientInputProps {
  ingredients: readonly string[]
  suggestions: readonly string[]
  onAdd: (rawInput: string) => void
  onRemove: (ingredient: string) => void
  onClear: () => void
  disabled?: boolean
}

const POPULAR_LEFTOVERS = [
  'Rice',
  'Eggs',
  'Onion',
  'Chicken',
  'Spinach',
  'Potatoes',
  'Garlic',
  'Tomatoes',
]

export function IngredientInput({
  ingredients,
  suggestions,
  onAdd,
  onRemove,
  onClear,
  disabled = false,
}: IngredientInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const existingNorms = useMemo(
    () => new Set(ingredients.map((i) => normalize(i))),
    [ingredients],
  )

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLowerCase()
    if (!query || query.includes(',')) return []

    const startsWith: string[] = []
    const includes: string[] = []

    for (const item of suggestions) {
      if (existingNorms.has(normalize(item))) continue
      const lower = item.toLowerCase()
      if (lower.startsWith(query)) {
        startsWith.push(item)
      } else if (lower.includes(query)) {
        includes.push(item)
      }
      if (startsWith.length >= 8) break
    }

    return [...startsWith, ...includes].slice(0, 7)
  }, [draft, suggestions, existingNorms])

  const commitValue = (value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return
    onAdd(cleaned)
    setDraft('')
    setActiveIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length)
      return
    }
    if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setActiveIndex(
        (prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length,
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (
        filteredSuggestions.length > 0 &&
        !draft.includes(',') &&
        activeIndex < filteredSuggestions.length &&
        filteredSuggestions[activeIndex].toLowerCase() === draft.trim().toLowerCase()
      ) {
        commitValue(filteredSuggestions[activeIndex])
      } else if (draft.trim()) {
        commitValue(draft)
      }
      return
    }
    if (e.key === ',' && draft.trim()) {
      e.preventDefault()
      commitValue(draft)
      return
    }
    if (e.key === 'Backspace' && !draft && ingredients.length > 0) {
      onRemove(ingredients[ingredients.length - 1])
    }
    if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border bg-white px-3.5 py-2.5 shadow-xs transition ${
          focused
            ? 'border-sage-500 ring-4 ring-sage-500/15'
            : 'border-parchment hover:border-sage-300'
        } ${disabled ? 'opacity-80' : ''}`}
      >
        <Search className="h-4 w-4 shrink-0 text-ink-subtle" />

        {ingredients.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-800"
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(item)
                }}
                aria-label={`Remove ${item}`}
                className="rounded-full p-0.5 text-sage-700 transition hover:bg-sage-200 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => {
            setDraft(e.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          aria-label="What's in your fridge?"
          placeholder={
            disabled
              ? 'Using items from your Fridge tracker...'
              : ingredients.length === 0
                ? 'Type ingredients (e.g. rice, egg, onion) and press Enter...'
                : 'Add another ingredient...'
          }
          className="min-w-48 flex-1 bg-transparent py-1 text-sm text-ink placeholder:text-ink-subtle focus:outline-none disabled:cursor-not-allowed"
        />

        {draft.trim() && !disabled && (
          <button
            type="button"
            onClick={() => commitValue(draft)}
            className="inline-flex items-center gap-1 rounded-xl bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sage-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}

        {ingredients.length > 0 && !disabled && !draft.trim() && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="text-xs font-medium text-ink-muted hover:text-tomato-600"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {focused && !disabled && filteredSuggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Ingredient suggestions"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-parchment bg-white p-1.5 shadow-xl"
        >
          {filteredSuggestions.map((suggestion, idx) => (
            <li key={suggestion} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitValue(suggestion)
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  idx === activeIndex
                    ? 'bg-sage-50 font-semibold text-sage-800'
                    : 'text-ink hover:bg-cream'
                }`}
              >
                <span>{suggestion}</span>
                <span className="text-xs text-ink-subtle">Press click to add</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Quick-pick leftover chips */}
      {!disabled && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-ink-muted">Quick add:</span>
          {POPULAR_LEFTOVERS.filter((p) => !existingNorms.has(normalize(p))).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onAdd(chip)}
              className="rounded-full border border-parchment bg-white/80 px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-sage-400 hover:bg-sage-50 hover:text-sage-800"
            >
              + {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
