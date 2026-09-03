// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RecipeSection } from './RecipeSection'
import { REPRODUCTIONS } from './reproductions'

afterEach(cleanup)
// `payload` is unused here — RecipeSection never reads ctx.payload — but
// BlockContext requires it, so a stub satisfies the type.
const ctx = { tenantId: 1, currency: 'AED', premiumSections: true, payload: {} as unknown as import('payload').Payload }

const partsOf = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-nb-part]')].map((e) => e.getAttribute('data-nb-part')!).sort()

// `item` is documented in src/blocks/lib/hooks.ts as "the repeated wrapper" —
// a purely structural scoping hook ("a designer scopes a part to inside an
// item by combining selectors"), never itself a content hook. Its own
// `textContent` is therefore not "visible text" in any semantic sense: it is
// the concatenation of every descendant's text PLUS whatever non-hooked
// decorative markup (e.g. Testimonials' hardcoded `&ldquo;` glyph, which has
// no data-nb-part of its own) happens to sit inside the wrapper. Comparing
// that aggregate is exactly the "chase identical markup" trap the brief
// warns against — it fails on Testimonials for a decorative character no
// recipe atom is meant to reproduce, while every other content part (heading,
// item-heading, item-body, ...) already compares correctly on its own. So
// `item` is excluded here; its structural role is still fully covered by
// `partsOf` (which the other test in this suite asserts on).
const textOf = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-nb-part]')]
    .filter((e) => e.getAttribute('data-nb-part') !== 'item')
    .map((e) => (e.textContent ?? '').trim())
    .filter(Boolean)

// Neither `partsOf` nor `textOf` can see a wrong icon glyph: an SVG carries no
// `data-nb-part` of its own and no text, so a recipe resolving `icon` against
// the wrong registry (this suite's regression target — see
// src/blocks/recipe/icons.tsx) renders a different shape while both part
// names and visible text stay identical. Comparing markup for the media-role
// wrapper (`media` / `item-media`) closes that blind spot for icons: the
// icon's own SVG markup is a descendant of that wrapper, so a swapped glyph
// shows up as a mismatch even though nothing else differs.
//
// For ImageGallery, the original block puts `data-nb-part="item-media"`
// directly on the `<img>`; the recipe (Task 3) puts it on the wrapping
// `<div>` instead, matching the icon atom's own wrapper-div convention (see
// atoms.tsx). So the queried element is an `<img>` on one side and a `<div>`
// containing an `<img>` on the other — comparing `innerHTML` or `outerHTML`
// of the *queried element itself* would compare a serialized `<img ...>`
// string against a bare `src`, which can never match by format regardless of
// whether the image is right or wrong. Resolving to "the `<img>`, whichever
// element carries it" first, then comparing only its `src`, targets exactly
// the regression class (a wrong or missing image) on both shapes without
// that brittleness. outerHTML of the `<img>` itself was considered and
// rejected too: the original's `<img>` carries a different class list than
// the recipe's (the original puts its aspect-ratio class on the wrapping
// `<div>`, the recipe puts fit/aspect classes split across div and img), none
// of which the brief requires to match. The innerHTML fallback stays for
// non-`<img>` media elements (icon wrappers), where it already works.
//
// `alt` is not compared here either, even though Task 3 now resolves it from
// the Media document on both sides: this assertion's job is the image
// identity (`src`), not its accessible text, and the reproduction fixture
// above already uses the same fixture doc for both renders so `alt` matches
// incidentally.
const mediaMarkupOf = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-nb-part="media"], [data-nb-part="item-media"]')].map((e) => {
    const img = e.tagName === 'IMG' ? e : e.querySelector('img')
    return img ? `img:${img.getAttribute('src') ?? ''}` : e.innerHTML
  })

describe('a recipe reproduces its hand-built block', () => {
  for (const { name, recipe, content, original, media } of REPRODUCTIONS) {
    it(`${name}: emits the same hook parts`, () => {
      const a = render(original()).container as HTMLElement
      const partsOriginal = partsOf(a)
      // Guard against the vacuous pass this suite exists to prevent: if the
      // original never actually rendered (e.g. a fixture prop mismatched the
      // real schema, as happened for real with Steps' `items` vs `steps`
      // field-name bug — see src/blocks/test-fixtures.tsx), both sides would
      // be `[]` and `toEqual` would pass having proved nothing.
      expect(partsOriginal.length).toBeGreaterThan(0)
      cleanup()
      const b = render(<RecipeSection recipe={recipe} content={content} ctx={ctx} media={media} />).container as HTMLElement
      expect(partsOf(b)).toEqual(partsOriginal)
    })

    it(`${name}: renders the same visible text in the same order`, () => {
      const a = render(original()).container as HTMLElement
      // Same vacuous-pass guard as above, but keyed on *parts* rather than
      // *text*: a block can legitimately render zero visible text under any
      // data-nb-part element (ImageGallery is images only, no captions) while
      // still having genuinely rendered — its `item`/`item-media` parts are
      // non-empty. Guarding on `textOf(a).length` instead would fail that
      // block for being exactly correct, so the "did the original actually
      // render" check reuses the parts count in both tests.
      expect(partsOf(a).length).toBeGreaterThan(0)
      const textOriginal = textOf(a)
      cleanup()
      const b = render(<RecipeSection recipe={recipe} content={content} ctx={ctx} media={media} />).container as HTMLElement
      expect(textOf(b)).toEqual(textOriginal)
    })

    it(`${name}: renders identical icon/media markup`, () => {
      const a = render(original()).container as HTMLElement
      expect(partsOf(a).length).toBeGreaterThan(0)
      const markupOriginal = mediaMarkupOf(a)
      cleanup()
      const b = render(<RecipeSection recipe={recipe} content={content} ctx={ctx} media={media} />).container as HTMLElement
      expect(mediaMarkupOf(b)).toEqual(markupOriginal)
    })
  }
})
