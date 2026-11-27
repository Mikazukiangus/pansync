import { Heart, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { RecipeCard } from '../components/RecipeCard'
import { useRecipes } from '../hooks/useRecipes'
import { evaluateRecipe } from '../lib/matching'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'
import type { Recipe } from '../types'

export function Favourites() {
  const { recipesById } = useRecipes()
  const favIds = useFavourites((s) => s.ids)
  const savedRecipes = useFavourites((s) => s.recipesById)
  const lastRemoved = useFavourites((s) => s.lastRemoved)
  const undoRemoveFavourite = useFavourites((s) => s.undoRemoveFavourite)
  const dismissLastRemoved = useFavourites((s) => s.dismissLastRemoved)
  const fridgeItems = useFridge((s) => s.items)
  const manualIngredients = useSearch((s) => s.manualIngredients)
  const staples = useSettings((s) => s.staples)

  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null)
  const [query, setQuery] = useState('')
  const [clearedQueryUndo, setClearedQueryUndo] = useState<string | null>(null)

  useEffect(() => {
    if (!lastRemoved) return
    const timer = setTimeout(() => dismissLastRemoved(), 6000)
    return () => clearTimeout(timer)
  }, [lastRemoved, dismissLastRemoved])

  useEffect(() => {
    if (!clearedQueryUndo) return
    const timer = setTimeout(() => setClearedQueryUndo(null), 5000)
    return () => clearTimeout(timer)
  }, [clearedQueryUndo])

  const favouriteRecipes = useMemo(() => {
    return favIds
      .map((id) => recipesById.get(id) ?? savedRecipes[id])
      .filter((r): r is Recipe => Boolean(r))
  }, [favIds, recipesById, savedRecipes])

  const filteredFavourites = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return favouriteRecipes
    return favouriteRecipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q),
    )
  }, [favouriteRecipes, query])

  const availablePool = useMemo(
    () => [...manualIngredients, ...fridgeItems.map((i) => i.name)],
    [manualIngredients, fridgeItems],
  )

  const handleClearQuery = () => {
    if (!query) return
    setClearedQueryUndo(query)
    setQuery('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Saved Favourites</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Your go-to leftover rescues — ready to drop into any week&rsquo;s meal plan.
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-muted tabular-nums">
          {favouriteRecipes.length} saved
        </span>
      </div>

      {lastRemoved && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800"
        >
          <span>
            Removed <strong>&ldquo;{lastRemoved.recipe.name}&rdquo;</strong> from Favourites.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undoRemoveFavourite}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-sage-800 ring-1 ring-sage-200 transition hover:bg-sage-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={dismissLastRemoved}
              aria-label="Dismiss undo notice"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-white hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {favouriteRecipes.length > 3 && (
        <div className="space-y-2">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-ink-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (clearedQueryUndo) setClearedQueryUndo(null)
              }}
              aria-label="Filter saved favourites"
              placeholder="Filter favourites by name or cuisine..."
              className="w-full rounded-2xl border border-parchment bg-white py-2.5 pr-9 pl-10 text-sm text-ink placeholder:text-ink-subtle focus:border-sage-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearQuery}
                aria-label="Clear filter"
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle hover:bg-cream hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {clearedQueryUndo && !query && (
            <div
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-xl border border-parchment bg-white px-3 py-1.5 text-xs text-ink-muted"
            >
              <span>Cleared filter &ldquo;{clearedQueryUndo}&rdquo;.</span>
              <button
                type="button"
                onClick={() => {
                  setQuery(clearedQueryUndo)
                  setClearedQueryUndo(null)
                }}
                className="inline-flex items-center gap-1 font-semibold text-sage-700 hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Undo
              </button>
            </div>
          )}
        </div>
      )}

      {favouriteRecipes.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-parchment bg-white/75 px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-500">
            <Heart className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
            No favourites saved yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Tap the heart on any recipe card to keep your best crowd-pleasers handy for weekly planning.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            <Search className="h-4 w-4" />
            Find recipes
          </Link>
        </section>
      ) : filteredFavourites.length === 0 ? (
        <section className="rounded-3xl border border-parchment bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink-muted">
            No saved recipes match &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={handleClearQuery}
            className="mt-3 min-h-9 rounded-xl bg-sage-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sage-700"
          >
            Show all favourites
          </button>
        </section>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFavourites.map((recipe) => {
            const match =
              availablePool.length > 0
                ? evaluateRecipe(recipe, availablePool, {
                    staples,
                    fridgeMode: true,
                    fridgeItems,
                  })
                : undefined

            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                match={match}
                onPlanClick={setPlanningRecipe}
              />
            )
          })}
        </div>
      )}

      <AddToPlanModal
        recipe={planningRecipe}
        onClose={() => setPlanningRecipe(null)}
      />
    </div>
  )
}
