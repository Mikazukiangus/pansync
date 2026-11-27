import { CalendarPlus, Flame, Heart, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFavourites } from '../store/useFavourites'
import type { MatchedRecipe, Recipe } from '../types'

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
          {recipe.image ? (
            <img
              src={recipe.image}
              alt={recipe.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className={`flex h-full w-full flex-col items-center justify-center bg-linear-to-br ${
                recipe.gradient ?? 'from-sage-100 via-cream to-honey-100'
              } p-4`}
            >
              <span className="text-5xl drop-shadow-xs transition duration-300 group-hover:scale-110">
                {recipe.emoji ?? '🍲'}
              </span>
              {recipe.prepMinutes && (
                <span className="mt-2 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  ~{recipe.prepMinutes} mins
                </span>
              )}
            </div>
          )}
        </Link>

        {/* Top Category Pill */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-2xs backdrop-blur-xs">
            {recipe.area} · {recipe.category}
          </span>
          {match && match.expiringUsedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tomato-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
              <Flame className="h-3 w-3" />
              Uses {match.expiringUsedCount} expiring
            </span>
          )}
        </div>

        {/* Favourite Heart Button */}
        <button
          type="button"
          onClick={() => toggleFavourite(recipe)}
          aria-label={
            isFav ? `Remove ${recipe.name} from favourites` : `Save ${recipe.name} to favourites`
          }
          aria-pressed={isFav}
          className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full shadow-sm backdrop-blur-xs transition ${
            isFav
              ? 'bg-tomato-500 text-white hover:bg-tomato-600'
              : 'bg-white/90 text-ink-muted hover:bg-white hover:text-tomato-500'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/recipe/${recipe.id}`} className="group/title">
          <h3 className="font-display text-lg leading-snug font-semibold text-ink transition group-hover/title:text-sage-700">
            {recipe.name}
          </h3>
        </Link>

        {match ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-50 px-2.5 py-1 font-semibold text-sage-800 ring-1 ring-sage-200">
              <Sparkles className="h-3 w-3 text-sage-600" />
              Uses {match.usedCount} of yours
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                match.missingCount === 0
                  ? 'bg-sage-600 text-white'
                  : 'bg-cream-dark text-ink-muted'
              }`}
            >
              {match.missingCount === 0 ? 'Missing 0!' : `Missing ${match.missingCount}`}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">
            {recipe.ingredients.length} ingredients
          </p>
        )}

        {match && match.missingCount > 0 && (
          <p className="mt-2 line-clamp-1 text-xs text-ink-muted">
            Need: {match.missingIngredients.map((i) => i.name).join(', ')}
          </p>
        )}

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <Link
            to={`/recipe/${recipe.id}`}
            className="text-xs font-semibold text-sage-700 hover:text-sage-800 hover:underline"
          >
            View recipe →
          </Link>
          <button
            type="button"
            onClick={() => onPlanClick(recipe)}
            className="inline-flex items-center gap-1 rounded-xl border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold text-sage-800 transition hover:border-sage-500 hover:bg-sage-600 hover:text-white"
          >
            <CalendarPlus className="h-3.5 w-3.5" />+ Plan
          </button>
        </div>
      </div>
    </article>
  )
}
