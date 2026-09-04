import React from 'react'
import type { BlockContext } from '@/blocks/index'
import { parseRecipe } from '@/blocks/recipe/parse'
import { cleanRecipeContent } from '@/lib/recipe-content'
import { RecipeSection } from '@/blocks/recipe/RecipeSection'
import { collectMediaIds, resolveRecipeMedia } from '@/lib/recipe-media'
import type { RecipeMediaDoc } from '@/blocks/recipe/atoms'

type CustomSectionBlock = {
  definition?: unknown
  content?: unknown
}

/**
 * Renders one placed custom section.
 *
 * Every failure mode renders nothing rather than throwing, matching
 * `if (!Comp) return null` in src/blocks/index.tsx: an unpopulated or deleted
 * definition, one that has never been published, or a stored recipe the parser
 * rejects. The storefront renders what is saved, and a page must never 500
 * because one section is in a state the merchant has not finished.
 *
 * The recipe is re-parsed here even though the collection validated it on save.
 * The stored row is not trusted — a direct database write, a restore, or an older
 * deploy's schema can all put something else there.
 */
export async function CustomSectionComponent({
  block,
  ctx,
}: {
  block: CustomSectionBlock
  ctx: BlockContext
}) {
  const definition = block.definition
  // An unpopulated relationship is still the raw id, not a document.
  if (typeof definition !== 'object' || definition === null) return null
  if ((definition as { _status?: string })._status !== 'published') return null

  let recipe
  try {
    recipe = parseRecipe((definition as { recipe?: unknown }).recipe)
  } catch {
    return null
  }

  const content = cleanRecipeContent(recipe, block.content)
  const ids = collectMediaIds(recipe, content)
  // A failed media lookup must not take the page down — render the section
  // without its images rather than throwing out of a server component.
  let media: Map<string, RecipeMediaDoc> = new Map()
  try {
    media = await resolveRecipeMedia(ctx.payload, ctx.tenantId, ids)
  } catch {
    media = new Map()
  }

  return <RecipeSection recipe={recipe} content={content} ctx={ctx} media={media} />
}
