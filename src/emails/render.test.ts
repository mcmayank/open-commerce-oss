import { describe, expect, it } from 'vitest'
import { renderWelcome, renderVerify, renderPasswordReset, renderInvoice, renderOrderConfirmation, renderMagicLink } from './index'

describe('email render wrappers', () => {
  it('welcome links the admin button to the store subdomain (not the platform root) and links the address', async () => {
    const html = await renderWelcome({ storeName: 'Acme Co', slug: 'acme' })
    expect(html).toContain('Acme Co')
    // Admin button must target the store's own subdomain admin (host-bound), not root /admin.
    expect(html).toContain('https://acme.niblr.store/admin')
    expect(html).not.toContain('"https://niblr.store/admin"')
    // Store address is a clickable link to the storefront.
    expect(html).toContain('href="https://acme.niblr.store"')
    expect(html).toContain('acme.niblr.store')
  })
  it('verify contains the verify URL', async () => {
    const html = await renderVerify({ verifyUrl: 'https://x.test/verify?t=abc' })
    expect(html).toContain('https://x.test/verify?t=abc')
  })
  it('password reset contains the reset URL and store name', async () => {
    const html = await renderPasswordReset({ resetUrl: 'https://x.test/reset?t=1', storeName: 'Acme' })
    expect(html).toContain('https://x.test/reset?t=1')
    expect(html).toContain('Acme')
  })
  it('invoice contains the invoice number and total', async () => {
    const html = await renderInvoice({ invoiceNo: 'INV-7', storeName: 'Acme', orderNumber: 'ORD-1', total: '₹1,000.00' })
    expect(html).toContain('INV-7')
    expect(html).toContain('₹1,000.00')
  })
  it('order confirmation contains the order number, a line item, and the total', async () => {
    const order = {
      id: 1,
      email: 'buyer@example.com',
      orderNumber: 'ORD-1001',
      currency: 'INR',
      total: 150000,
      lineItems: [
        { title: 'Chocolate Cake', variantTitle: '1kg', qty: 2, unitPrice: 50000, lineTotal: 100000 },
        { title: 'Cupcake Box', qty: 1, unitPrice: 50000, lineTotal: 50000 },
      ],
      shippingAddress: { name: 'Jordan Lee', line1: '12 Baker St', city: 'Dubai', postalCode: '00000', country: 'AE' },
      fulfillment: {},
    } as unknown as import('@/payload-types').Order

    const html = await renderOrderConfirmation(order)
    expect(html).toContain('ORD-1001')
    expect(html).toContain('Chocolate Cake')
    expect(html).toContain('Jordan Lee')
    // total 150000 minor units → formatMoney(...,'INR'); assert the significant digits appear
    expect(html).toMatch(/1[,.]?500/)
  })
  it('renders the magic-link email with the url', async () => {
    const html = await renderMagicLink({ magicUrl: 'https://x.test/account/magic/confirm?token=abc', storeName: 'Test Store' })
    expect(html).toContain('https://x.test/account/magic/confirm?token=abc')
    expect(html).toContain('Test Store')
  })
})
