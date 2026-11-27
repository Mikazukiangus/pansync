import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecipeComments } from '../components/RecipeComments'

describe('RecipeComments (Disqus DiscussionEmbed)', () => {
  it('mounts the Disqus thread container with pansync shortname and recipe metadata', () => {
    render(
      <RecipeComments
        id="52772"
        title="Teriyaki Chicken Casserole"
        url="https://pansync.vercel.app/recipe/52772"
      />,
    )

    expect(
      screen.getByRole('heading', { name: /Comments & Cooking Tips/i }),
    ).toBeInTheDocument()
    expect(document.getElementById('disqus_thread')).toBeInTheDocument()
  })
})
