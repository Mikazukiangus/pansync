import { CalendarPlus, Flame, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFavourites } from '../store/useFavourites'
import type { MatchedRecipe, Recipe } from '../types'
import { RecipeImage } from './RecipeImage'

interface RecipeCardProps {
  recipe: Recipe
  match?: MatchedRecipe
  onPlanClick: (recipe: Recipe) => void
}

export function RecipeCard({ recipe, match, onPlanClick }: RecipeCardProps) {
  const isFav = useFavourites((s) => s.ids.includes(recipe.id))
  const toggleFavourite = useFavourites((s) => s.toggleFavourite)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-parchment bg-white shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-sage-300 hover:shadow-lg">
      {/* Media / Emoji Banner */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-cream-dark">
        <Link to={`/recipe/${recipe.id}`} className="block h-full w-full">
          <RecipeImage
            recipe={recipe}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            fallbackClassName="flex h-full w-full flex-col items-center justify-center p-4"
            emojiClassName="text-5xl drop-shadow-xs transition duration-300 group-hover:scale-110"
          />
          {recipe.image && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/40 to-transparent"
            />
          )}
        </Link>

        {/* Expiring urgent indicator */}
        {match && match.expiringUsedCount > 0 && (
          <div className="pointer-events-none absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-tomato-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs tabular-nums">
              <Flame className="h-3 w-3" />
              Uses {match.expiringUsedCount} expiring
            </span>
          </div>
        )}

        {/* Favourite Heart Button */}
        <button
          type="button"
          onClick={() => toggleFavourite(recipe)}
          aria-label={
            isFav ? `Remove ${recipe.name} from favourites` : `Save ${recipe.name} to favourites`
          }
          aria-pressed={isFav}
          className={`absolute top-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full shadow-sm backdrop-blur-xs transition ${
            isFav
              ? 'bg-tomato-500 text-white hover:bg-tomato-600'
              : 'bg-white/95 text-ink-muted hover:bg-white hover:text-tomato-500'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <span>{recipe.area}</span>
          <span aria-hidden="true">·</span>
          <span>{recipe.category}</span>
          {recipe.prepMinutes && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">~{recipe.prepMinutes} min</span>
            </>
          )}
        </div>

        <Link to={`/recipe/${recipe.id}`} className="group/title mt-1">
          <h3 className="font-display text-lg leading-snug font-semibold text-ink transition group-hover/title:text-sage-700">
            {recipe.name}
          </h3>
        </Link>

        {match ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
            <span className="text-sage-700">
              Uses {match.usedCount} of yours
            </span>
            <span aria-hidden="true" className="text-ink-subtle">
              ·
            </span>
            <span className={match.missingCount === 0 ? 'text-sage-700' : 'text-ink-muted'}>
              {match.missingCount === 0 ? 'Missing 0!' : `Missing ${match.missingCount}`}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted tabular-nums">
            {recipe.ingredients.length} ingredients
          </p>
        )}

        {match && (match.usedUserItems.length > 0 || match.missingCount > 0) && (
          <div className="mt-2 space-y-0.5 text-xs">
            {match.usedUserItems.length > 0 && (
              <p className="line-clamp-1 text-sage-800">
                <span className="font-medium text-ink-muted">Using: </span>
                {match.usedUserItems.slice(0, 4).join(', ')}
                {match.usedUserItems.length > 4 ? ` +${match.usedUserItems.length - 4}` : ''}
              </p>
            )}
            {match.missingCount > 0 && (
              <p className="line-clamp-1 text-ink-muted">
                <span>Need: </span>
                {match.missingIngredients.map((i) => i.name).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Link
            to={`/recipe/${recipe.id}`}
            className="inline-flex min-h-9 items-center text-xs font-semibold text-sage-700 hover:text-sage-800 hover:underline"
          >
            View recipe →
          </Link>
          <button
            type="button"
            onClick={() => onPlanClick(recipe)}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-sage-800 transition hover:border-sage-500 hover:bg-sage-600 hover:text-white"
          >
            <CalendarPlus className="h-3.5 w-3.5" />+ Plan
          </button>
        </div>
      </div>
    </article>
  )
}
