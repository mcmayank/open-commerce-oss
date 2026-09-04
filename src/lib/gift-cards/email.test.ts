import { describe, expect, it } from 'vitest'
import { renderGiftCardEmail } from './email'

const args = {
  storeName: 'SD Bakery',
  storeUrl: 'https://sdbakery.niblr.store',
  recipientName: 'Sam',
  message: 'Happy birthday!',
  currency: 'AED',
  cards: [{ code: 'ABCD1234EFGH5678', amountMinor: 5000 }],
}

describe('renderGiftCardEmail', () => {
  it('names the store in the subject', () => {
    expect(renderGiftCardEmail(args).subject).toContain('SD Bakery')
  })

  it('includes every code exactly once', () => {
    const two = { ...args, cards: [...args.cards, { code: 'ZZZZ9999YYYY8888', amountMinor: 10000 }] }
    const { html } = renderGiftCardEmail(two)
    expect(html.match(/ABCD1234EFGH5678/g)).toHaveLength(1)
    expect(html.match(/ZZZZ9999YYYY8888/g)).toHaveLength(1)
  })

  it('formats the amount in major units with its currency', () => {
    expect(renderGiftCardEmail(args).text).toContain('AED 50.00')
  })

  it('includes the sender message when there is one, and omits the block when not', () => {
    expect(renderGiftCardEmail(args).text).toContain('Happy birthday!')
    expect(renderGiftCardEmail({ ...args, message: undefined }).text).not.toContain('undefined')
  })
})
