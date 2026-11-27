import {
  AlertCircle,
  ArrowRight,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MealPriorityId } from '../lib/priorities'
import type {
  DishNoMatchDiagnosis,
  IngredientNoMatchDiagnosis,
  PriorityOnlyNoMatchDiagnosis,
} from '../lib/recovery'

interface IngredientNoResultsCardProps {
  diagnosis: IngredientNoMatchDiagnosis
  fridgeMode: boolean
  hasManualIngredients: boolean
  onAddIngredient: (ingredientName: string) => void
  onReplaceIngredient: (oldName: string, newName: string) => void
  onRelaxMaxMissing: (nextMax: number | null) => void
  onTogglePriority: (id: MealPriorityId) => void
  onClearPriorities: () => void
  onRemoveExclusion: (ingredient: string) => void
  onSwitchToDishSearch: (dishQuery: string) => void
  onClearIngredients: () => void
}

export function IngredientNoResultsCard({
  diagnosis,
  fridgeMode,
  hasManualIngredients,
  onAddIngredient,
  onReplaceIngredient,
  onRelaxMaxMissing,
  onTogglePriority,
  onClearPriorities,
  onRemoveExclusion,
  onSwitchToDishSearch,
  onClearIngredients,
}: IngredientNoResultsCardProps) {
  const typoFixes = diagnosis.unrecognizedInputs.filter(
    (u): u is { original: string; replacement: string } => Boolean(u.replacement),
  )

  return (
    <section
      role="region"
      aria-label="No matching recipes diagnosis and recovery"
      className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8"
    >
      {/* 1. Recognize: Clear header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-600">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-tomato-600 uppercase">
            0 matching recipes · Why this happened
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl">
            {diagnosis.headline}
          </h3>
        </div>
      </div>

      {/* 2. Diagnose: Specific plain-language causes */}
      <div className="mt-4 rounded-2xl border border-honey-500/25 bg-honey-50/70 px-4 py-3.5">
        <ul className="space-y-1.5 text-sm text-ink">
          {diagnosis.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-honey-600" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Recover: Actionable 1-click fixes */}
      <div className="mt-6 space-y-5">
        {/* Dish-name redirect if user typed a dish into the ingredient box */}
        {diagnosis.dishModeQuery && diagnosis.dishModeMatchCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Switch search mode
            </p>
            <button
              type="button"
              onClick={() => onSwitchToDishSearch(diagnosis.dishModeQuery!)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
            >
              Search &ldquo;{diagnosis.dishModeQuery}&rdquo; by dish name ({diagnosis.dishModeMatchCount}{' '}
              {diagnosis.dishModeMatchCount === 1 ? 'recipe' : 'recipes'})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Spelling / ingredient replacement */}
        {!fridgeMode && typoFixes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Did you mean?
            </p>
            <div className="flex flex-wrap gap-2">
              {typoFixes.map((fix) => (
                <button
                  key={fix.original}
                  type="button"
                  onClick={() => onReplaceIngredient(fix.original, fix.replacement)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Replace &ldquo;{fix.original}&rdquo; with &ldquo;{fix.replacement}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter adjustments: missing cap, individual dietary preferences, excluded items */}
        {(diagnosis.relaxMissing ||
          diagnosis.priorityRemovals.length > 0 ||
          diagnosis.clearAllPrioritiesCount > 0 ||
          diagnosis.exclusionRemovals.length > 0) && (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Adjust active filters
            </p>
            <div className="flex flex-wrap gap-2">
              {diagnosis.relaxMissing && (
                <>
                  <button
                    type="button"
                    onClick={() => onRelaxMaxMissing(diagnosis.relaxMissing!.nextMaxMissing)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
                  >
                    {diagnosis.relaxMissing.label} ({diagnosis.relaxMissing.unlockedCount}{' '}
                    {diagnosis.relaxMissing.unlockedCount === 1 ? 'recipe' : 'recipes'})
                  </button>
                  {diagnosis.relaxMissing.nextMaxMissing !== null &&
                    diagnosis.relaxMissing.anyMissingCount >
                      diagnosis.relaxMissing.unlockedCount && (
                      <button
                        type="button"
                        onClick={() => onRelaxMaxMissing(null)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sage-300 bg-sage-50 px-3.5 py-2 text-xs font-semibold text-sage-800 transition hover:bg-sage-100"
                      >
                        Show all matching recipes ({diagnosis.relaxMissing.anyMissingCount})
                      </button>
                    )}
                </>
              )}

              {diagnosis.priorityRemovals.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onTogglePriority(opt.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sage-300 bg-sage-50 px-3.5 py-2 text-xs font-semibold text-sage-800 transition hover:bg-sage-600 hover:text-white"
                >
                  Remove &ldquo;{opt.label}&rdquo; ({opt.unlockedCount}{' '}
                  {opt.unlockedCount === 1 ? 'recipe' : 'recipes'})
                </button>
              ))}

              {diagnosis.clearAllPrioritiesCount > 0 &&
                diagnosis.priorityRemovals.length !== 1 && (
                  <button
                    type="button"
                    onClick={onClearPriorities}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
                  >
                    Clear dietary preferences ({diagnosis.clearAllPrioritiesCount}{' '}
                    {diagnosis.clearAllPrioritiesCount === 1 ? 'recipe' : 'recipes'})
                  </button>
                )}

              {diagnosis.exclusionRemovals.map((ex) => (
                <button
                  key={ex.ingredient}
                  type="button"
                  onClick={() => onRemoveExclusion(ex.ingredient)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-tomato-200 bg-tomato-50 px-3.5 py-2 text-xs font-semibold text-tomato-700 transition hover:bg-tomato-100"
                >
                  Allow &ldquo;{ex.ingredient}&rdquo; ({ex.unlockedCount}{' '}
                  {ex.unlockedCount === 1 ? 'recipe' : 'recipes'})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add one more ingredient suggestions */}
        {diagnosis.suggestedAdditions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Add one more ingredient to unlock recipes
            </p>
            <div className="flex flex-wrap gap-2">
              {diagnosis.suggestedAdditions.map((sug) => (
                <button
                  key={sug.name}
                  type="button"
                  onClick={() => onAddIngredient(sug.name)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-parchment bg-cream/70 px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50 hover:text-sage-800"
                >
                  <Plus className="h-3.5 w-3.5 text-sage-700" />
                  Add {sug.name}
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-muted tabular-nums">
                    {sug.unlockedCount}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Closest near-miss recipe callout */}
        {diagnosis.closestMatch && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-parchment bg-cream/60 px-4 py-3">
            <div className="text-xs text-ink">
              <span className="font-semibold text-sage-800">Closest recipe match: </span>
              <span className="font-semibold">{diagnosis.closestMatch.recipe.name}</span>
              <span className="text-ink-muted">
                {' '}
                (uses {diagnosis.closestMatch.usedCount} of yours · needs{' '}
                {diagnosis.closestMatch.missingCount === 0
                  ? '0 extra items'
                  : diagnosis.closestMatch.missingIngredients
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(', ')}
                {diagnosis.closestMatch.missingIngredients.length > 3 ? '…' : ''})
              </span>
            </div>
            <Link
              to={`/recipe/${diagnosis.closestMatch.recipe.id}`}
              className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-sage-700 ring-1 ring-parchment transition hover:ring-sage-400"
            >
              View recipe
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Reset option */}
        {!fridgeMode && hasManualIngredients && (
          <div className="border-t border-parchment/70 pt-3">
            <button
              type="button"
              onClick={onClearIngredients}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-parchment bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-cream hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Start over (clear ingredients)
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

interface PriorityOnlyNoResultsCardProps {
  diagnosis: PriorityOnlyNoMatchDiagnosis
  onTogglePriority: (id: MealPriorityId) => void
  onClearPriorities: () => void
  onRemoveExclusion: (ingredient: string) => void
}

export function PriorityOnlyNoResultsCard({
  diagnosis,
  onTogglePriority,
  onClearPriorities,
  onRemoveExclusion,
}: PriorityOnlyNoResultsCardProps) {
  return (
    <section
      role="region"
      aria-label="Dietary filter conflict diagnosis and recovery"
      className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-600">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-tomato-600 uppercase">
            0 matching recipes · Filter conflict
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl">
            {diagnosis.headline}
          </h3>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-honey-500/25 bg-honey-50/70 px-4 py-3.5">
        <ul className="space-y-1.5 text-sm text-ink">
          {diagnosis.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-honey-600" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 space-y-2.5">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Adjust dietary filters to recover results
        </p>
        <div className="flex flex-wrap gap-2">
          {diagnosis.priorityRemovals.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onTogglePriority(opt.id)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sage-300 bg-sage-50 px-3.5 py-2 text-xs font-semibold text-sage-800 transition hover:bg-sage-600 hover:text-white"
            >
              Remove &ldquo;{opt.label}&rdquo; ({opt.unlockedCount}{' '}
              {opt.unlockedCount === 1 ? 'recipe' : 'recipes'})
            </button>
          ))}

          {diagnosis.exclusionRemovals.map((ex) => (
            <button
              key={ex.ingredient}
              type="button"
              onClick={() => onRemoveExclusion(ex.ingredient)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-tomato-200 bg-tomato-50 px-3.5 py-2 text-xs font-semibold text-tomato-700 transition hover:bg-tomato-100"
            >
              Allow &ldquo;{ex.ingredient}&rdquo; ({ex.unlockedCount}{' '}
              {ex.unlockedCount === 1 ? 'recipe' : 'recipes'})
            </button>
          ))}

          <button
            type="button"
            onClick={onClearPriorities}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
          >
            Clear all dietary filters
          </button>
        </div>
      </div>
    </section>
  )
}

interface DishNoResultsCardProps {
  query: string
  diagnosis: DishNoMatchDiagnosis
  onSelectDishSuggestion: (dish: string) => void
  onSwitchToIngredientSearch: (rawIngredients: string) => void
  onTogglePriority: (id: MealPriorityId) => void
  onClearPriorities: () => void
  onRemoveExclusion: (ingredient: string) => void
  onClearDishSearch: () => void
}

const FALLBACK_POPULAR_DISHES = ['Pasta', 'Curry', 'Fried Rice', 'Shakshuka']

export function DishNoResultsCard({
  query,
  diagnosis,
  onSelectDishSuggestion,
  onSwitchToIngredientSearch,
  onTogglePriority,
  onClearPriorities,
  onRemoveExclusion,
  onClearDishSearch,
}: DishNoResultsCardProps) {
  const dishAlternatives =
    diagnosis.similarDishNames.length > 0
      ? diagnosis.similarDishNames
      : FALLBACK_POPULAR_DISHES

  return (
    <section
      role="region"
      aria-label="No matching dish diagnosis and recovery"
      className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tomato-50 text-tomato-600">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-tomato-600 uppercase">
            0 matching dishes · Why this happened
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold text-ink sm:text-2xl">
            {diagnosis.headline}
          </h3>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-honey-500/25 bg-honey-50/70 px-4 py-3.5">
        <ul className="space-y-1.5 text-sm text-ink">
          {diagnosis.reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-honey-600" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-5">
        {/* Switch to ingredient search if query matches recipes as ingredients */}
        {diagnosis.ingredientModeMatchCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Search as ingredient instead
            </p>
            <button
              type="button"
              onClick={() => onSwitchToIngredientSearch(query)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
            >
              Find recipes using &ldquo;{query}&rdquo; ({diagnosis.ingredientModeMatchCount}{' '}
              {diagnosis.ingredientModeMatchCount === 1 ? 'recipe' : 'recipes'})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Filter adjustments */}
        {(diagnosis.priorityRemovals.length > 0 ||
          diagnosis.clearAllPrioritiesCount > 0 ||
          diagnosis.exclusionRemovals.length > 0) && (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Adjust active filters
            </p>
            <div className="flex flex-wrap gap-2">
              {diagnosis.priorityRemovals.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onTogglePriority(opt.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sage-300 bg-sage-50 px-3.5 py-2 text-xs font-semibold text-sage-800 transition hover:bg-sage-600 hover:text-white"
                >
                  Remove &ldquo;{opt.label}&rdquo; ({opt.unlockedCount}{' '}
                  {opt.unlockedCount === 1 ? 'dish' : 'dishes'})
                </button>
              ))}

              {diagnosis.clearAllPrioritiesCount > 0 &&
                diagnosis.priorityRemovals.length !== 1 && (
                  <button
                    type="button"
                    onClick={onClearPriorities}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sage-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-sage-700"
                  >
                    Clear dietary preferences ({diagnosis.clearAllPrioritiesCount})
                  </button>
                )}

              {diagnosis.exclusionRemovals.map((ex) => (
                <button
                  key={ex.ingredient}
                  type="button"
                  onClick={() => onRemoveExclusion(ex.ingredient)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-tomato-200 bg-tomato-50 px-3.5 py-2 text-xs font-semibold text-tomato-700 transition hover:bg-tomato-100"
                >
                  Allow &ldquo;{ex.ingredient}&rdquo; ({ex.unlockedCount}{' '}
                  {ex.unlockedCount === 1 ? 'dish' : 'dishes'})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Alternative / close dish suggestions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {diagnosis.similarDishNames.length > 0
              ? 'Closest matching dishes'
              : 'Try a popular dish instead'}
          </p>
          <div className="flex flex-wrap gap-2">
            {dishAlternatives.map((dish) => (
              <button
                key={dish}
                type="button"
                onClick={() => onSelectDishSuggestion(dish)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-parchment bg-cream/70 px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:border-sage-400 hover:bg-sage-50 hover:text-sage-800"
              >
                <Sparkles className="h-3.5 w-3.5 text-sage-700" />
                {dish}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-parchment/70 pt-3">
          <button
            type="button"
            onClick={onClearDishSearch}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-parchment bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-cream hover:text-ink"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear dish search
          </button>
        </div>
      </div>
    </section>
  )
}
