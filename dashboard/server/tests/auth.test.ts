import { describe, it, expect } from 'vitest'

import { hashPassword, verifyPassword } from '../utils/auth'

describe('password hashing', () => {
  it('should hash and verify a password', async () => {
    const hash = await hashPassword('test-password')
    expect(hash).toContain(':')
    expect(await verifyPassword('test-password', hash)).toBe(true)
  })

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('test-password')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('should produce different hashes for the same password', async () => {
    const hash1 = await hashPassword('same-password')
    const hash2 = await hashPassword('same-password')
    expect(hash1).not.toBe(hash2)
  })
})
