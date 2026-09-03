/**
 * Pure-function tests for the campaign send engine.
 * These tests cover the bits that are safe to run without a Payload/Resend connection:
 *  – buildBatchEntry: correct to/from/subject/html assembly per recipient
 *  – getNextCursor:   id-cursor advance logic
 *  – buildUnsubscribeUrl: URL shape for dev vs prod domains
 *
 * The Resend network call and Payload DB interaction are NOT tested here
 * (covered in Task 5 integration tests).
 */

import { beforeAll, describe, expect, it } from 'vitest'

// Set CREDENTIALS_ENCRYPTION_KEY before importing modules that need it
beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0'.repeat(64)
})

import { buildBatchEntry, buildUnsubscribeUrl, getNextCursor, shouldMarkSent } from './send-campaign'

// ── helpers ──────────────────────────────────────────────────────────────────

const baseEntryArgs = {
  contact: { id: 42, email: 'alice@example.com' },
  subject: 'Summer Sale',
  bodyHtml: '<p>Big discounts!</p>',
  storeName: 'Acme Store',
  fromName: 'Acme',
  fromEmail: 'hello@acme.com',
  tenantId: 'tenant-1',
  tenantSlug: 'acme',
  rootDomain: 'lvh.me:3000',
}

// ── buildBatchEntry ───────────────────────────────────────────────────────────

describe('buildBatchEntry', () => {
  describe('to field', () => {
    it('addresses the contact email', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.to).toEqual(['alice@example.com'])
    })

    it('uses a different contact email', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, contact: { id: 7, email: 'bob@shop.io' } })
      expect(entry.to).toEqual(['bob@shop.io'])
    })
  })

  describe('from field', () => {
    it('formats as "Name <email>"', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.from).toBe('Acme <hello@acme.com>')
    })

    it('uses a different fromName and fromEmail', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, fromName: 'Shop', fromEmail: 'noreply@shop.com' })
      expect(entry.from).toBe('Shop <noreply@shop.com>')
    })
  })

  describe('subject field', () => {
    it('passes through the campaign subject', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.subject).toBe('Summer Sale')
    })

    it('uses the provided subject verbatim', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, subject: 'New arrivals 🎉' })
      expect(entry.subject).toBe('New arrivals 🎉')
    })
  })

  describe('html field', () => {
    it('contains the bodyHtml', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.html).toContain('<p>Big discounts!</p>')
    })

    it('contains the storeName', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.html).toContain('Acme Store')
    })

    it('contains an unsubscribe href', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.html).toContain('href="')
      expect(entry.html).toContain('/unsubscribe?token=')
    })

    it('unsubscribe link is per-recipient (includes contact id in token)', () => {
      const entry1 = buildBatchEntry({ ...baseEntryArgs, contact: { id: 1, email: 'a@x.com' } })
      const entry2 = buildBatchEntry({ ...baseEntryArgs, contact: { id: 2, email: 'b@x.com' } })
      // Tokens will differ because contactId differs
      const getToken = (html: string) => html.match(/\/unsubscribe\?token=([^"]+)/)?.[1]
      expect(getToken(entry1.html)).not.toBe(getToken(entry2.html))
    })

    it('unsubscribe link uses the tenant slug and root domain', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, tenantSlug: 'myshop', rootDomain: 'example.com' })
      expect(entry.html).toContain('https://myshop.example.com/unsubscribe?token=')
    })
  })

  describe('headers field (List-Unsubscribe)', () => {
    it('includes a List-Unsubscribe header pointing to the API endpoint', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.headers).toBeDefined()
      expect(entry.headers['List-Unsubscribe']).toContain('/api/marketing/unsubscribe?token=')
      // Must be wrapped in angle brackets per RFC 2369
      expect(entry.headers['List-Unsubscribe'].startsWith('<')).toBe(true)
      expect(entry.headers['List-Unsubscribe'].endsWith('>')).toBe(true)
    })

    it('includes the List-Unsubscribe-Post header for one-click', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      expect(entry.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    })

    it('List-Unsubscribe URL uses http for dev domain', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, rootDomain: 'lvh.me:3000' })
      expect(entry.headers['List-Unsubscribe']).toContain('http://')
    })

    it('List-Unsubscribe URL uses https for production domain', () => {
      const entry = buildBatchEntry({ ...baseEntryArgs, rootDomain: 'example.com' })
      expect(entry.headers['List-Unsubscribe']).toContain('https://')
    })

    it('List-Unsubscribe URL is per-recipient (different tokens for different contacts)', () => {
      const e1 = buildBatchEntry({ ...baseEntryArgs, contact: { id: 1, email: 'a@x.com' } })
      const e2 = buildBatchEntry({ ...baseEntryArgs, contact: { id: 2, email: 'b@x.com' } })
      expect(e1.headers['List-Unsubscribe']).not.toBe(e2.headers['List-Unsubscribe'])
    })

    it('List-Unsubscribe URL token matches the unsubscribe link token in the email body', () => {
      const entry = buildBatchEntry(baseEntryArgs)
      // Extract token from HTML body link
      const bodyToken = entry.html.match(/\/unsubscribe\?token=([^"]+)/)?.[1]
      // Extract token from List-Unsubscribe header
      const headerToken = entry.headers['List-Unsubscribe'].match(/\/api\/marketing\/unsubscribe\?token=([^>]+)/)?.[1]
      expect(bodyToken).toBeDefined()
      expect(headerToken).toBeDefined()
      // Both should use the same token (same contact + tenant → same HMAC)
      expect(bodyToken).toBe(headerToken)
    })
  })
})

