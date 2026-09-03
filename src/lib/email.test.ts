import { afterEach, describe, expect, it } from 'vitest'
import { platformFrom, composeNewStoreAlert } from './email'

const orig = process.env.RESEND_FROM_EMAIL
afterEach(() => { if (orig === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = orig })

describe('platformFrom', () => {
  it('defaults to the Niblr sender', () => {
    delete process.env.RESEND_FROM_EMAIL
    expect(platformFrom()).toBe('Niblr <noreply@mail.niblr.store>')
  })
  it('honors RESEND_FROM_EMAIL override', () => {
    process.env.RESEND_FROM_EMAIL = 'Niblr <onboarding@resend.dev>'
    expect(platformFrom()).toBe('Niblr <onboarding@resend.dev>')
  })
})

describe('composeNewStoreAlert', () => {
  const base = {
    storeName: 'SD Bakery',
    slug: 'sdbakery',
    ownerEmail: 'owner@example.com',
    planLabel: 'Premium',
    storeUrl: 'https://sdbakery.niblr.store',
    adminUrl: 'https://niblr.store/admin/collections/tenants/6',
  }

  it('subject names the store and slug', () => {
    expect(composeNewStoreAlert(base).subject).toBe('🎉 New store: SD Bakery (sdbakery)')
  })
  it('replies to the owner so you can respond directly', () => {
    expect(composeNewStoreAlert(base).replyTo).toBe('owner@example.com')
  })
  it('body includes the storefront URL, owner, plan, and admin link', () => {
    const { html } = composeNewStoreAlert(base)
    expect(html).toContain('https://sdbakery.niblr.store')
    expect(html).toContain('owner@example.com')
    expect(html).toContain('Premium')
    expect(html).toContain('https://niblr.store/admin/collections/tenants/6')
    expect(html).toContain('SD Bakery')
  })
})
