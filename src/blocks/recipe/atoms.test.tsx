// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RecipeAtom } from './atoms'
import { isNbPart } from '@/blocks/lib/hooks'

afterEach(cleanup)

const slot = { name: 's', label: 'S' }

describe('RecipeAtom', () => {
  it('renders a heading at the requested level', () => {
    const { container } = render(
      <RecipeAtom atom={{ kind: 'heading', level: 3, size: 'md', slot }} source={{ s: 'Title' }} index={0} level="block" />,
    )
    const h = container.querySelector('h3')
    expect(h?.textContent).toBe('Title')
  })

  it('marks a block-level heading `heading` and an item-level one `item-heading`', () => {
    const { container: b } = render(
      <RecipeAtom atom={{ kind: 'heading', level: 2, size: 'md', slot }} source={{ s: 'B' }} index={0} level="block" />,
    )
    expect(b.querySelector('[data-nb-part="heading"]')).not.toBeNull()

    const { container: i } = render(
      <RecipeAtom atom={{ kind: 'heading', level: 3, size: 'md', slot }} source={{ s: 'I' }} index={0} level="item" />,
    )
    expect(i.querySelector('[data-nb-part="item-heading"]')).not.toBeNull()
  })

  it('marks item-level text, media, and icon with their item- part names', () => {
    const { container: text } = render(
      <RecipeAtom atom={{ kind: 'text', size: 'md', slot }} source={{ s: 'T' }} index={0} level="item" />,
    )
    expect(text.querySelector('[data-nb-part="item-body"]')).not.toBeNull()

    const { container: media } = render(
      <RecipeAtom
        atom={{ kind: 'media', aspect: '1:1', fit: 'cover', slot }}
        source={{ s: 7 }}
        index={0}
        level="item"
        media={new Map([['7', { id: 7, url: '/x.jpg', alt: 'x' }]])}
      />,
    )
    expect(media.querySelector('[data-nb-part="item-media"]')).not.toBeNull()

    const { container: icon } = render(
      <RecipeAtom atom={{ kind: 'icon', slot }} source={{ s: 'star' }} index={0} level="item" />,
    )
    expect(icon.querySelector('[data-nb-part="item-media"]')).not.toBeNull()
  })

  it('numbers an index badge from 1, not 0', () => {
    const { container } = render(
      <RecipeAtom atom={{ kind: 'badge', source: 'index' }} source={undefined} index={0} level="item" />,
    )
    expect(container.textContent).toBe('1')
  })

  it('renders nothing when the slot has no value, rather than an empty element', () => {
    const { container } = render(
      <RecipeAtom atom={{ kind: 'text', size: 'md', slot }} source={undefined} index={0} level="item" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('falls back to the star glyph for an icon key naming an Object.prototype member, rather than throwing', () => {
    // Regression guard for src/blocks/recipe/icons.tsx: RECIPE_ICONS used to
    // be a plain object literal, so `RECIPE_ICONS[key] ?? RECIPE_ICONS.star`
    // resolved `__proto__`, `constructor`, and `toString` to real (truthy)
    // values on Object.prototype instead of falling through to `star`,
    // crashing the render. Verified against all three, not just `__proto__`.
    const { container: starContainer } = render(
      <RecipeAtom atom={{ kind: 'icon', slot }} source={{ s: 'star' }} index={0} level="item" />,
    )
    const starMarkup = starContainer.querySelector('svg')?.outerHTML
    expect(starMarkup).toBeTruthy()
    cleanup()

    for (const key of ['__proto__', 'constructor', 'toString']) {
      const { container } = render(
        <RecipeAtom atom={{ kind: 'icon', slot }} source={{ s: key }} index={0} level="item" />,
      )
      expect(container.querySelector('svg')?.outerHTML).toBe(starMarkup)
      cleanup()
    }
  })

  it('only ever emits published part names', () => {
    const atoms: Parameters<typeof RecipeAtom>[0]['atom'][] = [
      { kind: 'heading', level: 2, size: 'md', slot },
      { kind: 'text', size: 'md', slot },
      { kind: 'eyebrow', slot },
      { kind: 'badge', source: 'index' },
      { kind: 'link', slot, hrefSlot: { name: 'href', label: 'URL' } },
      { kind: 'button', style: 'primary', slot, hrefSlot: { name: 'href', label: 'URL' } },
      { kind: 'media', aspect: '1:1', fit: 'cover', slot },
      { kind: 'icon', slot },
    ]
    const media = new Map([['v', { id: 'v', url: '/m.jpg', alt: 'm' }]])
    for (const atom of atoms) {
      const { container } = render(
        <RecipeAtom atom={atom} source={{ s: 'v', href: '/x' }} index={0} level="item" media={media} />,
      )
      // A kind that silently rendered null (a flipped condition, a bad early
      // return) would make the forEach below iterate zero times and the
      // expect inside it never run — this assertion is what makes such a
      // regression fail instead of passing vacuously.
      const parts = container.querySelectorAll('[data-nb-part]')
      expect(parts.length).toBeGreaterThan(0)
      parts.forEach((el) => {
        expect(isNbPart(el.getAttribute('data-nb-part')!)).toBe(true)
      })
      cleanup()
    }
  })
})

describe('media atom', () => {
  const mediaAtom = {
    kind: 'media' as const,
    aspect: '4:5' as const,
    fit: 'cover' as const,
    slot: { name: 'image', label: 'Image' },
  }
  // Carries the `sizes` variants a real Payload Media doc has after ingest
  // processing (src/collections/Media.ts), not just `{ id, url, alt }` — those
  // are what `mediaSrcSet` builds a srcset from, and a fixture without them
  // makes every srcSet assertion below unfalsifiable.
  const doc = {
    id: 7,
    url: '/media/hat.jpg',
    alt: 'A straw hat',
    width: 1600,
    sizes: {
      card: { url: '/media/hat-400.jpg', width: 400 },
      hero: { url: '/media/hat-1200.jpg', width: 1200 },
    },
  }
  const map = new Map([['7', doc]])

  it('renders a resolved document with srcSet, sizes, alt and lazy loading', () => {
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 7 }} index={0} level="item" media={map} />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img!.getAttribute('src')).toBe('/media/hat.jpg')
    expect(img!.getAttribute('alt')).toBe('A straw hat')
    expect(img!.getAttribute('loading')).toBe('lazy')
    // The exact srcset, ascending by width and including the main file. Asserted
    // as a value, not for truthiness: `sizes` below is a hardcoded literal in
    // the component and cannot fail, so it was carrying no weight, while
    // `srcSet` — the attribute that actually depends on the resolved document —
    // was never asserted anywhere on this branch. Dropping `sizes` from
    // `RecipeMediaDoc`, or from the projection `resolveRecipeMedia` casts to,
    // renders this attribute absent and fails here.
    expect(img!.getAttribute('srcSet')).toBe(
      '/media/hat-400.jpg 400w, /media/hat-1200.jpg 1200w, /media/hat.jpg 1600w',
    )
    expect(img!.getAttribute('sizes')).toBe('(min-width: 640px) 50vw, 100vw')
  })

  it('omits srcSet entirely for a document with no generated variants', () => {
    // Pre-ingest media (uploaded before the pipeline shipped) has no `sizes`.
    // `mediaSrcSet` returns undefined and React drops the attribute — the image
    // must still render from its plain `src` rather than disappear.
    const bare = new Map([['8', { id: 8, url: '/media/old.jpg', alt: 'Old upload' }]])
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 8 }} index={0} level="item" media={bare} />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img!.getAttribute('src')).toBe('/media/old.jpg')
    expect(img!.hasAttribute('srcSet')).toBe(false)
  })

  it('matches a numeric id against a string-keyed map', () => {
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: '7' }} index={0} level="item" media={map} />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/media/hat.jpg')
  })

  it('renders nothing when the document is unresolvable', () => {
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 99 }} index={0} level="item" media={map} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when a resolved document has no url', () => {
    // A distinct failure mode from "the id is missing from the map"
    // (covered above): here the map DOES have an entry for the id, but the
    // document itself is partially written or mid-migration and lacks a
    // `url` — a real shape a Media doc can take, not a hypothetical. A
    // guard narrowed from `if (!doc?.url) return null` to `if (!doc) return
    // null` would still pass every other test in this file (they never
    // exercise a present-but-urlless doc) while rendering a broken `<img>`
    // here. See the discrimination check in task-3-report.md.
    const noUrlDoc = { id: 8, url: null, alt: 'Pending upload' }
    const noUrlMap = new Map([['8', noUrlDoc]])
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 8 }} index={0} level="item" media={noUrlMap} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no media map was supplied', () => {
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 7 }} index={0} level="item" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('puts data-nb-part on the wrapping div, not the img', () => {
    // The brief is explicit that the part moves off the <img> onto the
    // wrapper (matching the icon atom's existing convention) — a regression
    // that put it back on the <img> (the pre-Task-3 shape) would split the
    // wrapper from the part the published nb-hooks/1 contract promises, and
    // every other assertion in this file (which only check the part name is
    // present, or read the <img>'s src) would miss it.
    const { container } = render(
      <RecipeAtom atom={mediaAtom} source={{ image: 7 }} index={0} level="item" media={map} />,
    )
    const part = container.querySelector('[data-nb-part="item-media"]')
    expect(part?.tagName).toBe('DIV')
    expect(part?.querySelector('img')).toBeTruthy()
    expect(container.querySelector('img')?.hasAttribute('data-nb-part')).toBe(false)
  })
})

