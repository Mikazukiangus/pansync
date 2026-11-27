import { Utensils } from 'lucide-react'
import { useState } from 'react'
import type { Recipe } from '../types'

interface RecipeImageProps {
  recipe: Pick<Recipe, 'name' | 'image' | 'emoji' | 'gradient'>
  className?: string
  fallbackClassName?: string
  emojiClassName?: string
  alt?: string
  loading?: 'lazy' | 'eager'
}

export function RecipeImage({
  recipe,
  className = 'h-full w-full object-cover',
  fallbackClassName = 'flex h-full w-full flex-col items-center justify-center p-4',
  emojiClassName = 'text-5xl',
  alt,
  loading = 'lazy',
}: RecipeImageProps) {
  const [failed, setFailed] = useState(false)

  if (recipe.image && !failed) {
    return (
      <img
        src={recipe.image}
        alt={alt ?? recipe.name}
        loading={loading}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={className}
      />
    )
  }

  return (
    <div
      className={`bg-linear-to-br ${
        recipe.gradient ?? 'from-sage-100 via-cream to-honey-100'
      } ${fallbackClassName}`}
    >
      {recipe.emoji ? (
        <span className={emojiClassName} aria-hidden="true">
          {recipe.emoji}
        </span>
      ) : (
        <Utensils className="h-6 w-6 text-sage-700" aria-hidden="true" />
      )}
    </div>
  )
}
