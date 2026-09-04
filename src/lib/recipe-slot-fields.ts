import type { Atom, SectionRecipe, SlotRef } from '@/blocks/recipe/types'

export type SlotInput = 'text' | 'textarea' | 'url' | 'media' | 'icon'

export type SlotField = {
  scope: 'header' | 'item'
  name: string
  label: string
  input: SlotInput
}

/** Which input an atom kind's slot is filled in with. */
function inputFor(kind: Atom['kind']): SlotInput {
  switch (kind) {
    case 'media':
      return 'media'
    case 'icon':
      return 'icon'
    case 'text':
      return 'textarea'
    default:
      return 'text'
  }
}

/**
 * The fields the content form renders, derived from what the recipe declares.
 *
 * An atom with no slot contributes no field — a badge that numbers itself from
 * its position has nothing for a merchant to fill in. An atom with two slots
 * contributes two. That is the whole rule; there are no per-kind exceptions
 * beyond choosing which input to show.
 *
 * PRECONDITION: `recipe` must be the return value of `parseRecipe`
 * (src/blocks/recipe/parse.ts), never raw/untrusted JSON cast to
 * `SectionRecipe`. This function does no shape validation of its own — a
 * `template` that isn't an array, or one containing a `null` entry, will
 * throw here rather than degrade gracefully. `parseRecipe` is what sanitizes
 * both away before a recipe ever reaches this function; skipping it (as
 * `RecipeContentField` briefly did) reintroduces a crash with no signal from
 * this file's types, since `SectionRecipe` is just a type, not a runtime
 * guarantee.
 */
export function slotFieldsOf(recipe: SectionRecipe): SlotField[] {
  const fields: SlotField[] = []
  const push = (scope: 'header' | 'item', ref: SlotRef | undefined, input: SlotInput) => {
    if (ref) fields.push({ scope, name: ref.name, label: ref.label, input })
  }

  const header = recipe.header
  if (header) {
    push('header', header.eyebrow, 'text')
    push('header', header.heading, 'text')
    push('header', header.body, 'textarea')
  }

  for (const atom of recipe.items?.template ?? []) {
    push('item', atom.slot, inputFor(atom.kind))
    if (atom.kind === 'link' || atom.kind === 'button') push('item', atom.hrefSlot, 'url')
  }

  return fields
}

/**
 * How many item rows the form renders — the recipe's own declared count, or
 * zero when the recipe has no `items` block at all.
 *
 * This is the one piece of "what the form shows" decision logic, kept here
 * rather than in the component: `RecipeContentField` needs the identical
 * number twice (how many `fieldset`s to render, and — critically — as the
 * floor a write must never shrink stored `items` below). Deriving it in two
 * places risks the two drifting; deriving it once and importing it cannot.
 */
export function itemCountOf(recipe: SectionRecipe): number {
  return recipe.items?.source.count ?? 0
}
