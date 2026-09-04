import { describe, expect, it } from 'vitest'
import { classifyRegistration } from './register'

describe('classifyRegistration', () => {
  it('creates when no customer exists', () => {
    expect(classifyRegistration(null)).toBe('create')
  })
  it('claims a passwordless (guest) customer', () => {
    expect(classifyRegistration({ id: 1, passwordHash: null })).toBe('claim')
    expect(classifyRegistration({ id: 1 })).toBe('claim')
  })
  it('rejects when an account with a password already exists', () => {
    expect(classifyRegistration({ id: 1, passwordHash: 'scrypt:..' })).toBe('exists')
  })
})
