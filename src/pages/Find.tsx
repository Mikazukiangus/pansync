import {
  ChefHat,
  Flame,
  Refrigerator,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { IngredientInput } from '../components/IngredientInput'
import { RecipeCard } from '../components/RecipeCard'
import { useRecipes } from '../hooks/useRecipes'
import { formatSlotLabel, sortFridgeItemsByExpiry } from '../lib/dates'
import { matchRecipes } from '../lib/matching'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'
import type { Recipe } from '../types'

const MAX_MISSING_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Any missing', value: null },
  { label: 'Missing 0', value: 0 },
  { label: '≤ 1 missing', value: 1 },
  { label: '≤ 2 missing', value: 2 },
  { label: '≤ 3 missing', value: 3 },
  { label: '≤ 5 missing', value: 5 },
]

type SortMode = 'best' | 'fewest-missing' | 'most-used'

const PAGE_STEP = 24

export function Find() {
  const { recipes, ingredientSuggestions, loading, isFallback, refresh } = useRecipes()
  const fridgeItems = useFridge((s) => s.items)
  const loadSampleFridge = useFridge((s) => s.loadSampleFridge)
  const staples = useSettings((s) => s.staples)
  const excludedIngredients = useSettings((s) => s.excludedIngredients)
  const recordRecentRecipes = usePlan((s) => s.recordRecentRecipes)

  const {
    manualIngredients,
    fridgeMode,
    maxMissing,
    addIngredients,
    removeIngredient,
    clearIngredients,
    setFridgeMode,
    setMaxMissing,
  } = useSearch()

  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('best')
  const [pagination, setPagination] = useState<{ key: string; count: number }>({
    key: '',
    count: PAGE_STEP,
  })
  const [planNotice, setPlanNotice] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Global "/" keyboard shortcut to jump straight to ingredient search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      if (fridgeMode) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fridgeMode])

  useEffect(() => {
    if (!planNotice) return
    const timer = setTimeout(() => setPlanNotice(null), 3200)
    return () => clearTimeout(timer)
  }, [planNotice])

  const activeIngredients = useMemo(
    () => (fridgeMode ? fridgeItems.map((f) => f.name) : manualIngredients),
    [fridgeMode, fridgeItems, manualIngredients],
  )

  const rawMatches = useMemo(
    () =>
      matchRecipes(recipes, activeIngredients, {
        staples,
        fridgeMode,
        fridgeItems: fridgeMode ? fridgeItems : [],
        maxMissing,
        excludedIngredients,
      }),
    [recipes, activeIngredients, staples, fridgeMode, fridgeItems, maxMissing, excludedIngredients],
  )

  // Check if exclusions alone hid potential matches so empty states can diagnose the exact cause
  const matchesWithoutExclusionsCount = useMemo(() => {
    if (rawMatches.length > 0 || excludedIngredients.length === 0 || activeIngredients.length === 0) {
      return 0
    }
    return matchRecipes(recipes, activeIngredients, {
      staples,
      fridgeMode,
      fridgeItems: fridgeMode ? fridgeItems : [],
      maxMissing,
      excludedIngredients: [],
    }).length
  }, [
    rawMatches.length,
    excludedIngredients.length,
    activeIngredients,
    recipes,
    staples,
    fridgeMode,
    fridgeItems,
    maxMissing,
  ])

  const matches = useMemo(() => {
    if (sortMode === 'best') return rawMatches
    return [...rawMatches].sort((a, b) => {
      if (sortMode === 'fewest-missing') {
        if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
        if (b.usedCount !== a.usedCount) return b.usedCount - a.usedCount
        return b.score - a.score
      }
      // most-used
      if (b.usedCount !== a.usedCount) return b.usedCount - a.usedCount
      if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
      return b.score - a.score
    })
  }, [rawMatches, sortMode])

  const queryKey = useMemo(
    () =>
      `${fridgeMode ? 'fridge' : 'manual'}:${maxMissing ?? 'all'}:${sortMode}:${activeIngredients.join('|')}`,
    [fridgeMode, maxMissing, sortMode, activeIngredients],
  )
  const visibleCount = pagination.key === queryKey ? pagination.count : PAGE_STEP

  // Record top matched recipes in recent results for the Plan drag sidebar
  useEffect(() => {
    if (matches.length > 0) {
      recordRecentRecipes(matches.slice(0, 8).map((m) => m.recipe))
    }
  }, [matches, recordRecentRecipes])

  const sortedFridgePreview = useMemo(
    () => sortFridgeItemsByExpiry(fridgeItems).slice(0, 5),
    [fridgeItems],
  )

  const handleTrySampleFridge = () => {
    loadSampleFridge()
    setFridgeMode(true)
    setMaxMissing(null)
  }

  const displayedMatches = matches.slice(0, visibleCount)

  return (
    <div className="space-y-8">
      {/* Offline fallback notice with actionable retry */}
      {isFallback && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-honey-500/30 bg-honey-50 px-4 py-3 text-sm text-honey-700"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="h-4 w-4 shrink-0 text-honey-600" />
            <span>
              <strong>Offline recipes:</strong> TheMealDB couldn&rsquo;t be reached, so you&rsquo;re browsing {recipes.length} built-in leftover-friendly recipes.
            </span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-honey-500/40 bg-white px-3 py-1.5 text-xs font-semibold text-honey-700 transition hover:bg-honey-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Retrying…' : 'Retry live recipes'}
          </button>
        </div>
      )}

      {planNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800"
        >
          <span>{planNotice}</span>
          <Link to="/plan" className="text-xs font-semibold text-sage-700 underline hover:text-sage-900">
            View weekly plan →
          </Link>
        </div>
      )}

      {/* Hero Search Section */}
      <section className="rounded-3xl border border-parchment bg-linear-to-br from-white via-cream to-sage-50/70 p-6 shadow-xs sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-wide text-sage-700 uppercase">
            Zero-waste kitchen finder
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-bold text-ink sm:text-4xl">
            What&rsquo;s waiting in your fridge?
          </h1>
          <p className="mt-2 text-sm text-ink-muted sm:text-base">
            Enter leftover ingredients — or flip on <strong>Use my fridge</strong> to rank recipes that rescue expiring food first.
          </p>
        </div>

        {/* Toggle + Input */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={fridgeMode}
              onClick={() => setFridgeMode(!fridgeMode)}
              className={`inline-flex min-h-11 items-center gap-2.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                fridgeMode
                  ? 'border-sage-600 bg-sage-600 text-white shadow-xs'
                  : 'border-parchment bg-white text-ink hover:border-sage-300'
              }`}
            >
              <Refrigerator className="h-4 w-4" />
              <span className="tabular-nums">Use my fridge ({fridgeItems.length})</span>
              {fridgeMode && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                  Expiry boost on
                </span>
              )}
            </button>

            {excludedIngredients.length > 0 && (
              <span className="text-xs font-medium text-tomato-700">
                Excluding: {excludedIngredients.join(', ')}
              </span>
            )}
          </div>

          {fridgeMode ? (
            <div className="rounded-2xl border border-sage-200 bg-white p-4">
              {fridgeItems.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted">
                    Your fridge tracker is empty right now. Add items with use-by dates or load a sample fridge!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleTrySampleFridge}
                      className="min-h-10 rounded-xl bg-sage-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sage-700"
                    >
                      Try sample fridge
                    </button>
                    <Link
                      to="/fridge"
                      className="inline-flex min-h-10 items-center rounded-xl border border-parchment px-3.5 py-2 text-xs font-semibold text-ink hover:bg-cream"
                    >
                      Open Fridge →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage-800">
                      <Flame className="h-3.5 w-3.5 text-tomato-500" />
                      Matching {fridgeItems.length} tracked items (soonest-expiring weighted highest)
                    </span>
                    <Link
                      to="/fridge"
                      className="text-xs font-semibold text-sage-700 hover:underline"
                    >
                      Edit fridge →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortedFridgePreview.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-2 rounded-full border border-parchment bg-cream/70 py-1 pr-1.5 pl-3 text-xs font-medium text-ink"
                      >
                        <span>{item.name}</span>
                        <ExpiryBadge useBy={item.useBy} compact />
                      </div>
                    ))}
                    {fridgeItems.length > 5 && (
                      <Link
                        to="/fridge"
                        className="self-center text-xs font-medium text-sage-700 hover:underline"
                      >
                        +{fridgeItems.length - 5} more
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <IngredientInput
              ingredients={manualIngredients}
              suggestions={ingredientSuggestions}
              onAdd={addIngredients}
              onRemove={removeIngredient}
              onClear={clearIngredients}
              externalInputRef={searchInputRef}
            />
          )}
        </div>
      </section>

      {/* Filter & Sort bar when active ingredients exist */}
      {activeIngredients.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
              {loading ? 'Searching recipes…' : `${matches.length} matching recipes`}
            </h2>
            {!loading && matches.length > displayedMatches.length && (
              <span className="text-xs text-ink-muted tabular-nums">
                Showing {displayedMatches.length} of {matches.length}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter by maximum missing ingredients"
              className="flex flex-wrap items-center gap-1.5"
            >
              {MAX_MISSING_OPTIONS.map((opt) => {
                const selected = maxMissing === opt.value
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setMaxMissing(opt.value)}
                    className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                      selected
                        ? 'bg-ink text-white'
                        : 'border border-parchment bg-white text-ink-muted hover:border-sage-300 hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {matches.length > 1 && (
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span className="sr-only">Sort recipes by</span>
                <select
                  aria-label="Sort recipes by"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="min-h-9 rounded-full border border-parchment bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-sage-500 focus:outline-none"
                >
                  <option value="best">Sort: Best match</option>
                  <option value="fewest-missing">Sort: Fewest missing</option>
                  <option value="most-used">Sort: Most ingredients used</option>
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Results / Loading / First-visit Empty State */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-72 animate-pulse rounded-3xl border border-parchment bg-white p-4"
            >
              <div className="h-40 rounded-2xl bg-cream-dark" />
              <div className="mt-4 h-5 w-2/3 rounded-lg bg-cream-dark" />
              <div className="mt-3 h-4 w-1/2 rounded-lg bg-cream-dark" />
            </div>
          ))}
        </div>
      ) : activeIngredients.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-parchment bg-white/70 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
            <ChefHat className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
            Turn random leftovers into tonight&rsquo;s dinner
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Got a bowl of cold rice, half a red pepper, and wilting spinach? Load our sample fridge to see instant expiry-aware rankings across {recipes.length} recipes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTrySampleFridge}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-700"
            >
              <Sparkles className="h-4 w-4" />
              Try sample fridge
            </button>
            <button
              type="button"
              onClick={() => addIngredients('rice, egg, onion')}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-parchment bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50"
            >
              Try &ldquo;rice, egg, onion&rdquo;
            </button>
          </div>
        </section>
      ) : matches.length === 0 ? (
        <section className="rounded-3xl border border-parchment bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-600">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-ink">
            No recipes matched that exact filter
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            {matchesWithoutExclusionsCount > 0
              ? `${matchesWithoutExclusionsCount} matching recipe${matchesWithoutExclusionsCount === 1 ? ' was' : 's were'} hidden by your excluded ingredients (${excludedIngredients.join(', ')}).`
              : maxMissing !== null
                ? 'Try relaxing the "Missing at most N" filter so recipes needing a couple extra items can appear.'
                : 'Try adding a common staple like eggs, rice, onion, garlic, or potatoes — or reset your current list.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {maxMissing !== null && (
              <button
                type="button"
                onClick={() => setMaxMissing(null)}
                className="min-h-10 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sage-700"
              >
                Show all matching recipes
              </button>
            )}
            {!fridgeMode && manualIngredients.length > 0 && (
              <button
                type="button"
                onClick={clearIngredients}
                className="min-h-10 rounded-xl border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-cream"
              >
                Clear ingredients
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedMatches.map((match) => (
              <RecipeCard
                key={match.recipe.id}
                recipe={match.recipe}
                match={match}
                onPlanClick={setPlanningRecipe}
              />
            ))}
          </div>

          {matches.length > displayedMatches.length && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  setPagination((prev) => ({
                    key: queryKey,
                    count: (prev.key === queryKey ? prev.count : PAGE_STEP) + PAGE_STEP,
                  }))
                }
                className="min-h-11 rounded-2xl border border-parchment bg-white px-6 py-2.5 text-sm font-semibold text-ink shadow-2xs transition hover:border-sage-400 hover:bg-sage-50"
              >
                Show more recipes ({matches.length - displayedMatches.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      <AddToPlanModal
        recipe={planningRecipe}
        onClose={() => setPlanningRecipe(null)}
        onAdded={(slotKey, addedRecipe) =>
          setPlanNotice(`Added "${addedRecipe.name}" to ${formatSlotLabel(slotKey)}.`)
        }
      />
    </div>
  )
}
