import { createHmac, timingSafeEqual } from 'crypto'

function keyBuffer(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string.')
  }
  return Buffer.from(hex, 'hex')
}

export function hmacSign(payload: string): string {
  return createHmac('sha256', keyBuffer()).update(payload).digest('hex')
}

export function hmacVerify(payload: string, sigHex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(sigHex)) return false
  let expected: string
  try {
    expected = hmacSign(payload)
  } catch {
    return false
  }
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(sigHex, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
