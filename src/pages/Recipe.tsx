import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  Check,
  CheckCircle2,
  ExternalLink,
  Heart,
  Minus,
  PlayCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { useRecipes } from '../hooks/useRecipes'
import { evaluateRecipe } from '../lib/matching'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'

function scaleMeasure(measure: string, multiplier: number): string {
  if (multiplier === 1 || !measure.trim()) return measure
  return measure.replace(/\b(\d+(?:\.\d+)?)\b/g, (rawNum) => {
    const scaled = Math.round(Number(rawNum) * multiplier * 100) / 100
    return String(scaled)
  })
}

export function RecipePage() {
  const { id = '' } = useParams<{ id: string }>()
  const { recipesById, loading } = useRecipes()
  const savedFavMap = useFavourites((s) => s.recipesById)
  const isFav = useFavourites((s) => s.ids.includes(id))
  const toggleFavourite = useFavourites((s) => s.toggleFavourite)
  const planSlots = usePlan((s) => s.slots)
  const recordRecentRecipes = usePlan((s) => s.recordRecentRecipes)

  const fridgeItems = useFridge((s) => s.items)
  const addFridgeItem = useFridge((s) => s.addItem)
  const manualIngredients = useSearch((s) => s.manualIngredients)
  const staples = useSettings((s) => s.staples)

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({})
  const [portionScale, setPortionScale] = useState<number>(1)

  const recipe = useMemo(() => {
    const fromDataset = recipesById.get(id)
    if (fromDataset) return fromDataset
    if (savedFavMap[id]) return savedFavMap[id]
    for (const slotRecipe of Object.values(planSlots)) {
      if (slotRecipe && slotRecipe.id === id) return slotRecipe
    }
    return undefined
  }, [id, recipesById, savedFavMap, planSlots])

  useEffect(() => {
    if (recipe) {
      recordRecentRecipes([recipe])
    }
  }, [recipe, recordRecentRecipes])

  const combinedAvailable = useMemo(
    () => [...manualIngredients, ...fridgeItems.map((f) => f.name)],
    [manualIngredients, fridgeItems],
  )

  const evaluation = useMemo(() => {
    if (!recipe) return null
    return evaluateRecipe(recipe, combinedAvailable, {
      staples,
      fridgeMode: true,
      fridgeItems,
    })
  }, [recipe, combinedAvailable, staples, fridgeItems])

  if (loading && !recipe) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="h-8 w-32 rounded-xl bg-cream-dark" />
        <div className="h-72 rounded-3xl bg-cream-dark" />
        <div className="h-64 rounded-3xl bg-cream-dark" />
      </div>
    )
  }

  if (!recipe || !evaluation) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-parchment bg-white p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Recipe not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          We couldn&rsquo;t locate that recipe. Try searching from the Find page.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Find
        </Link>
      </div>
    )
  }

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Top navigation & actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-sage-300 hover:bg-sage-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to recipes
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFavourite(recipe)}
            aria-pressed={isFav}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              isFav
                ? 'border-tomato-500 bg-tomato-500 text-white'
                : 'border-parchment bg-white text-ink hover:border-tomato-200 hover:text-tomato-600'
            }`}
          >
            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
            {isFav ? 'Saved to Favourites' : 'Favourite'}
          </button>

          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to plan
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="overflow-hidden rounded-3xl border border-parchment bg-white shadow-xs">
        <div className="grid md:grid-cols-5">
          <div className="relative min-h-60 md:col-span-2">
            {recipe.image ? (
              <img
                src={recipe.image}
                alt={recipe.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={`flex h-full min-h-60 flex-col items-center justify-center bg-linear-to-br ${
                  recipe.gradient ?? 'from-sage-100 via-cream to-honey-100'
                } p-6`}
              >
                <span className="text-7xl">{recipe.emoji ?? '🍲'}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cream-dark px-3 py-1 text-xs font-semibold text-ink-muted">
                  {recipe.area}
                </span>
                <span className="rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-800">
                  {recipe.category}
                </span>
                {recipe.prepMinutes && (
                  <span className="rounded-full bg-honey-50 px-3 py-1 text-xs font-semibold text-honey-700">
                    ~{recipe.prepMinutes} mins
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl leading-tight font-bold text-ink sm:text-3xl">
                {recipe.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 font-semibold text-sage-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sage-700" />
                  Have {evaluation.haveIngredients.length}
                </span>
                {evaluation.stapleIngredients.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-medium text-ink-muted ring-1 ring-parchment">
                    <Sparkles className="h-3.5 w-3.5 text-sage-600" />
                    {evaluation.stapleIngredients.length} pantry staples
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
                    evaluation.missingCount === 0
                      ? 'bg-sage-600 text-white'
                      : 'bg-tomato-50 text-tomato-700 ring-1 ring-tomato-200'
                  }`}
                >
                  {evaluation.missingCount === 0
                    ? 'Ready to cook — 0 missing!'
                    : `Missing ${evaluation.missingCount}`}
                </span>
              </div>
            </div>

            {recipe.youtube && (
              <div className="mt-6 pt-4 border-t border-parchment/70">
                <a
                  href={recipe.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-tomato-50 px-4 py-2 text-xs font-semibold text-tomato-700 ring-1 ring-tomato-200 transition hover:bg-tomato-100"
                >
                  <PlayCircle className="h-4 w-4 text-tomato-600" />
                  Watch video tutorial on YouTube
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Content: Ingredients & Instructions */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Ingredients Checklist */}
        <section className="rounded-3xl border border-parchment bg-white p-6 shadow-xs lg:col-span-5 h-fit">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-ink">
              Ingredients ({recipe.ingredients.length})
            </h2>

            {/* Portion scaler */}
            <div className="inline-flex items-center gap-1 rounded-full border border-parchment bg-cream px-2 py-1 text-xs">
              <button
                type="button"
                aria-label="Decrease portion multiplier"
                onClick={() => setPortionScale((s) => Math.max(0.5, s - 0.5))}
                className="rounded-full p-0.5 text-ink-muted hover:bg-white hover:text-ink"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-9 text-center font-semibold text-ink">
                {portionScale}×
              </span>
              <button
                type="button"
                aria-label="Increase portion multiplier"
                onClick={() => setPortionScale((s) => Math.min(4, s + 0.5))}
                className="rounded-full p-0.5 text-ink-muted hover:bg-white hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-parchment/60">
            {evaluation.details.map(({ ingredient, status, matchedUserItem }) => {
              const scaled = scaleMeasure(ingredient.measure, portionScale)
              return (
                <li
                  key={`${ingredient.name}-${ingredient.measure}`}
                  data-ingredient-status={status}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    {status === 'have' && (
                      <span
                        title={`Matched: ${matchedUserItem ?? ingredient.name}`}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    {status === 'staple' && (
                      <span
                        title="Pantry staple"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-700"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    {status === 'missing' && (
                      <span
                        title="Missing ingredient"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tomato-100 text-tomato-600"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    )}

                    <div>
                      <p
                        className={`text-sm font-medium ${
                          status === 'missing' ? 'text-ink' : 'text-ink'
                        }`}
                      >
                        {ingredient.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {status === 'have' && (
                          <span className="font-semibold text-sage-700">Have</span>
                        )}
                        {status === 'staple' && (
                          <span className="font-medium text-ink-muted">Staple</span>
                        )}
                        {status === 'missing' && (
                          <>
                            <span className="font-semibold text-tomato-600">Missing</span>
                            <button
                              type="button"
                              onClick={() =>
                                addFridgeItem({
                                  name: ingredient.name,
                                  quantity: ingredient.measure || '1',
                                  useBy: '',
                                })
                              }
                              className="text-ink-muted underline hover:text-sage-700"
                            >
                              I have this
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {scaled && (
                    <span className="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-xs font-semibold text-ink-muted">
                      {scaled}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Step-by-step Instructions */}
        <section className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">
              Method ({recipe.instructions.length} steps)
            </h2>
            <span className="text-xs text-ink-muted">Tap a step to cross it off</span>
          </div>

          <ol className="mt-5 space-y-4">
            {recipe.instructions.map((step, index) => {
              const done = Boolean(completedSteps[index])
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${
                      done
                        ? 'border-sage-200 bg-sage-50/60 text-ink-muted'
                        : 'border-parchment/80 bg-cream/40 text-ink hover:border-sage-300 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? 'bg-sage-600 text-white'
                          : 'bg-sage-100 text-sage-800'
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span
                      className={`text-sm leading-relaxed ${
                        done ? 'line-through opacity-75' : ''
                      }`}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <AddToPlanModal
        recipe={showPlanModal ? recipe : null}
        onClose={() => setShowPlanModal(false)}
      />
    </div>
  )
}
