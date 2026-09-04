// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { RecipeSection } from './RecipeSection'
import type { SectionRecipe } from './types'

afterEach(cleanup)

// `payload` is unused here — RecipeSection never reads ctx.payload, only
// CustomSectionComponent (the resolver caller) does — but BlockContext
// requires it, so a stub satisfies the type without booting Payload.
const ctx = { tenantId: 1, currency: 'AED', premiumSections: true, payload: {} as unknown as import('payload').Payload }

const recipe: SectionRecipe = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
  items: {
    source: { kind: 'static', count: 3 },
    layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
    template: [
      { kind: 'heading', level: 3, size: 'sm', slot: { name: 'name', label: 'Name' } },
      { kind: 'text', size: 'sm', slot: { name: 'copy', label: 'Copy' } },
    ],
  },
}

describe('RecipeSection', () => {
  it('renders the header heading and one wrapper per item', () => {
    const { container } = render(
      <RecipeSection
        recipe={recipe}
        content={{ header: { title: 'Why us' }, items: [{ name: 'A', copy: 'a' }, { name: 'B', copy: 'b' }] }}
        ctx={ctx}
      />,
    )
    expect(container.querySelector('[data-nb-part="heading"]')?.textContent).toBe('Why us')
    expect(container.querySelectorAll('[data-nb-part="item"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-nb-part="item-heading"]')).toHaveLength(2)
  })

  it('renders items in content order', () => {
    const { container } = render(
      <RecipeSection recipe={recipe} content={{ items: [{ name: 'First' }, { name: 'Second' }] }} ctx={ctx} />,
    )
    const headings = [...container.querySelectorAll('[data-nb-part="item-heading"]')].map((e) => e.textContent)
    expect(headings).toEqual(['First', 'Second'])
  })

  it('applies the scheme vars so a recipe section is theme-aware', () => {
    const { container } = render(<RecipeSection recipe={recipe} content={{ items: [] }} ctx={ctx} />)
    const root = container.firstElementChild as HTMLElement
    // Scheme is the wrapper's job (src/blocks/index.tsx), not the section's.
    // Emitting it here too would split data-nb-block and data-scheme across two
    // elements and break the published [data-nb-block][data-scheme] idiom.
    expect(root.getAttribute('data-scheme')).toBeNull()
    expect(root.getAttribute('style') ?? '').not.toContain('--section-')
    // The section still renders — without this, the two assertions above would
    // also hold for a component that returned nothing at all.
    expect(root.className).toContain('max-w-')
  })

  it('renders nothing when there is no header and no items', () => {
    const bare: SectionRecipe = { version: 1, container: recipe.container }
    const { container } = render(<RecipeSection recipe={bare} content={{}} ctx={ctx} />)
    expect(container.firstChild).toBeNull()
  })

  it('ignores content slots the recipe does not declare', () => {
    const { container } = render(
      <RecipeSection recipe={recipe} content={{ items: [{ name: 'A', rogue: '<script>' }] }} ctx={ctx} />,
    )
    // Both halves: the declared slot's value must still render (otherwise a
    // regression that renders nothing at all would also satisfy the
    // "no script" half below and pass for the wrong reason)...
    expect(container.textContent).toContain('A')
    // ...and the undeclared slot must never appear.
    expect(container.textContent).not.toContain('script')
  })

  it('never emits a literal "undefined" column class for a non-finite column count', () => {
    const nanRecipe: SectionRecipe = {
      ...recipe,
      items: {
        ...recipe.items!,
        layout: { pattern: 'grid', columns: { mobile: NaN, tablet: 2, desktop: 3 }, gap: 'normal' },
      },
    }
    const { container } = render(
      <RecipeSection recipe={nanRecipe} content={{ items: [{ name: 'A', copy: 'a' }] }} ctx={ctx} />,
    )
    const itemsWrapper = container.querySelector('[data-nb-part="item"]')?.parentElement
    // Presence check first: without it, a regression that renders zero items
    // (or emits a different part name) makes `itemsWrapper` undefined, `?? ''`
    // yields `''`, and the className assertion below passes having proved
    // nothing — the exact vacuous-pass shape this suite exists to close.
    expect(itemsWrapper).toBeTruthy()
    expect(itemsWrapper?.className ?? '').not.toContain('undefined')
  })

  it('falls back to no items, rather than throwing, when content.items is not an array', () => {
    const { container } = render(
      <RecipeSection recipe={recipe} content={{ items: {} as never }} ctx={ctx} />,
    )
    expect(container.querySelectorAll('[data-nb-part="item"]')).toHaveLength(0)
  })

  it('renders at most source.count items for a static source, even when content has more', () => {
    const capped: SectionRecipe = {
      ...recipe,
      items: { ...recipe.items!, source: { kind: 'static', count: 1 } },
    }
    const { container } = render(
      <RecipeSection
        recipe={capped}
        content={{ items: [{ name: 'A', copy: 'a' }, { name: 'B', copy: 'b' }, { name: 'C', copy: 'c' }] }}
        ctx={ctx}
      />,
    )
    expect(container.querySelectorAll('[data-nb-part="item"]')).toHaveLength(1)
  })

  it('treats a header with no usable slots as absent, not as a reason to render an empty section', () => {
    // Simulates what parseHeader (parse.ts) returns when every one of a
    // header's sub-slots was dropped as malformed: `{}`, which is truthy.
    const bare: SectionRecipe = { version: 1, container: recipe.container, header: {} }
    const { container } = render(<RecipeSection recipe={bare} content={{}} ctx={ctx} />)
    expect(container.firstChild).toBeNull()
  })
})
