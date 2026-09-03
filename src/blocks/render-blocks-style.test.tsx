/** @vitest-environment jsdom */
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderBlocks, type BlockContext } from './index'

// Stub the data-access boundary so ProductGrid/Component's listProducts import
// doesn't boot Payload and require PAYLOAD_SECRET in the test environment.
vi.mock('@/lib/storefront', () => ({
  getStore: vi.fn(),
  storeOrigin: vi.fn(),
  resolveHost: vi.fn(),
}))

afterEach(cleanup)

const ctx: BlockContext = {
  tenantId: 1,
  currency: 'AED',
  premiumSections: true,
  payload: {} as unknown as import('payload').Payload,
}

describe('RenderBlocks style resolution', () => {
  it('merges a per-instance blockStyles override into the wrapper style', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[{ id: 'a', blockType: 'testimonials', items: [] }]}
        ctx={ctx}
        blockStyles={{ a: { heading: { size: 'xl' } } }}
      />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.style.getPropertyValue('--bs-heading-size')).toBe('clamp(1.5rem, 3vw, 1.875rem)')
  })

  it('emits no --bs-* vars for a block with no override', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[{ id: 'b', blockType: 'testimonials', items: [] }]}
        ctx={ctx}
        blockStyles={{ a: { heading: { size: 'xl' } } }}
      />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]') as HTMLElement
    expect(wrapper).toBeTruthy()
    const bsVars = wrapper.style.cssText
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('--bs-'))
    expect(bsVars).toEqual([])
  })

  it('merges store-wide styleDefaults under a per-instance blockStyles override', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[{ id: 'a', blockType: 'testimonials', items: [] }]}
        ctx={ctx}
        styleDefaults={{ testimonials: { heading: { weight: '700' } } }}
        blockStyles={{ a: { heading: { size: 'xl' } } }}
      />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]') as HTMLElement
    expect(wrapper.style.getPropertyValue('--bs-heading-size')).toBe('clamp(1.5rem, 3vw, 1.875rem)')
    expect(wrapper.style.getPropertyValue('--bs-heading-weight')).toBe('700')
  })

  it('emits data-nb-block-id from the block id for click-to-select', () => {
    const { container } = render(
      <RenderBlocks
        blocks={[{ blockType: 'testimonials', id: 'blk_123' } as any]}
        ctx={{} as any}
      />,
    )
    const wrapper = container.querySelector('[data-nb-block="testimonials"]') as HTMLElement
    expect(wrapper.getAttribute('data-nb-block-id')).toBe('blk_123')
  })
})
