import { describe, it, expect } from 'vitest'
import { createSourceRegistry, sourceRegistry } from './source-registry'
import type { ImportSource } from './types'

function fakeSource(id: string, label = `${id} label`): ImportSource {
  return {
    id,
    label,
    detect: async () => null,
    listProducts: async function* () {},
  }
}

describe('createSourceRegistry', () => {
  it('resolves a source by id', () => {
    const shopify = fakeSource('shopify')
    const registry = createSourceRegistry([shopify, fakeSource('woocommerce')])

    expect(registry.get('shopify')).toBe(shopify)
  })

  it('returns null for an unknown id rather than throwing', () => {
    const registry = createSourceRegistry([fakeSource('shopify')])

    expect(registry.get('magento')).toBeNull()
  })

  it('throws a named error when a required source is missing', () => {
    const registry = createSourceRegistry([fakeSource('shopify')])

    expect(() => registry.require('magento')).toThrow(/magento/)
  })

  it('lists sources in registration order', () => {
    const registry = createSourceRegistry([
      fakeSource('shopify'),
      fakeSource('woocommerce'),
      fakeSource('squarespace'),
    ])

    expect(registry.list().map((s) => s.id)).toEqual(['shopify', 'woocommerce', 'squarespace'])
  })

  // Two adapters claiming one id means one of them silently never runs. Better
  // to fail at import time than to debug a source that "does nothing".
  it('refuses duplicate ids', () => {
    expect(() => createSourceRegistry([fakeSource('shopify'), fakeSource('shopify')])).toThrow(
      /duplicate/i,
    )
  })
})

describe('the wired registry', () => {
  // Holds whether there are zero sources or ten, and starts failing the moment
  // Task 3 or Task 4 registers an adapter incorrectly.
  it('has a unique id and a usable label for every registered source', () => {
    const ids = sourceRegistry.list().map((s) => s.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const source of sourceRegistry.list()) {
      expect(source.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(source.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('resolves every source it lists', () => {
    for (const source of sourceRegistry.list()) {
      expect(sourceRegistry.get(source.id)).toBe(source)
    }
  })
})
