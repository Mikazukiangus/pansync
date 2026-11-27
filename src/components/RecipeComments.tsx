import { DiscussionEmbed } from 'disqus-react'
import { MessageSquare } from 'lucide-react'

interface RecipeCommentsProps {
  id: string
  title: string
  url?: string
}

export function RecipeComments({ id, title, url }: RecipeCommentsProps) {
  const resolvedUrl =
    url ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/recipe/${id}`
      : `https://pansync.vercel.app/recipe/${id}`)

  return (
    <section
      aria-label="Recipe comments"
      className="rounded-3xl border border-parchment bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-sage-600" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold text-ink">
          Comments &amp; Cooking Tips
        </h2>
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
