/** @vitest-environment jsdom */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SECTION_PRESETS } from './presets'
import { parseRecipe } from './parse'
import { RecipeSection } from './RecipeSection'
import type { BlockContext } from '@/blocks/index'

afterEach(cleanup)

// `payload` is unused here — RecipeSection never reads ctx.payload — but
// BlockContext requires it, so a stub satisfies the type. No `as unknown as`
// cast: that shape of cast is exactly what let this fixture go stale the
// last time BlockContext gained a required field.
const ctx: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

/** Every slot the recipe declares, with a filled-in value of the right shape. */
function fillContent(preset: (typeof SECTION_PRESETS)[number]) {
  const { recipe } = preset
  const header: Record<string, unknown> = {}
  for (const ref of [recipe.header?.eyebrow, recipe.header?.heading, recipe.header?.body]) {
    if (ref) header[ref.name] = `H:${ref.name}`
  }
  const item: Record<string, unknown> = {}
  for (const atom of recipe.items?.template ?? []) {
    if (atom.kind === 'media' && atom.slot) item[atom.slot.name] = 7
    else if (atom.kind === 'icon' && atom.slot) item[atom.slot.name] = 'star'
    else if (atom.slot) item[atom.slot.name] = `I:${atom.slot.name}`
    if (atom.kind === 'link' || atom.kind === 'button') item[atom.hrefSlot.name] = '/somewhere'
  }
  return { header, items: [item] }
}

const media = new Map([['7', { id: 7, url: '/fixture.jpg', alt: 'Fixture' }]])

describe('SECTION_PRESETS', () => {
  it('is non-empty — an empty library would make every test below vacuous', () => {
    expect(SECTION_PRESETS.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = SECTION_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(SECTION_PRESETS.map((p) => [p.id, p] as const))('%s parses', (_id, preset) => {
    expect(() => parseRecipe(preset.recipe)).not.toThrow()
  })

  it.each(SECTION_PRESETS.map((p) => [p.id, p] as const))(
    '%s renders every part its recipe declares',
    (_id, preset) => {
      const recipe = parseRecipe(preset.recipe)
      const { container } = render(
        <RecipeSection recipe={recipe} content={fillContent(preset)} ctx={ctx} media={media} />,
      )
      const parts = [...container.querySelectorAll('[data-nb-part]')].map((e) =>
        e.getAttribute('data-nb-part'),
      )
      // Guard first: an empty render would satisfy every containment check below.
      expect(parts.length).toBeGreaterThan(0)

      for (const atom of recipe.items?.template ?? []) {
        const expected =
          atom.kind === 'media' || atom.kind === 'icon'
            ? 'item-media'
            : atom.kind === 'heading'
              ? 'item-heading'
              : atom.kind === 'text'
                ? 'item-body'
                : atom.kind === 'button'
                  ? 'cta'
                  : atom.kind
        expect(parts).toContain(expected)
      }
    },
  )

  /**
   * Only the presets that actually declare a link or a button. Parameterising
   * the href case over ALL of them reported a pass for `portraitCards`, which
   * declares neither: `linkish` was empty, so the case reduced to
   * `expect([]).toHaveLength(0)` and the per-anchor loop ran zero times. A
   * green result about nothing is worse than no result — it makes the library
   * look better covered than it is.
   */
  const LINKISH_PRESETS = SECTION_PRESETS.filter((p) =>
    (p.recipe.items?.template ?? []).some((a) => a.kind === 'link' || a.kind === 'button'),
  )

  it('has at least one preset carrying a link or button — the href case below needs one', () => {
    expect(LINKISH_PRESETS.length).toBeGreaterThan(0)
  })

  it.each(LINKISH_PRESETS.map((p) => [p.id, p] as const))(
    '%s gives every link and button a real href',
    (_id, preset) => {
      const recipe = parseRecipe(preset.recipe)
      const { container } = render(
        <RecipeSection recipe={recipe} content={fillContent(preset)} ctx={ctx} media={media} />,
      )
      const anchors = [...container.querySelectorAll('a')]
      const linkish = (recipe.items?.template ?? []).filter(
        (a) => a.kind === 'link' || a.kind === 'button',
      )
      // Guaranteed non-zero by the filter above, but re-asserted here so the
      // count comparison can never silently become 0 === 0 again if the filter
      // and this case ever drift apart.
      expect(linkish.length).toBeGreaterThan(0)
      expect(anchors).toHaveLength(linkish.length)
      for (const a of anchors) expect(a.getAttribute('href')).toBe('/somewhere')
    },
  )
})
