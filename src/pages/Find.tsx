import {
  ChefHat,
  Flame,
  Loader2,
  Refrigerator,
  RefreshCw,
  Search,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { ApiHealthStatus } from '../components/ApiHealthStatus'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { IngredientInput } from '../components/IngredientInput'
import {
  DishNoResultsCard,
  IngredientNoResultsCard,
  PriorityOnlyNoResultsCard,
} from '../components/NoResultsRecovery'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeComments } from '../components/RecipeComments'
import { filterLocalRecipesByDish, searchMealsByName } from '../data/mealdb'
import { useRecipes } from '../hooks/useRecipes'
import { formatSlotLabel, sortFridgeItemsByExpiry } from '../lib/dates'
import { evaluateRecipe, ingredientMatches, matchRecipes } from '../lib/matching'
import { MEAL_PRIORITIES, recipeMatchesPriorities } from '../lib/priorities'
import {
  diagnoseDishNoMatch,
  diagnoseIngredientNoMatch,
  diagnosePriorityOnlyNoMatch,
} from '../lib/recovery'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'
import type { Recipe } from '../types'

const QUICK_DISH_SUGGESTIONS = [
  'Arrabiata',
  'Fried Rice',
  'Curry',
  'Carbonara',
  'Shakshuka',
  'Pad Thai',
]

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
  const removeExcluded = useSettings((s) => s.removeExcluded)
  const selectedPriorities = useSettings((s) => s.dietaryPreferences ?? [])
  const togglePriority = useSettings((s) => s.toggleDietaryPreference)
  const clearPriorities = useSettings((s) => s.clearDietaryPreferences)
  const recordRecentRecipes = usePlan((s) => s.recordRecentRecipes)

  const {
    searchMode,
    dishQuery,
    manualIngredients,
    fridgeMode,
    maxMissing,
    setSearchMode,
    setDishQuery,
    clearDishQuery,
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
  const [dishSearchResult, setDishSearchResult] = useState<{
    query: string
    recipes: Recipe[]
    fromNetwork: boolean
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dishInputRef = useRef<HTMLInputElement>(null)
  const dishRequestIdRef = useRef(0)

  const trimmedDishQuery = dishQuery.trim()

  // Global "/" keyboard shortcut to jump straight to the active search input
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
      if (searchMode === 'dish') {
        e.preventDefault()
        dishInputRef.current?.focus()
        return
      }
      if (fridgeMode) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fridgeMode, searchMode])

  const hasFreshDishResult =
    Boolean(trimmedDishQuery) && dishSearchResult?.query === trimmedDishQuery

  // Debounced live dish search when typing in "By dish name" mode
  useEffect(() => {
    if (searchMode !== 'dish' || trimmedDishQuery.length < 2 || hasFreshDishResult) return
    let cancelled = false
    const timer = setTimeout(() => {
      const reqId = ++dishRequestIdRef.current
      void searchMealsByName(trimmedDishQuery, recipes).then((res) => {
        if (!cancelled && dishRequestIdRef.current === reqId) {
          setDishSearchResult({
            query: trimmedDishQuery,
            recipes: res.recipes,
            fromNetwork: res.fromNetwork,
          })
        }
      })
    }, 260)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchMode, trimmedDishQuery, hasFreshDishResult, recipes])

  const triggerImmediateDishSearch = (rawQuery: string) => {
    const trimmed = rawQuery.trim()
    setDishQuery(rawQuery)
    if (!trimmed) {
      setDishSearchResult(null)
      return
    }
    const reqId = ++dishRequestIdRef.current
    void searchMealsByName(trimmed, recipes).then((res) => {
      if (dishRequestIdRef.current === reqId) {
        setDishSearchResult({
          query: trimmed,
          recipes: res.recipes,
          fromNetwork: res.fromNetwork,
        })
      }
    })
  }

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

  const matches = useMemo(() => {
    const priorityFiltered =
      selectedPriorities.length > 0
        ? rawMatches.filter((m) => recipeMatchesPriorities(m.recipe, selectedPriorities))
        : rawMatches

    if (sortMode === 'best') return priorityFiltered
    return [...priorityFiltered].sort((a, b) => {
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
  }, [rawMatches, selectedPriorities, sortMode])

  // When no ingredients are entered yet, allow browsing recipes directly by meal priority
  const priorityOnlyRecipes = useMemo(() => {
    if (activeIngredients.length > 0 || selectedPriorities.length === 0) return []
    return recipes
      .filter((recipe) => {
        if (
          excludedIngredients.length > 0 &&
          recipe.ingredients.some((ing) =>
            excludedIngredients.some((ex) => ingredientMatches(ex, ing.name)),
          )
        ) {
          return false
        }
        return recipeMatchesPriorities(recipe, selectedPriorities)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [activeIngredients.length, selectedPriorities, recipes, excludedIngredients])

  const instantLocalDishMatches = useMemo(
    () =>
      searchMode === 'dish' && trimmedDishQuery
        ? filterLocalRecipesByDish(trimmedDishQuery, recipes)
        : [],
    [searchMode, trimmedDishQuery, recipes],
  )

  const dishSearching =
    searchMode === 'dish' && trimmedDishQuery.length >= 2 && !hasFreshDishResult

  const rawDishMatches = useMemo(() => {
    if (searchMode !== 'dish' || !trimmedDishQuery) return []
    return hasFreshDishResult && dishSearchResult
      ? dishSearchResult.recipes
      : instantLocalDishMatches
  }, [
    searchMode,
    trimmedDishQuery,
    hasFreshDishResult,
    dishSearchResult,
    instantLocalDishMatches,
  ])

  const dishMatchesAfterExclusions = useMemo(() => {
    if (excludedIngredients.length === 0) return rawDishMatches
    return rawDishMatches.filter(
      (recipe) =>
        !recipe.ingredients.some((ing) =>
          excludedIngredients.some((ex) => ingredientMatches(ex, ing.name)),
        ),
    )
  }, [rawDishMatches, excludedIngredients])

  const dishMatches = useMemo(() => {
    if (selectedPriorities.length === 0) return dishMatchesAfterExclusions
    return dishMatchesAfterExclusions.filter((recipe) =>
      recipeMatchesPriorities(recipe, selectedPriorities),
    )
  }, [dishMatchesAfterExclusions, selectedPriorities])

  const combinedUserIngredients = useMemo(
    () => [...manualIngredients, ...fridgeItems.map((f) => f.name)],
    [manualIngredients, fridgeItems],
  )

  const dishEvaluationsById = useMemo(() => {
    if (searchMode !== 'dish' || combinedUserIngredients.length === 0) {
      return new Map<string, ReturnType<typeof evaluateRecipe>>()
    }
    const map = new Map<string, ReturnType<typeof evaluateRecipe>>()
    for (const recipe of dishMatches) {
      map.set(
        recipe.id,
        evaluateRecipe(recipe, combinedUserIngredients, {
          staples,
          fridgeMode: fridgeItems.length > 0,
          fridgeItems,
        }),
      )
    }
    return map
  }, [searchMode, dishMatches, combinedUserIngredients, staples, fridgeItems])

  const queryKey = useMemo(
    () =>
      searchMode === 'dish'
        ? `dish:${trimmedDishQuery.toLowerCase()}:${selectedPriorities.join(',')}:${excludedIngredients.join('|')}`
        : `${fridgeMode ? 'fridge' : 'manual'}:${maxMissing ?? 'all'}:${sortMode}:${selectedPriorities.join(',')}:${activeIngredients.join('|')}`,
    [
      searchMode,
      trimmedDishQuery,
      excludedIngredients,
      fridgeMode,
      maxMissing,
      sortMode,
      selectedPriorities,
      activeIngredients,
    ],
  )
  const visibleCount = pagination.key === queryKey ? pagination.count : PAGE_STEP

  // Record top matched recipes in recent results for Recipe detail lookup & Plan drag sidebar
  useEffect(() => {
    if (searchMode === 'dish') {
      if (dishMatches.length > 0) {
        recordRecentRecipes(dishMatches.slice(0, 12))
      }
      return
    }
    if (matches.length > 0) {
      recordRecentRecipes(matches.slice(0, 8).map((m) => m.recipe))
    } else if (priorityOnlyRecipes.length > 0) {
      recordRecentRecipes(priorityOnlyRecipes.slice(0, 8))
    }
  }, [searchMode, dishMatches, matches, priorityOnlyRecipes, recordRecentRecipes])

  const sortedFridgePreview = useMemo(
    () => sortFridgeItemsByExpiry(fridgeItems).slice(0, 5),
    [fridgeItems],
  )

  const handleTrySampleFridge = () => {
    loadSampleFridge()
    setSearchMode('ingredients')
    setFridgeMode(true)
    setMaxMissing(null)
  }

  const displayedMatches = matches.slice(0, visibleCount)
  const displayedPriorityRecipes = priorityOnlyRecipes.slice(0, visibleCount)
  const displayedDishMatches = dishMatches.slice(0, visibleCount)
  const activePriorityLabels = useMemo(
    () =>
      MEAL_PRIORITIES.filter((p) => selectedPriorities.includes(p.id)).map((p) => p.label),
    [selectedPriorities],
  )

  const ingredientNoMatchDiagnosis = useMemo(() => {
    if (
      searchMode !== 'ingredients' ||
      loading ||
      activeIngredients.length === 0 ||
      matches.length > 0
    ) {
      return null
    }
    return diagnoseIngredientNoMatch({
      recipes,
      ingredientSuggestions,
      activeIngredients,
      staples,
      fridgeMode,
      fridgeItems,
      maxMissing,
      excludedIngredients,
      selectedPriorities,
    })
  }, [
    searchMode,
    loading,
    activeIngredients,
    matches.length,
    recipes,
    ingredientSuggestions,
    staples,
    fridgeMode,
    fridgeItems,
    maxMissing,
    excludedIngredients,
    selectedPriorities,
  ])

  const priorityOnlyNoMatchDiagnosis = useMemo(() => {
    if (
      searchMode !== 'ingredients' ||
      loading ||
      activeIngredients.length > 0 ||
      selectedPriorities.length === 0 ||
      priorityOnlyRecipes.length > 0
    ) {
      return null
    }
    return diagnosePriorityOnlyNoMatch(recipes, selectedPriorities, excludedIngredients)
  }, [
    searchMode,
    loading,
    activeIngredients.length,
    selectedPriorities,
    priorityOnlyRecipes.length,
    recipes,
    excludedIngredients,
  ])

  const dishNoMatchDiagnosis = useMemo(() => {
    if (
      searchMode !== 'dish' ||
      !trimmedDishQuery ||
      dishSearching ||
      dishMatches.length > 0
    ) {
      return null
    }
    return diagnoseDishNoMatch({
      query: trimmedDishQuery,
      rawDishMatches,
      dishMatchesAfterExclusions,
      recipes,
      staples,
      selectedPriorities,
      excludedIngredients,
    })
  }, [
    searchMode,
    trimmedDishQuery,
    dishSearching,
    dishMatches.length,
    rawDishMatches,
    dishMatchesAfterExclusions,
    recipes,
    staples,
    selectedPriorities,
    excludedIngredients,
  ])

  const handleAddRecoveryIngredient = (ingredientName: string) => {
    if (fridgeMode) {
      const seeded = [...fridgeItems.map((f) => f.name), ingredientName].join(', ')
      setFridgeMode(false)
      clearIngredients()
      addIngredients(seeded)
      return
    }
    addIngredients(ingredientName)
  }

  const handleReplaceRecoveryIngredient = (oldName: string, newName: string) => {
    removeIngredient(oldName)
    addIngredients(newName)
  }

  const handleSwitchToDishSearch = (dish: string) => {
    setSearchMode('dish')
    triggerImmediateDishSearch(dish)
  }

  const handleSwitchToIngredientSearch = (raw: string) => {
    setFridgeMode(false)
    clearIngredients()
    addIngredients(raw)
    setSearchMode('ingredients')
  }

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
      <section className="rounded-3xl border border-parchment bg-linear-to-br from-white via-cream to-sage-100/75 p-6 shadow-xs sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-wide text-sage-700 uppercase">
            Zero-waste kitchen finder
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-bold text-ink sm:text-4xl">
            {searchMode === 'dish'
              ? 'What dish do you want to make?'
              : 'What\u2019s waiting in your fridge?'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted sm:text-base">
            {searchMode === 'dish' ? (
              <>
                Type the name of any dish to pull up recipes, nutrition badges, and what you&rsquo;re missing from your fridge.
              </>
            ) : (
              <>
                Enter leftover ingredients — or flip on <strong>Use my fridge</strong> to rank recipes that rescue expiring food first.
              </>
            )}
          </p>
        </div>

        {/* Mode Switcher + Toggle + Input */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="group"
                aria-label="Search mode"
                className="inline-flex rounded-2xl border border-parchment bg-white/90 p-1 shadow-2xs"
              >
                <button
                  type="button"
                  aria-pressed={searchMode === 'ingredients'}
                  onClick={() => setSearchMode('ingredients')}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    searchMode === 'ingredients'
                      ? 'bg-sage-600 text-white shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Refrigerator className="h-3.5 w-3.5" />
                  By ingredients
                </button>
                <button
                  type="button"
                  aria-pressed={searchMode === 'dish'}
                  onClick={() => setSearchMode('dish')}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    searchMode === 'dish'
                      ? 'bg-sage-600 text-white shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  By dish name
                </button>
              </div>

              {searchMode === 'ingredients' && (
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
              )}
            </div>

            {(excludedIngredients.length > 0 || activePriorityLabels.length > 0) && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                {activePriorityLabels.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sage-700">
                    <span>Dietary: {activePriorityLabels.join(', ')}</span>
                    <button
                      type="button"
                      onClick={clearPriorities}
                      className="font-semibold underline hover:text-sage-800"
                    >
                      Clear
                    </button>
                  </span>
                )}
                {excludedIngredients.length > 0 && (
                  <span className="text-tomato-700">
                    Excluding: {excludedIngredients.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {searchMode === 'dish' ? (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  triggerImmediateDishSearch(dishQuery)
                }}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-parchment bg-white px-3.5 py-2 shadow-xs transition focus-within:border-sage-500 focus-within:ring-2 focus-within:ring-sage-200"
              >
                <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <input
                  ref={dishInputRef}
                  type="text"
                  value={dishQuery}
                  onChange={(e) => setDishQuery(e.target.value)}
                  placeholder="Type a dish to make (e.g. Arrabiata, Fried Rice, Curry)…"
                  aria-label="Search dish by name"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-10 min-w-44 flex-1 bg-transparent text-base text-ink placeholder:text-ink-subtle focus:outline-none sm:text-sm"
                />
                {dishQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      clearDishQuery()
                      setDishSearchResult(null)
                      dishInputRef.current?.focus()
                    }}
                    aria-label="Clear dish search"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-subtle transition hover:bg-cream hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
                >
                  {dishSearching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Search
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-ink-subtle">Try dish:</span>
                {QUICK_DISH_SUGGESTIONS.map((dish) => {
                  const isActive = trimmedDishQuery.toLowerCase() === dish.toLowerCase()
                  return (
                    <button
                      key={dish}
                      type="button"
                      onClick={() => triggerImmediateDishSearch(dish)}
                      className={`min-h-8 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        isActive
                          ? 'border-sage-500 bg-sage-600 text-white'
                          : 'border-parchment bg-white text-ink-muted hover:border-sage-300 hover:bg-sage-50 hover:text-sage-800'
                      }`}
                    >
                      {dish}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : fridgeMode ? (
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

      {/* Filter & Sort bar when active ingredients exist (ingredients mode only) */}
      {searchMode === 'ingredients' && activeIngredients.length > 0 && (
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
      {searchMode === 'dish' ? (
        !trimmedDishQuery ? (
          <section className="rounded-3xl border border-dashed border-parchment bg-white/70 px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
              Craving a specific dish tonight?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Enter any dish name above to search live recipes with ingredients, Nutri-Score estimates, and step-by-step instructions.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {['Arrabiata', 'Fried Rice', 'Curry'].map((dish) => (
                <button
                  key={dish}
                  type="button"
                  onClick={() => triggerImmediateDishSearch(dish)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-parchment bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50"
                >
                  Try &ldquo;{dish}&rdquo;
                </button>
              ))}
            </div>
          </section>
        ) : dishSearching && dishMatches.length === 0 ? (
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
        ) : dishMatches.length === 0 && dishNoMatchDiagnosis ? (
          <DishNoResultsCard
            query={trimmedDishQuery}
            diagnosis={dishNoMatchDiagnosis}
            onSelectDishSuggestion={triggerImmediateDishSearch}
            onSwitchToIngredientSearch={handleSwitchToIngredientSearch}
            onTogglePriority={togglePriority}
            onClearPriorities={clearPriorities}
            onRemoveExclusion={removeExcluded}
            onClearDishSearch={() => {
              clearDishQuery()
              setDishSearchResult(null)
              dishInputRef.current?.focus()
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
                  {dishMatches.length} {dishMatches.length === 1 ? 'recipe' : 'recipes'} for &ldquo;{trimmedDishQuery}&rdquo;
                </h2>
                {dishSearching && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-600" />
                    Checking live recipes…
                  </span>
                )}
              </div>
              {dishMatches.length > displayedDishMatches.length && (
                <span className="text-xs text-ink-muted tabular-nums">
                  Showing {displayedDishMatches.length} of {dishMatches.length}
                </span>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayedDishMatches.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  match={dishEvaluationsById.get(recipe.id)}
                  onPlanClick={setPlanningRecipe}
                />
              ))}
            </div>

            {dishMatches.length > displayedDishMatches.length && (
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
                  Show more recipes ({dishMatches.length - displayedDishMatches.length} remaining)
                </button>
              </div>
            )}
          </div>
        )
      ) : loading ? (
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
      ) : activeIngredients.length === 0 && selectedPriorities.length === 0 ? (
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
      ) : activeIngredients.length === 0 && selectedPriorities.length > 0 ? (
        priorityOnlyRecipes.length === 0 && priorityOnlyNoMatchDiagnosis ? (
          <PriorityOnlyNoResultsCard
            diagnosis={priorityOnlyNoMatchDiagnosis}
            onTogglePriority={togglePriority}
            onClearPriorities={clearPriorities}
            onRemoveExclusion={removeExcluded}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
                {priorityOnlyRecipes.length} {activePriorityLabels.join(' · ')} recipes
              </h2>
              {priorityOnlyRecipes.length > displayedPriorityRecipes.length && (
                <span className="text-xs text-ink-muted tabular-nums">
                  Showing {displayedPriorityRecipes.length} of {priorityOnlyRecipes.length}
                </span>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayedPriorityRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPlanClick={setPlanningRecipe}
                />
              ))}
            </div>

            {priorityOnlyRecipes.length > displayedPriorityRecipes.length && (
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
                  Show more recipes ({priorityOnlyRecipes.length - displayedPriorityRecipes.length} remaining)
                </button>
              </div>
            )}
          </div>
        )
      ) : matches.length === 0 && ingredientNoMatchDiagnosis ? (
        <IngredientNoResultsCard
          diagnosis={ingredientNoMatchDiagnosis}
          fridgeMode={fridgeMode}
          hasManualIngredients={manualIngredients.length > 0}
          onAddIngredient={handleAddRecoveryIngredient}
          onReplaceIngredient={handleReplaceRecoveryIngredient}
          onRelaxMaxMissing={setMaxMissing}
          onTogglePriority={togglePriority}
          onClearPriorities={clearPriorities}
          onRemoveExclusion={removeExcluded}
          onSwitchToDishSearch={handleSwitchToDishSearch}
          onClearIngredients={clearIngredients}
        />
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

      <RecipeComments
        id="pansync-home"
        title="PanSync — Community Discussion"
        url={
          typeof window !== 'undefined'
            ? `${window.location.origin}/`
            : 'https://pansync.vercel.app/'
        }
        heading="Community Discussion"
      />

      <ApiHealthStatus />

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
