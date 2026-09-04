import { describe, expect, it } from 'vitest'
import { lexicalToPlainText, buildProductJsonLd } from './structured-data'

describe('lexicalToPlainText', () => {
  it('concatenates text nodes across the tree', () => {
    const data = { root: { children: [
      { children: [{ text: 'Hello' }, { text: 'world' }] },
      { children: [{ text: 'again' }] },
    ] } }
    expect(lexicalToPlainText(data)).toBe('Hello world again')
  })
  it('returns empty string for empty/invalid input', () => {
    expect(lexicalToPlainText(null)).toBe('')
    expect(lexicalToPlainText({})).toBe('')
  })
})

describe('buildProductJsonLd', () => {
  const base = {
    name: 'Tee', images: ['https://s/img.png'], currency: 'INR',
    url: 'https://s/products/tee', storeName: 'S', specifications: [] as { label: string; value: string }[],
  }

  it('emits a single Offer when there are no variants', () => {
    const node = buildProductJsonLd({ ...base, price: 1000, stock: 3, variants: [] })
    expect(node['@type']).toBe('Product')
    expect(node.offers).toMatchObject({ '@type': 'Offer', price: 10, priceCurrency: 'INR', availability: 'https://schema.org/InStock' })
  })

  it('emits an AggregateOffer across variants', () => {
    const node = buildProductJsonLd({
      ...base, price: 1000, stock: 0,
      variants: [{ price: 1000, stock: 0 }, { price: 1400, stock: 2 }],
    })
    expect(node.offers).toMatchObject({
      '@type': 'AggregateOffer', lowPrice: 10, highPrice: 14, offerCount: 2,
      priceCurrency: 'INR', availability: 'https://schema.org/InStock',
    })
  })

  it('publishes a gift card as InStock even though its stock is 0', () => {
    const node = buildProductJsonLd({
      ...base, price: 5000, stock: 0, issuesGiftCard: true, variants: [],
    })
    expect(node.offers).toMatchObject({ availability: 'https://schema.org/InStock' })
  })

  it('publishes gift-card DENOMINATIONS as InStock even though every variant is at 0', () => {
    const node = buildProductJsonLd({
      ...base, price: 5000, stock: 0, issuesGiftCard: true,
      variants: [{ price: 5000, stock: 0 }, { price: 10000, stock: 0 }],
    })
    expect(node.offers).toMatchObject({
      '@type': 'AggregateOffer', availability: 'https://schema.org/InStock',
    })
  })

  it('still reports a NORMAL zero-stock product as OutOfStock', () => {
    const node = buildProductJsonLd({ ...base, price: 1000, stock: 0, variants: [] })
    expect(node.offers).toMatchObject({ availability: 'https://schema.org/OutOfStock' })
    const withVariants = buildProductJsonLd({
      ...base, price: 1000, stock: 0, variants: [{ price: 1000, stock: 0 }],
    })
    expect(withVariants.offers).toMatchObject({ availability: 'https://schema.org/OutOfStock' })
  })

  it('maps specifications to additionalProperty', () => {
    const node = buildProductJsonLd({
      ...base, price: 1000, stock: 1, variants: [],
      specifications: [{ label: 'Material', value: 'Cotton' }],
    })
    expect(node.additionalProperty).toEqual([{ '@type': 'PropertyValue', name: 'Material', value: 'Cotton' }])
  })
})
