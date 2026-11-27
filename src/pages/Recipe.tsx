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
  RotateCcw,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AddToPlanModal } from '../components/AddToPlanModal'
import { RecipeImage } from '../components/RecipeImage'
import { useRecipes } from '../hooks/useRecipes'
import { formatSlotLabel } from '../lib/dates'
import { evaluateRecipe, ingredientMatches, normalize } from '../lib/matching'
import { useFavourites } from '../store/useFavourites'
import { useFridge } from '../store/useFridge'
import { usePlan } from '../store/usePlan'
import { useSearch } from '../store/useSearch'
import { useSettings } from '../store/useSettings'
import type { FridgeItem, RecipeIngredient } from '../types'

const BASE_PAX = 2
const MIN_PAX = 1
const MAX_PAX = 12
const PAX_PRESETS = [1, 2, 4, 6]

function formatScaledNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

function scaleMeasure(measure: string, multiplier: number): string {
  if (multiplier === 1 || !measure.trim()) return measure
  return measure.replace(
    /\b(\d+)\s+(\d+)\/(\d+)\b|\b(\d+)\/(\d+)\b|\b(\d+(?:\.\d+)?)\b/g,
    (match, whole, fracNum, fracDen, simpleNum, simpleDen, rawNum) => {
      if (whole !== undefined && fracNum !== undefined && fracDen !== undefined) {
        const den = Number(fracDen)
        if (!den) return match
        const val = Number(whole) + Number(fracNum) / den
        return formatScaledNumber(val * multiplier)
      }
      if (simpleNum !== undefined && simpleDen !== undefined) {
        const den = Number(simpleDen)
        if (!den) return match
        const val = Number(simpleNum) / den
        return formatScaledNumber(val * multiplier)
      }
      if (rawNum !== undefined) {
        return formatScaledNumber(Number(rawNum) * multiplier)
      }
      return match
    },
  )
}

export function RecipePage() {
  const { id = '' } = useParams<{ id: string }>()
  return <RecipePageContent key={id} id={id} />
}

