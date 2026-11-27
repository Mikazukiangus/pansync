import { useMemo } from 'react'
import { useOpenFoodFactsProducts } from '../hooks/useOpenFoodFactsNutrition'
import {
  estimateRecipeNutrition,
  type NutriScoreGrade,
} from '../lib/nutrition'
import type { Recipe } from '../types'

interface RecipeNutritionBadgesProps {
  recipe: Recipe
  compact?: boolean
}

const NUTRISCORE_STYLES: Record<NutriScoreGrade, string> = {
  a: 'bg-emerald-600 text-white',
  b: 'bg-lime-600 text-white',
  c: 'bg-amber-500 text-white',
  d: 'bg-orange-500 text-white',
  e: 'bg-red-600 text-white',
}

export function RecipeNutritionBadges({
  recipe,
  compact = false,
}: RecipeNutritionBadgesProps) {
  const liveProducts = useOpenFoodFactsProducts()

  const nutrition = useMemo(
    () => estimateRecipeNutrition(recipe, liveProducts),
    [recipe, liveProducts],
  )

  const hasAny =
    nutrition.nutriscoreGrade !== null ||
    nutrition.caloriesPerServing !== null ||
    nutrition.allergens.length > 0

  if (!hasAny) return null

  const allergenNames = nutrition.allergens.map((a) => a.label).join(', ')
  const disclaimer =
    'Estimated from Open Food Facts ingredient data. Always check product labels for allergies.'

  if (compact) {
    const visibleAllergens = nutrition.allergens.slice(0, 2)
    const overflowCount = nutrition.allergens.length - visibleAllergens.length

    return (
      <div
        className="flex shrink-0 flex-col items-end gap-1 text-right"
        title={
          allergenNames
            ? `Est. allergens: ${allergenNames}. ${disclaimer}`
            : disclaimer
        }
      >
        <div className="flex items-center justify-end gap-1">
          {nutrition.nutriscoreGrade && (
            <span
              data-nutriscore={nutrition.nutriscoreGrade}
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide uppercase shadow-2xs ${NUTRISCORE_STYLES[nutrition.nutriscoreGrade]}`}
            >
              Est. {nutrition.nutriscoreGrade.toUpperCase()}
            </span>
          )}

          {visibleAllergens.length > 0 && (
            <span
              aria-label={`Allergens: ${allergenNames}`}
              className="inline-flex items-center gap-0.5 rounded-md border border-parchment bg-cream px-1.5 py-0.5 text-[11px] leading-none"
            >
              {visibleAllergens.map((a) => (
                <span key={a.id} role="img" aria-label={a.label}>
                  {a.emoji}
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="text-[10px] font-semibold text-ink-muted tabular-nums">
                  +{overflowCount}
                </span>
              )}
            </span>
          )}
        </div>

        {nutrition.caloriesPerServing !== null && nutrition.proteinPerServing !== null && (
          <span className="text-[11px] leading-tight font-medium whitespace-nowrap text-ink-muted tabular-nums">
            ~{nutrition.caloriesPerServing} kcal · {nutrition.proteinPerServing}g P
          </span>
        )}
      </div>
    )
  }

  // Expanded view for Recipe detail page
  return (
    <div
      className="mt-4 rounded-2xl border border-parchment/80 bg-cream/60 p-3.5"
      aria-label="Estimated nutrition and allergens"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {nutrition.nutriscoreGrade && (
          <span
            data-nutriscore={nutrition.nutriscoreGrade}
            className={`inline-flex items-center rounded-full px-2.5 py-1 font-bold tracking-wide uppercase ${NUTRISCORE_STYLES[nutrition.nutriscoreGrade]}`}
          >
            Nutri-Score Est. {nutrition.nutriscoreGrade.toUpperCase()}
          </span>
        )}

        {nutrition.caloriesPerServing !== null && nutrition.proteinPerServing !== null && (
          <span className="inline-flex items-center rounded-full border border-parchment bg-white px-2.5 py-1 font-semibold text-ink tabular-nums">
            ~{nutrition.caloriesPerServing} kcal · {nutrition.proteinPerServing}g protein / serving
          </span>
        )}

        {nutrition.allergens.length > 0 ? (
          nutrition.allergens.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center rounded-full border border-parchment bg-white px-2.5 py-1 font-medium text-ink-muted"
            >
              {`${a.emoji} ${a.label}`}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-parchment bg-white px-2.5 py-1 text-ink-muted">
            No common allergens detected*
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-subtle">
        *Estimated via{' '}
        <a
          href="https://world.openfoodfacts.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-muted"
        >
          Open Food Facts
        </a>{' '}
        ingredient data (assumes {nutrition.servingsAssumed} servings). Always check product labels for allergies.
      </p>
    </div>
  )
}
