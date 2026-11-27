import {
  ChefHat,
  Flame,
  Refrigerator,
  Search,
  Shuffle,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { IngredientInput } from '../components/IngredientInput'
import { RecipeCard } from '../components/RecipeCard'
import { fetchRandomMeal, searchMealsByName } from '../data/mealdb'
import { useRecipes } from '../hooks/useRecipes'
import { sortFridgeItemsByExpiry } from '../lib/dates'
import { evaluateRecipe, matchRecipes } from '../lib/matching'
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

export function Find() {
  const navigate = useNavigate()
  const { recipes, ingredientSuggestions, loading, isFallback } = useRecipes()
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

  const [searchMode, setSearchMode] = useState<'ingredients' | 'dish'>('ingredients')
  const [dishQuery, setDishQuery] = useState('')
  const [submittedDishQuery, setSubmittedDishQuery] = useState('')
  const [dishResults, setDishResults] = useState<Recipe[]>([])
  const [dishSearching, setDishSearching] = useState(false)
  const [pickingRandom, setPickingRandom] = useState(false)
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null)

  const activeIngredients = useMemo(
    () => (fridgeMode ? fridgeItems.map((f) => f.name) : manualIngredients),
    [fridgeMode, fridgeItems, manualIngredients],
  )

  const matches = useMemo(
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
    setSearchMode('ingredients')
    loadSampleFridge()
    setFridgeMode(true)
    setMaxMissing(null)
  }

  const runDishSearch = async (rawQuery: string) => {
    const cleaned = rawQuery.trim()
    setSubmittedDishQuery(cleaned)
    if (!cleaned) {
      setDishResults([])
      return
    }
    setDishSearching(true)
    try {
      const { recipes: found } = await searchMealsByName(cleaned, recipes)
      setDishResults(found)
      if (found.length > 0) {
        recordRecentRecipes(found.slice(0, 8))
      }
    } finally {
      setDishSearching(false)
    }
  }

  const handleDishSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runDishSearch(dishQuery)
  }

  const handleSurpriseMe = async () => {
    setPickingRandom(true)
    try {
      const meal = await fetchRandomMeal(recipes)
      if (meal) {
        recordRecentRecipes([meal])
        navigate(`/recipe/${meal.id}`)
      }
    } finally {
      setPickingRandom(false)
    }
  }

  const availablePool = useMemo(
    () => [...manualIngredients, ...fridgeItems.map((f) => f.name)],
    [manualIngredients, fridgeItems],
  )

  return (
    <div className="space-y-8">
      {/* Offline fallback notice */}
      {isFallback && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-honey-500/30 bg-honey-50 px-4 py-3 text-sm text-honey-700"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="h-4 w-4 shrink-0 text-honey-600" />
            <span>
              <strong>Offline recipes:</strong> TheMealDB couldn&rsquo;t be reached, so you&rsquo;re browsing 20 built-in leftover-friendly recipes.
            </span>
          </div>
        </div>
      )}

      {/* Hero Search Section */}
      <section className="rounded-3xl border border-parchment bg-linear-to-br from-white via-cream to-sage-50/70 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-sage-800">
              <Sparkles className="h-3.5 w-3.5 text-sage-600" />
              Zero-waste kitchen finder
            </div>
            <h1 className="mt-3 font-display text-3xl leading-tight font-bold text-ink sm:text-4xl">
              What&rsquo;s waiting in your fridge?
            </h1>
            <p className="mt-2 text-sm text-ink-muted sm:text-base">
              Match leftover ingredients, search directly by dish name, or let PanSync pick a surprise recipe.
            </p>
          </div>

          <button
            type="button"
            disabled={pickingRandom}
            onClick={() => void handleSurpriseMe()}
            className="inline-flex items-center gap-2 rounded-2xl border border-parchment bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-2xs transition hover:border-sage-400 hover:bg-sage-50 disabled:opacity-60"
          >
            <Shuffle className="h-4 w-4 text-sage-700" />
            {pickingRandom ? 'Picking...' : 'Surprise me'}
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-parchment bg-white p-1">
            <button
              type="button"
              onClick={() => setSearchMode('ingredients')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                searchMode === 'ingredients'
                  ? 'bg-sage-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              By ingredients
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('dish')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                searchMode === 'dish'
                  ? 'bg-sage-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              By dish name
            </button>
          </div>

          {searchMode === 'ingredients' && (
            <button
              type="button"
              role="switch"
              aria-checked={fridgeMode}
              onClick={() => setFridgeMode(!fridgeMode)}
              className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                fridgeMode
                  ? 'border-sage-600 bg-sage-600 text-white shadow-xs'
                  : 'border-parchment bg-white text-ink hover:border-sage-300'
              }`}
            >
              <Refrigerator className="h-4 w-4" />
              <span>Use my fridge ({fridgeItems.length})</span>
              {fridgeMode && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                  Expiry boost on
                </span>
              )}
            </button>
          )}
        </div>

        {/* Input Panel */}
        <div className="mt-4 space-y-4">
          {searchMode === 'dish' ? (
            <form onSubmit={handleDishSubmit} className="space-y-2.5">
              <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-parchment bg-white px-3.5 py-2 shadow-xs focus-within:border-sage-500 focus-within:ring-4 focus-within:ring-sage-500/15">
                <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
                <input
                  type="text"
                  value={dishQuery}
                  onChange={(e) => setDishQuery(e.target.value)}
                  aria-label="Search meal by name"
                  placeholder="Search a dish name (e.g. Arrabiata, Fried Rice, Shakshuka)..."
                  className="flex-1 bg-transparent py-1 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
                />
                {dishQuery && (
                  <button
                    type="button"
                    aria-label="Clear dish search"
                    onClick={() => {
                      setDishQuery('')
                      setSubmittedDishQuery('')
                      setDishResults([])
                    }}
                    className="rounded-full p-1 text-ink-subtle hover:bg-cream hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sage-700"
                >
                  Search
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-ink-muted">Try:</span>
                {['Arrabiata', 'Fried Rice', 'Curry', 'Pasta', 'Soup'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setDishQuery(example)
                      void runDishSearch(example)
                    }}
                    className="rounded-full border border-parchment bg-white/80 px-2.5 py-1 font-medium text-ink-muted transition hover:border-sage-400 hover:bg-sage-50 hover:text-sage-800"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </form>
          ) : fridgeMode ? (
            <div className="rounded-2xl border border-sage-200 bg-white p-4">
              {fridgeItems.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-muted">
                    Your fridge tracker is empty right now. Add items with use-by dates or load a sample fridge!
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleTrySampleFridge}
                      className="rounded-xl bg-sage-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sage-700"
                    >
                      Try sample fridge
                    </button>
                    <Link
                      to="/fridge"
                      className="rounded-xl border border-parchment px-3.5 py-2 text-xs font-semibold text-ink hover:bg-cream"
                    >
                      Open Fridge →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
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
                      <span className="self-center text-xs text-ink-muted">
                        +{fridgeItems.length - 5} more
                      </span>
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
            />
          )}

          {excludedIngredients.length > 0 && searchMode === 'ingredients' && (
            <p className="text-xs font-medium text-tomato-700">
              Excluding: {excludedIngredients.join(', ')}
            </p>
          )}
        </div>
      </section>

      {/* Dish Name Search Results */}
      {searchMode === 'dish' ? (
        dishSearching ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
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
        ) : !submittedDishQuery ? (
          <section className="rounded-3xl border border-dashed border-parchment bg-white/70 px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Search any dish by name
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Queries TheMealDB via <code className="rounded bg-cream-dark px-1.5 py-0.5 text-xs">/api/mealsdb?endpoint=search&amp;s=...</code> and compares ingredients against your fridge.
            </p>
          </section>
        ) : dishResults.length === 0 ? (
          <section className="rounded-3xl border border-parchment bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-600">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold text-ink">
              No meals found for &ldquo;{submittedDishQuery}&rdquo;
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Try a shorter or broader keyword like &ldquo;Arrabiata&rdquo;, &ldquo;Chicken&rdquo;, or &ldquo;Soup&rdquo;.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-ink">
              {dishResults.length} result{dishResults.length === 1 ? '' : 's'} for &ldquo;
              {submittedDishQuery}&rdquo;
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dishResults.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  match={
                    availablePool.length > 0
                      ? evaluateRecipe(recipe, availablePool, {
                          staples,
                          fridgeMode: true,
                          fridgeItems,
                        })
                      : undefined
                  }
                  onPlanClick={setPlanningRecipe}
                />
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {/* Filter bar when active ingredients exist */}
          {activeIngredients.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {loading ? 'Searching recipes…' : `${matches.length} matching recipes`}
                </h2>
              </div>

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
                      onClick={() => setMaxMissing(opt.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-700"
                >
                  <Sparkles className="h-4 w-4" />
                  Try sample fridge
                </button>
                <button
                  type="button"
                  onClick={() => addIngredients('rice, egg, onion')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-parchment bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50"
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
                {maxMissing !== null
                  ? 'Try relaxing the "Missing at most N" filter so recipes needing a couple extra items can appear.'
                  : 'Try adding another staple leftover like eggs, rice, onion, garlic, or potatoes.'}
              </p>
              {maxMissing !== null && (
                <button
                  type="button"
                  onClick={() => setMaxMissing(null)}
                  className="mt-4 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sage-700"
                >
                  Show all matching recipes
                </button>
              )}
            </section>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {matches.slice(0, 48).map((match) => (
                <RecipeCard
                  key={match.recipe.id}
                  recipe={match.recipe}
                  match={match}
                  onPlanClick={setPlanningRecipe}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AddToPlanModal
        recipe={planningRecipe}
        onClose={() => setPlanningRecipe(null)}
      />
    </div>
  )
}
