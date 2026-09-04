import { describe, expect, it } from 'vitest'
import { renderCampaignEmail } from './render'

describe('renderCampaignEmail', () => {
  const defaults = {
    subject: 'Hello World',
    bodyHtml: '<p>Check out our new products!</p>',
    storeName: 'Acme Store',
    unsubscribeUrl: 'https://example.com/unsubscribe?token=abc123',
  }

  describe('subject passthrough', () => {
    it('returns the subject unchanged', () => {
      const result = renderCampaignEmail(defaults)
      expect(result.subject).toBe('Hello World')
    })

    it('returns a non-empty subject from input', () => {
      const result = renderCampaignEmail({ ...defaults, subject: 'Big Summer Sale 🎉' })
      expect(result.subject).toBe('Big Summer Sale 🎉')
    })
  })

  describe('html contains body', () => {
    it('includes the bodyHtml verbatim', () => {
      const result = renderCampaignEmail(defaults)
      expect(result.html).toContain('<p>Check out our new products!</p>')
    })

    it('includes multi-element body html', () => {
      const body = '<h2>Sale</h2><p>Buy now</p>'
      const result = renderCampaignEmail({ ...defaults, bodyHtml: body })
      expect(result.html).toContain(body)
    })
  })

  describe('html contains storeName', () => {
    it('includes the storeName in the html', () => {
      const result = renderCampaignEmail(defaults)
      expect(result.html).toContain('Acme Store')
    })

    it('escapes HTML-special characters in storeName', () => {
      const result = renderCampaignEmail({ ...defaults, storeName: '<Evil & Co>' })
      // Should NOT contain raw unescaped chars
      expect(result.html).not.toContain('<Evil & Co>')
      expect(result.html).toContain('&lt;Evil &amp; Co&gt;')
    })

    it('escapes double quotes in storeName', () => {
      const result = renderCampaignEmail({ ...defaults, storeName: 'Say "Hello"' })
      expect(result.html).toContain('Say &quot;Hello&quot;')
    })
  })

  describe('html contains unsubscribe link', () => {
    it('contains an anchor with href pointing to unsubscribeUrl', () => {
      const result = renderCampaignEmail(defaults)
      expect(result.html).toContain(`href="${defaults.unsubscribeUrl}"`)
    })

    it('the unsubscribe anchor has text "Unsubscribe"', () => {
      const result = renderCampaignEmail(defaults)
      expect(result.html).toContain('>Unsubscribe<')
    })

    it('uses the provided unsubscribeUrl verbatim in the href', () => {
      const url = 'https://shop.mystore.com/unsubscribe?token=xyz&tid=1'
      const result = renderCampaignEmail({ ...defaults, unsubscribeUrl: url })
      expect(result.html).toContain(`href="${url}"`)
    })
  })

  describe('html structure', () => {
    it('returns a valid HTML document string (starts with DOCTYPE or html tag)', () => {
      const result = renderCampaignEmail(defaults)
      const trimmed = result.html.trim().toLowerCase()
      expect(trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')).toBe(true)
    })

    it('includes a physical address placeholder for CAN-SPAM compliance', () => {
      const result = renderCampaignEmail(defaults)
      // Must contain some physical address content — we check for a recognizable placeholder
      expect(result.html.toLowerCase()).toMatch(/address|123|physical/i)
    })
  })
})
