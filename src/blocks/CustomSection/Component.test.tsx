/** @vitest-environment jsdom */
import type { ReactElement } from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CustomSectionComponent } from './Component'
import type { BlockContext } from '@/blocks/index'

afterEach(cleanup)

// None of the recipes below (except the media-bearing one) declare a `media`
// atom, so `collectMediaIds` returns `[]` and `resolveRecipeMedia` short-circuits
// before ever calling `payload.find` — this stub is never invoked by those tests.
const ctx: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: { find: async () => ({ docs: [] }) } as unknown as BlockContext['payload'],
}

const recipe = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
  items: {
    source: { kind: 'static', count: 3 },
    layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
    template: [{ kind: 'heading', level: 3, size: 'md', slot: { name: 'name', label: 'Name' } }],
  },
}

const published = { _status: 'published', recipe }

// A recipe whose item template includes a media atom, for the media-resolution tests.
const recipeWithMedia = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
  items: {
    source: { kind: 'static', count: 3 },
    layout: { pattern: 'grid', columns: { mobile: 1, tablet: 2, desktop: 3 }, gap: 'normal' },
    template: [
      { kind: 'media', aspect: '4:5', fit: 'cover', slot: { name: 'image', label: 'Image' } },
      { kind: 'heading', level: 3, size: 'md', slot: { name: 'title', label: 'Title' } },
    ],
  },
}

const publishedWithMedia = { _status: 'published', recipe: recipeWithMedia }

const ctxWithPayload: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {
    find: async () => ({ docs: [{ id: 7, url: '/a.jpg', alt: 'a' }] }),
  } as unknown as BlockContext['payload'],
}

describe('CustomSectionComponent', () => {
  it('renders the definition’s recipe with the instance’s content', async () => {
    const el = await CustomSectionComponent({
      block: {
        definition: published,
        content: { header: { title: 'Our values' }, items: [{ name: 'Care' }] },
      } as never,
      ctx,
    })
    const { container } = render(el as ReactElement)
    expect(container.querySelector('[data-nb-part="heading"]')?.textContent).toBe('Our values')
    expect(container.querySelector('[data-nb-part="item-heading"]')?.textContent).toBe('Care')
  })

  it('drops content slots the recipe does not declare', async () => {
    const el = await CustomSectionComponent({
      block: {
        definition: published,
        content: { header: { title: 'Kept', ghost: 'Dropped' }, items: [] },
      } as never,
      ctx,
    })
    const { container } = render(el as ReactElement)
    expect(container.textContent).toContain('Kept')
    expect(container.textContent).not.toContain('Dropped')
  })

  it('renders nothing when the definition reference is orphaned', async () => {
    const el = await CustomSectionComponent({ block: { definition: 'still-an-id' } as never, ctx })
    const { container } = render(el)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the definition has never been published', async () => {
    const el = await CustomSectionComponent({
      block: { definition: { _status: 'draft', recipe }, content: {} } as never,
      ctx,
    })
    const { container } = render(el)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing, and does not throw, when the stored recipe is invalid', async () => {
    const el = await CustomSectionComponent({
      block: { definition: { _status: 'published', recipe: { nope: true } }, content: {} } as never,
      ctx,
    })
    const { container } = render(el)
    expect(container.firstChild).toBeNull()
  })

  it('renders images for a recipe whose media ids resolve', async () => {
    const el = await CustomSectionComponent({
      block: {
        definition: publishedWithMedia,
        content: { items: [{ image: 7, title: 'Hello' }] },
      } as never,
      ctx: ctxWithPayload,
    })
    const { container } = render(el as ReactElement)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.jpg')
  })

  it('renders the section without images when the media query throws', async () => {
    const failing: BlockContext = {
      ...ctxWithPayload,
      payload: {
        find: async () => {
          throw new Error('db down')
        },
      } as unknown as BlockContext['payload'],
    }
    const el = await CustomSectionComponent({
      block: {
        definition: publishedWithMedia,
        content: { items: [{ image: 7, title: 'Hello' }] },
      } as never,
      ctx: failing,
    })
    const { container } = render(el as ReactElement)
    expect(container.querySelector('img')).toBeNull()
    // The rest of the section still rendered — this is the assertion that
    // separates "degraded" from "returned null".
    expect(container.querySelector('[data-nb-part="item-heading"]')).toBeTruthy()
  })
})
