import { Heart, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  const fridgeItems = useFridge((s) => s.items)
  const manualIngredients = useSearch((s) => s.manualIngredients)
  const staples = useSettings((s) => s.staples)

  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null)

  const favouriteRecipes = useMemo(() => {
    return favIds
      .map((id) => recipesById.get(id) ?? savedRecipes[id])
      .filter((r): r is Recipe => Boolean(r))
  }, [favIds, recipesById, savedRecipes])

  const availablePool = useMemo(
    () => [...manualIngredients, ...fridgeItems.map((i) => i.name)],
    [manualIngredients, fridgeItems],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Saved Favourites</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Your go-to leftover rescues — ready to drop into any week&rsquo;s meal plan.
          </p>
        </div>
        <span className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-muted ring-1 ring-parchment">
          {favouriteRecipes.length} saved
        </span>
      </div>

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
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            <Search className="h-4 w-4" />
            Find recipes
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favouriteRecipes.map((recipe) => {
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
