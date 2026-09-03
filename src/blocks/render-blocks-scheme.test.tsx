/** @vitest-environment jsdom */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { renderToReadableStream } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderBlocks, type BlockContext } from './index'

/**
 * `customSection` renders through an async server component
 * (`CustomSectionComponent`, Task 4 — it resolves media ids via a Payload
 * query) and React 19 refuses to mount an async function component on the
 * client ("Only Server Components can be async at the moment"), so
 * `<RenderBlocks>` + RTL's `render()` cannot exercise it under jsdom the way
 * the sync-block tests above do. `renderToReadableStream` (react-dom/server)
 * DOES support async Server Components — it is the real HTML-generation path
 * Next.js uses in production — so the two tests below render through it and
 * parse the resulting markup instead, keeping RenderBlocks itself (not a
 * hand-built stand-in) under test.
 */
async function streamToHtml(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let html = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value, { stream: true })
  }
  return html
}

// Stub the data-access boundary so ProductGrid/Component's listProducts import
// doesn't boot Payload and require PAYLOAD_SECRET in the test environment.
vi.mock('@/lib/storefront', () => ({
  getStore: vi.fn(),
  storeOrigin: vi.fn(),
  resolveHost: vi.fn(),
}))

afterEach(cleanup)

// `payload` is unused by the `testimonials` fixture this suite exercises,
// but BlockContext requires it, so a stub satisfies the type.
const ctx: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

/** `testimonials` is 'muted' in BLOCK_DEFAULT_SCHEME — a real default to override. */
describe('RenderBlocks scheme resolution', () => {
  it('uses BLOCK_DEFAULT_SCHEME when the block carries no scheme', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'a', blockType: 'testimonials', items: [] }]} ctx={ctx} />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper!.getAttribute('data-scheme')).toBe('muted')
  })

  it('lets an explicit block.scheme win over BLOCK_DEFAULT_SCHEME', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[{ id: 'a', blockType: 'testimonials', scheme: 'inverse', items: [] }]}
        ctx={ctx}
      />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper!.getAttribute('data-scheme')).toBe('inverse')
  })

  it('treats an empty-string scheme as absent, not as a scheme', () => {
    const { container } = render(
      <RenderBlocks blocks={[{ id: 'a', blockType: 'testimonials', scheme: '', items: [] }]} ctx={ctx} />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]')
    expect(wrapper).toBeTruthy()
    expect(wrapper!.getAttribute('data-scheme')).toBe('muted')
  })
})

const recipeFixture = {
  version: 1,
  container: { width: 'wide', padding: 'normal', scheme: 'muted', align: 'center' },
  header: { heading: { name: 'title', label: 'Title' } },
}

describe('a placed custom section', () => {
  it('puts data-nb-block and data-scheme on the SAME element', async () => {
    const stream = await renderToReadableStream(
      <RenderBlocks
        blocks={[
          {
            id: 'c1',
            blockType: 'customSection',
            scheme: 'inverse',
            definition: { _status: 'published', recipe: recipeFixture },
            content: { header: { title: 'Hello' } },
          },
        ]}
        ctx={ctx}
      />,
    )
    const doc = new DOMParser().parseFromString(await streamToHtml(stream), 'text/html')
    const wrapper = doc.querySelector('[data-nb-block="customSection"]')
    expect(wrapper).toBeTruthy()
    // The published idiom [data-nb-block="x"][data-scheme="y"] only matches when
    // both sit on one element. This is the assertion that proves it.
    expect(wrapper!.getAttribute('data-scheme')).toBe('inverse')
    // And the section actually rendered — otherwise the attribute check above
    // would hold for an empty wrapper.
    expect(doc.querySelector('[data-nb-part="heading"]')?.textContent).toBe('Hello')
  })

  it('renders no wrapper content for an unpublished definition, without throwing', async () => {
    const stream = await renderToReadableStream(
      <RenderBlocks
        blocks={[
          {
            id: 'c1',
            blockType: 'customSection',
            definition: { _status: 'draft', recipe: recipeFixture },
            content: {},
          },
        ]}
        ctx={ctx}
      />,
    )
    const doc = new DOMParser().parseFromString(await streamToHtml(stream), 'text/html')
    expect(doc.querySelector('[data-nb-part="heading"]')).toBeNull()
    // The wrapper is still emitted — RenderBlocks always wraps. Asserting this
    // separates "the section declined to render" from "the block was skipped
    // entirely", which the assertion above cannot tell apart on its own.
    expect(doc.querySelector('[data-nb-block="customSection"]')).toBeTruthy()
  })
})
