import { describe, it, expect } from 'vitest'
import { buildExportFiles, type ExportData } from './collect'

/** The store's own origin, as the route derives it from the request Host header. */
const ORIGIN = 'https://sdbakery.ae'

const empty: ExportData = {
  storeCurrency: 'AED',
  products: [],
  categories: [],
  orders: [],
  customers: [],
}

function fileNamed(files: { name: string; content: string }[], name: string) {
  const found = files.find((f) => f.name === name)
  if (!found) throw new Error(`no file named ${name}`)
  return found.content
}

describe('buildExportFiles', () => {
  it('always produces all seven files, headers only when empty', () => {
    const files = buildExportFiles(empty, ORIGIN)
    expect(files.map((f) => f.name)).toEqual([
      'products.csv',
      'product-variants.csv',
      'categories.csv',
      'orders.csv',
      'order-items.csv',
      'customers.csv',
      'README.txt',
    ])
    // An empty shop is a valid answer, not an error.
    expect(fileNamed(files, 'products.csv')).toBe(
      '﻿slug,title,description,status,price,currency,stock,category,imageUrls,specifications,variantCount\r\n',
    )
  })

  // The reason this module exists. Customers.passwordHash and magicLinkNonce
  // declare access.read = false, but overrideAccess bypasses field access.
  it('never exports customer secrets', () => {
    const files = buildExportFiles({
      ...empty,
      customers: [
        {
          email: 'a@b.com',
          name: 'Ada',
          createdAt: '2026-07-01T00:00:00Z',
          passwordHash: 'scrypt$SHOULD-NEVER-APPEAR',
          magicLinkNonce: 'NONCE-SHOULD-NEVER-APPEAR',
          addresses: [{ line1: '1 Main St', city: 'Dubai', postalCode: '00000', country: 'AE' }],
        },
      ],
    }, ORIGIN)
    const all = files.map((f) => f.content).join('\n')
    expect(all).not.toContain('SHOULD-NEVER-APPEAR')
    expect(all).not.toContain('passwordHash')
    expect(all).not.toContain('magicLinkNonce')
    expect(fileNamed(files, 'customers.csv')).toContain('a@b.com')
  })

  it('splits an order into one order row and one row per line item', () => {
    const files = buildExportFiles({
      ...empty,
      orders: [
        {
          orderNumber: 'A-1001',
          status: 'paid',
          currency: 'AED',
          email: 'buyer@example.com',
          subtotal: 3000,
          discountAmount: 0,
          shippingAmount: 500,
          taxAmount: 175,
          total: 3675,
          refundedAmount: 0,
          lineItems: [
            { productId: 'p1', title: 'Loaf', unitPrice: 1000, qty: 2, lineTotal: 2000 },
            { productId: 'p2', title: 'Bun', variantTitle: 'Large', unitPrice: 1000, qty: 1, lineTotal: 1000 },
          ],
        },
      ],
    }, ORIGIN)
    const orders = fileNamed(files, 'orders.csv').trim().split('\r\n')
    const items = fileNamed(files, 'order-items.csv').trim().split('\r\n')
    expect(orders).toHaveLength(2) // header + 1
    expect(items).toHaveLength(3) // header + 2
    expect(items[1]).toContain('A-1001')
    expect(items[2]).toContain('A-1001')
    // Money as an exact decimal, not minor units and not a float divide.
    expect(orders[1]).toContain('36.75')
  })

  it('keys variants to their product slug and flattens option values', () => {
    const files = buildExportFiles({
      ...empty,
      products: [
        {
          slug: 'tee',
          title: 'Tee',
          status: 'published',
          price: 5000,
          stock: 3,
          variants: [
            {
              title: 'Large / Blue',
              price: 5500,
              stock: 1,
              optionValues: [
                { option: 'Size', value: 'L' },
                { option: 'Colour', value: 'Blue' },
              ],
            },
          ],
        },
      ],
    }, ORIGIN)
    const variants = fileNamed(files, 'product-variants.csv').trim().split('\r\n')
    expect(variants).toHaveLength(2)
    expect(variants[1]).toContain('tee')
    expect(variants[1]).toContain('Size: L; Colour: Blue')
    expect(fileNamed(files, 'products.csv')).toContain('50.00')
  })

  // The fixtures here use the ROOT-RELATIVE shape Payload actually stores —
  // `/api/media/file/<name>` — not an absolute CDN address. An earlier version
  // of this test used `https://cdn/a.webp`, which exists nowhere in the product;
  // the docs were then written to describe that fixture and told merchants the
  // links pointed at a CDN they could download from. They pointed at nothing.
  it('flattens product images to semicolon-separated URLs, made absolute', () => {
    const files = buildExportFiles({
      ...empty,
      products: [
        {
          slug: 'tee',
          title: 'Tee',
          price: 100,
          images: [
            { url: '/api/media/file/tech-earbuds.webp' },
            { url: '/api/media/file/tech-keyboard.webp' },
          ],
          category: { title: 'Shirts' },
        },
      ],
    }, ORIGIN)
    const row = fileNamed(files, 'products.csv').trim().split('\r\n')[1]
    expect(row).toContain(
      'https://sdbakery.ae/api/media/file/tech-earbuds.webp;https://sdbakery.ae/api/media/file/tech-keyboard.webp',
    )
    expect(row).toContain('Shirts')
  })

  // A relative path in a CSV resolves to nothing when the merchant clicks it in
  // Excel. "Images come along as links" is the entire justification for leaving
  // the binaries out of the archive, so the link has to actually resolve.
  it('makes a relative category image URL absolute against the origin', () => {
    const files = buildExportFiles({
      ...empty,
      categories: [{ slug: 'shirts', title: 'Shirts', image: { url: '/api/media/file/cat.webp' } }],
    }, ORIGIN)
    const row = fileNamed(files, 'categories.csv').trim().split('\r\n')[1]
    expect(row).toContain('https://sdbakery.ae/api/media/file/cat.webp')
    // Guard against a doubled or missing prefix rather than only asserting presence.
    expect(row).not.toContain('https://sdbakery.aehttps://')
    expect(row.split(',').filter((c) => c.startsWith('/api/'))).toHaveLength(0)
  })

  // Pairs with requestOrigin's null-host case in route.test.ts.
  it('leaves a relative URL relative when the origin is empty, not prefixed with junk', () => {
    const files = buildExportFiles({
      ...empty,
      categories: [{ slug: 'shirts', title: 'Shirts', image: { url: '/api/media/file/cat.webp' } }],
    }, '')
    const row = fileNamed(files, 'categories.csv').trim().split('\r\n')[1]
    expect(row).toContain('/api/media/file/cat.webp')
    expect(row).not.toContain('undefined')
    expect(row).not.toContain('null')
  })

  // Keeps working if `disablePayloadAccessControl` is ever enabled, or media
  // moves behind a real CDN, both of which make `generateURL` emit absolutes.
  it('leaves an already-absolute media URL untouched', () => {
    const files = buildExportFiles({
      ...empty,
      products: [{ slug: 'tee', title: 'Tee', price: 100, images: [{ url: 'https://cdn.example.com/a.webp' }] }],
      categories: [{ slug: 'shirts', title: 'Shirts', image: { url: 'https://cdn.example.com/cat.webp' } }],
    }, ORIGIN)
    const productRow = fileNamed(files, 'products.csv').trim().split('\r\n')[1]
    const categoryRow = fileNamed(files, 'categories.csv').trim().split('\r\n')[1]
    expect(productRow).toContain('https://cdn.example.com/a.webp')
    expect(categoryRow).toContain('https://cdn.example.com/cat.webp')
    expect(productRow).not.toContain('sdbakery.ae')
    expect(categoryRow).not.toContain('sdbakery.ae')
  })

  it('names every file in the README', () => {
    const readme = fileNamed(buildExportFiles(empty, ORIGIN), 'README.txt')
    for (const name of ['products.csv', 'product-variants.csv', 'categories.csv', 'orders.csv', 'order-items.csv', 'customers.csv']) {
      expect(readme).toContain(name)
    }
    // The two documented limits.
    expect(readme).toMatch(/image/i)
    expect(readme).toMatch(/first address/i)
  })

  // customerName once duplicated customerEmail when orders were read at
  // depth 0 and the relationship came back as a bare id.
  it('exports a customer name distinct from the email', () => {
    const files = buildExportFiles({
      ...empty,
      orders: [
        {
          orderNumber: 'A-1',
          currency: 'AED',
          email: 'buyer@example.com',
          customer: { name: 'Ada Lovelace' },
          total: 1000,
          lineItems: [],
        },
      ],
    }, ORIGIN)
    const row = fileNamed(files, 'orders.csv').trim().split('\r\n')[1]
    expect(row).toContain('buyer@example.com')
    expect(row).toContain('Ada Lovelace')
  })

  // The export is the merchant's escape hatch. One legacy float must not cost
  // them the whole archive — but a bare 36.75 is byte-identical to a
  // correctly formatted AED 36.75 while being 100x off, so the degraded cell
  // must be tagged, not just present.
  it('degrades a non-integer amount instead of failing the export, tagged so it is not mistaken for a formatted amount', () => {
    const files = buildExportFiles({
      ...empty,
      orders: [{ orderNumber: 'A-1', currency: 'AED', total: 36.75, lineItems: [] }],
    }, ORIGIN)
    expect(fileNamed(files, 'orders.csv')).toContain('36.75 (raw)')
    expect(files).toHaveLength(7)
  })

  it('keeps every file header aligned with its rows', () => {
    const files = buildExportFiles({
      storeCurrency: 'AED',
      products: [
        {
          slug: 'tee',
          title: 'Tee',
          status: 'published',
          price: 1000,
          stock: 5,
          category: { title: 'Shirts' },
          images: [{ url: 'https://cdn/a.webp' }],
          specifications: [{ label: 'Material' /* no comma */, value: 'Cotton' }],
          variants: [
            {
              title: 'Large',
              price: 1100,
              stock: 2,
              optionValues: [{ option: 'Size', value: 'L' }],
            },
          ],
        },
      ],
      categories: [
        { slug: 'shirts', title: 'Shirts', description: 'Apparel', image: { url: 'https://cdn/cat.webp' } },
      ],
      orders: [
        {
          orderNumber: 'A-1001',
          status: 'paid',
          currency: 'AED',
          email: 'buyer@example.com',
          subtotal: 1000,
          discountAmount: 0,
          discountCode: '',
          shippingAmount: 0,
          taxAmount: 0,
          taxRate: 5,
          taxInclusive: true,
          total: 1000,
          refundedAmount: 0,
          paymentProvider: 'stripe',
          paidAt: '2026-01-01T00:00:00Z',
          fulfillment: { method: 'shipping' },
          trackingNumber: 'TRACK1',
          invoiceNumber: 'INV-1',
          invoiceIssuedAt: '2026-01-02T00:00:00Z',
          shippingAddress: {
            name: 'Ada Lovelace',
            line1: '1 Main St',
            line2: '',
            city: 'Dubai',
            state: 'Dubai',
            postalCode: '00000',
            country: 'AE',
            phone: '+971500000000',
          },
          lineItems: [
            { productId: 'p1', title: 'Loaf', variantTitle: '', unitPrice: 1000, qty: 1, lineTotal: 1000 },
          ],
        },
      ],
      customers: [
        {
          email: 'a@b.com',
          name: 'Ada Lovelace',
          createdAt: '2026-01-01T00:00:00Z',
          lastLoginAt: '2026-01-02T00:00:00Z',
          addresses: [
            { line1: '1 Main St', line2: '', city: 'Dubai', state: 'Dubai', postalCode: '00000', country: 'AE' },
          ],
        },
      ],
    }, ORIGIN)
    // None of the fixture values above contain a comma, so a naive split on
    // ',' is a valid column count for this fixture — a quoted comma would
    // break that assumption and make this test lie.
    for (const f of files.filter((x) => x.name.endsWith('.csv'))) {
      const lines = f.content.trim().split('\r\n')
      const headerCount = lines[0].split(',').length
      for (const line of lines.slice(1)) {
        expect(line.split(',').length, `${f.name}`).toBe(headerCount)
      }
    }
  })
})
