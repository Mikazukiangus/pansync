import { DiscussionEmbed } from 'disqus-react'
import { MessageSquare } from 'lucide-react'

interface RecipeCommentsProps {
  id: string
  title: string
  url?: string
  heading?: string
}

export function RecipeComments({
  id,
  title,
  url,
  heading = 'Comments & Cooking Tips',
}: RecipeCommentsProps) {
  const resolvedUrl =
    url ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/recipe/${id}`
      : `https://pansync.vercel.app/recipe/${id}`)

  return (
    <section
      aria-label={heading}
      className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-sage-600" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
      </div>

      <DiscussionEmbed
        key={id}
        shortname="pansync"
        config={{
          url: resolvedUrl,
          identifier: id,
          title,
          language: 'en',
        }}
      />
    </section>
  )
}