// ── getNextCursor ─────────────────────────────────────────────────────────────

describe('getNextCursor', () => {
  it('returns the id of the last contact in a single-item chunk', () => {
    expect(getNextCursor([{ id: 7 }])).toBe(7)
  })

  it('returns the id of the last contact in a multi-item chunk', () => {
    expect(getNextCursor([{ id: 1 }, { id: 5 }, { id: 99 }])).toBe(99)
  })

  it('advances from any arbitrary id', () => {
    const chunk = Array.from({ length: 100 }, (_, i) => ({ id: i + 1001 }))
    expect(getNextCursor(chunk)).toBe(1100)
  })

  it('throws on empty chunk (programming error guard)', () => {
    expect(() => getNextCursor([])).toThrow()
  })
})

// ── shouldMarkSent ────────────────────────────────────────────────────────────

describe('shouldMarkSent', () => {
  it('returns true when done and no failures (happy-path final chunk)', () => {
    expect(shouldMarkSent(true, 0)).toBe(true)
  })

  it('returns false when done but some failures (final chunk failed → stay sending)', () => {
    expect(shouldMarkSent(true, 1)).toBe(false)
  })

  it('returns false when done with many failures', () => {
    expect(shouldMarkSent(true, 100)).toBe(false)
  })

  it('returns false when not done and no failures (mid-run chunk)', () => {
    expect(shouldMarkSent(false, 0)).toBe(false)
  })

  it('returns false when not done and has failures (mid-run chunk with errors)', () => {
    expect(shouldMarkSent(false, 5)).toBe(false)
  })
})

// ── buildUnsubscribeUrl ───────────────────────────────────────────────────────

describe('buildUnsubscribeUrl', () => {
  it('uses http for lvh.me (dev)', () => {
    const url = buildUnsubscribeUrl('shop', '42', 'tenant-1', 'lvh.me:3000')
    expect(url.startsWith('http://')).toBe(true)
    expect(url).toContain('shop.lvh.me:3000/unsubscribe?token=')
  })

  it('uses http for localhost', () => {
    const url = buildUnsubscribeUrl('shop', '42', 'tenant-1', 'localhost:3000')
    expect(url.startsWith('http://')).toBe(true)
  })

  it('uses https for production domain', () => {
    const url = buildUnsubscribeUrl('shop', '42', 'tenant-1', 'myplatform.com')
    expect(url.startsWith('https://')).toBe(true)
    expect(url).toContain('shop.myplatform.com/unsubscribe?token=')
  })

  it('encodes the contactId in the token', () => {
    const url1 = buildUnsubscribeUrl('shop', '1', 'tenant-1', 'myplatform.com')
    const url2 = buildUnsubscribeUrl('shop', '2', 'tenant-1', 'myplatform.com')
    const getToken = (url: string) => url.split('?token=')[1]
    expect(getToken(url1)).not.toBe(getToken(url2))
  })

  it('includes the tenant slug in the host', () => {
    const url = buildUnsubscribeUrl('acme', '5', 'tenant-x', 'commerce.io')
    expect(url).toContain('acme.commerce.io')
  })
})