function RecipePageContent({ id }: { id: string }) {
  const navigate = useNavigate()
  const { recipesById, loading } = useRecipes()
  const savedFavMap = useFavourites((s) => s.recipesById)
  const isFav = useFavourites((s) => s.ids.includes(id))
  const toggleFavourite = useFavourites((s) => s.toggleFavourite)
  const planSlots = usePlan((s) => s.slots)
  const recordRecentRecipes = usePlan((s) => s.recordRecentRecipes)

  const fridgeItems = useFridge((s) => s.items)
  const addFridgeItem = useFridge((s) => s.addItem)
  const removeFridgeItem = useFridge((s) => s.removeItem)
  const removeItemsByIds = useFridge((s) => s.removeItemsByIds)
  const restoreItems = useFridge((s) => s.restoreItems)
  const manualIngredients = useSearch((s) => s.manualIngredients)
  const staples = useSettings((s) => s.staples)

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({})
  const [pax, setPax] = useState<number>(BASE_PAX)
  const [forcedMissing, setForcedMissing] = useState<Set<string>>(() => new Set())
  const [addedOnPage, setAddedOnPage] = useState<Set<string>>(() => new Set())
  const [statusNotice, setStatusNotice] = useState<{
    message: string
    undoItems?: FridgeItem[]
  } | null>(null)

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

  useEffect(() => {
    if (!statusNotice) return
    const timer = setTimeout(() => setStatusNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [statusNotice])

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

  const displayEvaluation = useMemo(() => {
    if (!evaluation) return null
    if (forcedMissing.size === 0) return evaluation

    const haveIngredients: RecipeIngredient[] = []
    const missingIngredients: RecipeIngredient[] = []

    const details = evaluation.details.map((detail) => {
      if (
        detail.status === 'have' &&
        forcedMissing.has(normalize(detail.ingredient.name))
      ) {
        missingIngredients.push(detail.ingredient)
        return {
          ingredient: detail.ingredient,
          status: 'missing' as const,
        }
      }
      if (detail.status === 'have') {
        haveIngredients.push(detail.ingredient)
      } else if (detail.status === 'missing') {
        missingIngredients.push(detail.ingredient)
      }
      return detail
    })

    return {
      ...evaluation,
      details,
      haveIngredients,
      missingIngredients,
      missingCount: missingIngredients.length,
    }
  }, [evaluation, forcedMissing])

  const matchedFridgeItems = useMemo(() => {
    if (!recipe || fridgeItems.length === 0) return []
    return fridgeItems.filter((fi) =>
      recipe.ingredients.some((ing) => ingredientMatches(fi.name, ing.name)),
    )
  }, [recipe, fridgeItems])

  if (loading && !recipe) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="h-8 w-32 rounded-xl bg-cream-dark" />
        <div className="h-72 rounded-3xl bg-cream-dark" />
        <div className="h-64 rounded-3xl bg-cream-dark" />
      </div>
    )
  }

  if (!recipe || !displayEvaluation) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-parchment bg-white p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Recipe not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          We couldn&rsquo;t locate that recipe. Try searching from the Find page or checking your Favourites.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-sage-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Find
          </Link>
          <Link
            to="/favourites"
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-parchment bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-cream"
          >
            View Favourites
          </Link>
        </div>
      </div>
    )
  }

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleMarkHave = (ingredient: RecipeIngredient) => {
    const norm = normalize(ingredient.name)
    setForcedMissing((prev) => {
      if (!prev.has(norm)) return prev
      const next = new Set(prev)
      next.delete(norm)
      return next
    })

    const alreadyAvailable = combinedAvailable.some((item) =>
      ingredientMatches(item, ingredient.name),
    )
    if (!alreadyAvailable) {
      addFridgeItem({
        name: ingredient.name,
        quantity: ingredient.measure || '1',
        useBy: '',
      })
      setAddedOnPage((prev) => {
        const next = new Set(prev)
        next.add(norm)
        return next
      })
      setStatusNotice({
        message: `Added "${ingredient.name}" to your Fridge tracker.`,
      })
    }
  }

  const handleMarkMissing = (ingredientName: string) => {
    const norm = normalize(ingredientName)
    if (addedOnPage.has(norm)) {
      const addedMatches = fridgeItems.filter((fi) => normalize(fi.name) === norm)
      for (const item of addedMatches) {
        removeFridgeItem(item.id)
      }
      setAddedOnPage((prev) => {
        const next = new Set(prev)
        next.delete(norm)
        return next
      })
    }
    setForcedMissing((prev) => {
      const next = new Set(prev)
      next.add(norm)
      return next
    })
  }

  const handleMarkFridgeCooked = () => {
    if (matchedFridgeItems.length === 0) return
    const snapshot = [...matchedFridgeItems]
    removeItemsByIds(snapshot.map((i) => i.id))
    setStatusNotice({
      message: `Marked ${snapshot.length} fridge item${snapshot.length === 1 ? '' : 's'} used (${snapshot.map((i) => i.name).join(', ')}).`,
      undoItems: snapshot,
    })
  }

  const paxMultiplier = pax / BASE_PAX
  const completedCount = recipe.instructions.reduce(
    (count, _, idx) => (completedSteps[idx] ? count + 1 : count),
    0,
  )
  const totalSteps = recipe.instructions.length
  const stepProgressPct =
    totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top navigation & actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) navigate(-1)
            else navigate('/')
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:border-sage-300 hover:bg-sage-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to recipes
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFavourite(recipe)}
            aria-pressed={isFav}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
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
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-sage-700"
          >
            <CalendarPlus className="h-4 w-4" />
            Add to plan
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-medium text-sage-800"
        >
          <span>{statusNotice.message}</span>
          {statusNotice.undoItems && (
            <button
              type="button"
              onClick={() => {
                restoreItems(statusNotice.undoItems!)
                setStatusNotice(null)
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-sage-800 ring-1 ring-sage-200 hover:bg-sage-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </button>
          )}
        </div>
      )}

      {/* Hero card */}
      <div className="overflow-hidden rounded-3xl border border-parchment bg-white shadow-xs">
        <div className="grid md:grid-cols-5">
          <div className="relative min-h-60 md:col-span-2">
            <RecipeImage
              recipe={recipe}
              loading="eager"
              className="h-full w-full object-cover"
              fallbackClassName="flex h-full min-h-60 flex-col items-center justify-center p-6"
              emojiClassName="text-7xl"
            />
          </div>

          <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                <span>{recipe.area}</span>
                <span aria-hidden="true">·</span>
                <span>{recipe.category}</span>
                {recipe.prepMinutes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">~{recipe.prepMinutes} mins</span>
                  </>
                )}
              </div>

              <h1 className="mt-2 font-display text-2xl leading-tight font-bold text-ink sm:text-3xl">
                {recipe.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2 text-xs tabular-nums">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 font-semibold text-sage-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-sage-700" />
                  Have {displayEvaluation.haveIngredients.length}
                </span>
                {displayEvaluation.stapleIngredients.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-medium text-ink-muted ring-1 ring-parchment">
                    <Sparkles className="h-3.5 w-3.5 text-sage-600" />
                    {displayEvaluation.stapleIngredients.length} pantry staples
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
                    displayEvaluation.missingCount === 0
                      ? 'bg-sage-600 text-white'
                      : 'bg-tomato-50 text-tomato-700 ring-1 ring-tomato-200'
                  }`}
                >
                  {displayEvaluation.missingCount === 0
                    ? 'Ready to cook — 0 missing!'
                    : `Missing ${displayEvaluation.missingCount}`}
                </span>
              </div>
            </div>

            {(recipe.youtube || !recipe.isFallback || matchedFridgeItems.length > 0) && (
              <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-parchment/70 pt-4">
                {matchedFridgeItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkFridgeCooked}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sage-50 px-3.5 py-2 text-xs font-semibold text-sage-800 ring-1 ring-sage-200 transition hover:bg-sage-600 hover:text-white"
                  >
                    <Utensils className="h-3.5 w-3.5" />
                    Cooked this — mark {matchedFridgeItems.length} fridge item
                    {matchedFridgeItems.length === 1 ? '' : 's'} used
                  </button>
                )}
                {recipe.youtube && (
                  <a
                    href={recipe.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-tomato-50 px-4 py-2 text-xs font-semibold text-tomato-700 ring-1 ring-tomato-200 transition hover:bg-tomato-100"
                  >
                    <PlayCircle className="h-4 w-4 text-tomato-600" />
                    Watch video tutorial on YouTube
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {!recipe.isFallback && /^\d+$/.test(recipe.id) && (
                  <a
                    href={`https://www.themealdb.com/meal/${recipe.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-parchment bg-cream/70 px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:border-sage-300 hover:text-ink"
                  >
                    View on TheMealDB
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Content: Ingredients & Instructions */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Ingredients Checklist */}
        <section className="h-fit rounded-3xl border border-parchment bg-white p-6 shadow-xs lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
              Ingredients ({recipe.ingredients.length})
            </h2>

            {/* Pax scaler */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-parchment bg-cream px-2.5 py-1 text-xs">
              <Users className="h-3.5 w-3.5 text-sage-700" aria-hidden="true" />
              <button
                type="button"
                aria-label="Decrease pax"
                onClick={() => setPax((p) => Math.max(MIN_PAX, p - 1))}
                disabled={pax <= MIN_PAX}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-white hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-11 text-center font-semibold text-ink tabular-nums">
                {pax} pax
              </span>
              <button
                type="button"
                aria-label="Increase pax"
                onClick={() => setPax((p) => Math.min(MAX_PAX, p + 1))}
                disabled={pax >= MAX_PAX}
                className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition hover:bg-white hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-subtle">Quick pax:</span>
            {PAX_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Set ${preset} pax`}
                onClick={() => setPax(preset)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold tabular-nums transition ${
                  pax === preset
                    ? 'bg-sage-600 text-white'
                    : 'bg-cream text-ink-muted hover:bg-cream-dark hover:text-ink'
                }`}
              >
                {preset}p
              </button>
            ))}
          </div>

          <ul className="mt-4 divide-y divide-parchment/60">
            {displayEvaluation.details.map(({ ingredient, status, matchedUserItem }) => {
              const scaled = scaleMeasure(ingredient.measure, paxMultiplier)
              const showMatchedAlias =
                status === 'have' &&
                matchedUserItem &&
                normalize(matchedUserItem) !== normalize(ingredient.name)
              return (
                <li
                  key={`${ingredient.name}-${ingredient.measure}`}
                  data-ingredient-status={status}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    {status === 'have' && (
                      <button
                        type="button"
                        onClick={() => handleMarkMissing(ingredient.name)}
                        aria-label={`Mark ${ingredient.name} as missing`}
                        title={`Matched: ${matchedUserItem ?? ingredient.name} — click to mark as missing`}
                        className="mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-sage-600 text-white transition hover:bg-sage-700 hover:ring-2 hover:ring-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-400"
                      >
                        <Check className="h-3 w-3" />
                      </button>
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
                      <button
                        type="button"
                        onClick={() => handleMarkHave(ingredient)}
                        aria-label={`Mark ${ingredient.name} as have`}
                        title="Missing ingredient — click to mark as have"
                        className="mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-tomato-100 text-tomato-600 transition hover:bg-tomato-200 focus:outline-none focus:ring-2 focus:ring-tomato-300"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div>
                      <p className="text-sm font-medium text-ink">{ingredient.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {status === 'have' && (
                          <span className="font-semibold text-sage-700">
                            Have{showMatchedAlias ? ` · via "${matchedUserItem}"` : ''}
                          </span>
                        )}
                        {status === 'staple' && (
                          <span className="font-medium text-ink-muted">Staple</span>
                        )}
                        {status === 'missing' && (
                          <>
                            <span className="font-semibold text-tomato-600">Missing</span>
                            <button
                              type="button"
                              onClick={() => handleMarkHave(ingredient)}
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
                    <span className="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-xs font-semibold text-ink-muted tabular-nums">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink tabular-nums">
                Method ({totalSteps} steps)
              </h2>
              <p className="text-xs text-ink-muted tabular-nums">
                {completedCount === 0
                  ? 'Tap a step to cross it off as you cook'
                  : `${completedCount} of ${totalSteps} steps done (${stepProgressPct}%)`}
              </p>
            </div>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => setCompletedSteps({})}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-cream hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset steps
              </button>
            )}
          </div>

          {totalSteps > 0 && (
            <div
              aria-hidden="true"
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark"
            >
              <div
                className="h-full rounded-full bg-sage-600 transition-all duration-200"
                style={{ width: `${stepProgressPct}%` }}
              />
            </div>
          )}

          <ol className="mt-5 space-y-4">
            {recipe.instructions.map((step, index) => {
              const done = Boolean(completedSteps[index])
              return (
                <li key={index}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggleStep(index)}
                    className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${
                      done
                        ? 'border-sage-200 bg-sage-50/60 text-ink-muted'
                        : 'border-parchment/80 bg-cream/40 text-ink hover:border-sage-300 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
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
        onAdded={(slotKey, addedRecipe) =>
          setStatusNotice({
            message: `Saved "${addedRecipe.name}" to ${formatSlotLabel(slotKey)}.`,
          })
        }
      />
    </div>
  )
}
