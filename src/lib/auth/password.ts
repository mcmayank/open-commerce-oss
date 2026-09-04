import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, keylen: number) => Promise<Buffer>
const KEYLEN = 64

// Format: scrypt:<saltHex>:<hashHex>
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(plain, salt, KEYLEN)
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    if (expected.length !== KEYLEN) return false
    const derived = await scrypt(plain, salt, KEYLEN)
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
