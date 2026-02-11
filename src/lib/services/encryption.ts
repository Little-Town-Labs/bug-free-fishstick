import { createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM } from 'crypto'

const ALGO = 'aes-256-gcm' as const

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv) as CipherGCM
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format')
  }
  const [ivHex, tagHex, encHex] = parts as [string, string, string]
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex')) as DecipherGCM
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return (
    decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
  )
}