describe('link and button destinations', () => {
  const linkAtom = {
    kind: 'link' as const,
    slot: { name: 'label', label: 'Label' },
    hrefSlot: { name: 'href', label: 'URL' },
  }

  const buttonAtom = {
    kind: 'button' as const,
    style: 'primary' as const,
    slot: { name: 'label', label: 'Label' },
    hrefSlot: { name: 'href', label: 'URL' },
  }

  it('renders the destination from its hrefSlot', () => {
    const { container } = render(
      <RecipeAtom atom={linkAtom} source={{ label: 'Read more', href: '/blog' }} index={0} level="item" />,
    )
    const a = container.querySelector('a')
    expect(a).toBeTruthy()
    expect(a!.getAttribute('href')).toBe('/blog')
    expect(a!.textContent).toBe('Read more')
  })

  it('degrades to plain text when the destination is absent', () => {
    const { container } = render(
      <RecipeAtom atom={linkAtom} source={{ label: 'Read more' }} index={0} level="item" />,
    )
    expect(container.querySelector('a')).toBeNull()
    // Still marked and still readable — a missing URL must not swallow the copy.
    const part = container.querySelector('[data-nb-part="link"]')
    expect(part).toBeTruthy()
    expect(part!.textContent).toBe('Read more')
  })

  it('renders nothing when the label is absent', () => {
    const { container } = render(
      <RecipeAtom atom={linkAtom} source={{ href: '/blog' }} index={0} level="item" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the label is whitespace-only', () => {
    const { container } = render(
      <RecipeAtom atom={linkAtom} source={{ label: '   ', href: '/blog' }} index={0} level="item" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('degrades to plain text when the destination is whitespace-only', () => {
    const { container } = render(
      <RecipeAtom atom={linkAtom} source={{ label: 'Read more', href: '   ' }} index={0} level="item" />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[data-nb-part="link"]')?.textContent).toBe('Read more')
  })

  it('degrades to plain text rather than emitting an unsafe scheme, even though a label and a value are both present', () => {
    // Regression guard for the safe-href wiring at the call site: a
    // javascript: URL is exactly the shape a stored href must never reach an
    // <a> tag with (see src/lib/safe-href.ts).
    const { container } = render(
      <RecipeAtom
        atom={linkAtom}
        source={{ label: 'Read more', href: 'javascript:alert(document.cookie)' }}
        index={0}
        level="item"
      />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[data-nb-part="link"]')?.textContent).toBe('Read more')
  })

  // button's parse and render paths are near-identical copies of link's, so
  // the same three destination cases are mirrored here — a typo unique to
  // this branch (e.g. checking `slot` twice instead of `hrefSlot`) would
  // otherwise pass every link-only test above.
  it('button: renders the destination from its hrefSlot', () => {
    const { container } = render(
      <RecipeAtom atom={buttonAtom} source={{ label: 'Shop now', href: '/shop' }} index={0} level="item" />,
    )
    const a = container.querySelector('a')
    expect(a).toBeTruthy()
    expect(a!.getAttribute('href')).toBe('/shop')
    expect(a!.textContent).toBe('Shop now')
  })

  it('button: degrades to plain text when the destination is absent', () => {
    const { container } = render(
      <RecipeAtom atom={buttonAtom} source={{ label: 'Shop now' }} index={0} level="item" />,
    )
    expect(container.querySelector('a')).toBeNull()
    const part = container.querySelector('[data-nb-part="cta"]')
    expect(part).toBeTruthy()
    expect(part!.textContent).toBe('Shop now')
  })

  it('button: renders nothing when the label is absent', () => {
    const { container } = render(
      <RecipeAtom atom={buttonAtom} source={{ href: '/shop' }} index={0} level="item" />,
    )
    expect(container.firstChild).toBeNull()
  })
})
