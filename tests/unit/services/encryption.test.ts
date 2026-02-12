import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/services/encryption'

describe('encryption service', () => {
  describe('encrypt()', () => {
    it('returns a colon-separated string with 3 parts (iv:tag:encrypted)', () => {
      const result = encrypt('test-api-key')
      const parts = result.split(':')
      expect(parts).toHaveLength(3)
    })

    it('produces different ciphertext for same input (random IV)', () => {
      const a = encrypt('test-api-key')
      const b = encrypt('test-api-key')
      expect(a).not.toBe(b)
    })

    it('produces non-empty hex parts', () => {
      const result = encrypt('sk-ant-api03-test-key-12345')
      const [iv, tag, enc] = result.split(':') as [string, string, string]
      expect(iv.length).toBeGreaterThan(0)
      expect(tag.length).toBeGreaterThan(0)
      expect(enc.length).toBeGreaterThan(0)
    })
  })

  describe('decrypt()', () => {
    it('round-trips: decrypt(encrypt(x)) === x', () => {
      const original = 'sk-ant-api03-test-key'
      expect(decrypt(encrypt(original))).toBe(original)
    })

    it('round-trips for a long API key', () => {
      const original = 'sk-ant-api03-' + 'a'.repeat(80)
      expect(decrypt(encrypt(original))).toBe(original)
    })

    it('throws on tampered ciphertext (authentication tag mismatch)', () => {
      const ct = encrypt('hello')
      const [iv, tag, enc] = ct.split(':') as [string, string, string]
      const tampered = `${iv}:${tag}:deadbeef${enc}`
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws on malformed input (missing parts)', () => {
      expect(() => decrypt('onlyonepart')).toThrow()
    })
  })
})
