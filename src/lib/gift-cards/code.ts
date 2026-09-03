import { createHmac, randomBytes } from 'crypto'

/**
 * Gift card codes are bearer money. Two rules follow.
 *
 * The plaintext is never stored: only an HMAC-SHA256 digest goes in the
 * database, so a database disclosure does not hand over spendable value. The
 * digest is deterministic (unlike a salted password hash) because redemption
 * must find a card BY its code.
 *
 * The alphabet excludes I, O and 0 — a code gets read off a phone screen and
 * typed by a human, and those three are where transcription errors come from.
 */
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 16

/** 16 chars from a 34-symbol alphabet ≈ 81 bits. Drawn from a CSPRNG. */
export function generateGiftCardCode(): { code: string; last4: string } {
  // Rejection-sample to keep the distribution uniform: 256 % 34 !== 0, so
  // taking the raw byte modulo the alphabet would bias the first 18 symbols.
  const chars: string[] = []
  while (chars.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte >= 238) continue // 238 = 34 * 7, the largest clean multiple
      chars.push(ALPHABET[byte % ALPHABET.length])
      if (chars.length === CODE_LENGTH) break
    }
  }
  const code = chars.join('')
  return { code, last4: code.slice(-4) }
}

/**
 * Dedicated key, NOT `CREDENTIALS_ENCRYPTION_KEY`: different purpose, different
 * blast radius, and that key already secures gateway credentials.
 */
function keyBuffer(): Buffer {
  const raw = process.env.GIFT_CARD_CODE_KEY
  if (!raw) throw new Error('GIFT_CARD_CODE_KEY is not set — gift card codes cannot be hashed.')
  return Buffer.from(raw, 'utf8')
}

export function hashGiftCardCode(code: string): string {
  return createHmac('sha256', keyBuffer()).update(code.trim().toUpperCase()).digest('hex')
}
