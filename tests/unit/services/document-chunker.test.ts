import { describe, it, expect } from 'vitest'
import { chunkDocument } from '@/lib/services/document-chunker'

describe('chunkDocument', () => {
  it('returns single chunk for short documents', () => {
    const text = 'Short document content.'
    const chunks = chunkDocument(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.chunkIndex).toBe(0)
    expect(chunks[0]!.totalChunks).toBe(1)
    expect(chunks[0]!.sectionHeading).toBeNull()
  })

  it('splits by headings when present', () => {
    const text = [
      '# Introduction',
      'A'.repeat(3000), // ~750 tokens
      '# Requirements',
      'B'.repeat(3000),
      '# Pricing',
      'C'.repeat(3000),
    ].join('\n')

    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks[0]!.sectionHeading).toBe('Introduction')
    expect(chunks[1]!.sectionHeading).toBe('Requirements')
    expect(chunks[2]!.sectionHeading).toBe('Pricing')
  })

  it('falls back to paragraph splitting when no headings', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `Paragraph ${i}: ${'X'.repeat(400)}`
    )
    const text = paragraphs.join('\n\n')

    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.sectionHeading).toBeNull()
    }
  })

  it('respects max token limit per chunk', () => {
    const text = 'X'.repeat(30000) // ~7500 tokens
    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(1)
    // Each chunk should be roughly under the limit (with some tolerance for overlap)
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThan(8000) // ~2000 tokens max with overlap
    }
  })

  it('adds overlap between consecutive chunks', () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) =>
      `Paragraph ${i}: ${'Y'.repeat(300)}`
    )
    const text = paragraphs.join('\n\n')

    const chunks = chunkDocument(text)
    if (chunks.length > 1) {
      // Second chunk should start with content from end of first chunk
      const firstEnd = chunks[0]!.content.slice(-100)
      expect(chunks[1]!.content).toContain(firstEnd.slice(-50))
    }
  })

  it('sets correct chunkIndex and totalChunks', () => {
    const text = [
      '# Section A',
      'A'.repeat(3000),
      '# Section B',
      'B'.repeat(3000),
    ].join('\n')

    const chunks = chunkDocument(text)
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(i)
      expect(chunks[i]!.totalChunks).toBe(chunks.length)
    }
  })

  it('handles very large sections by splitting further', () => {
    const text = [
      '# Huge Section',
      'W'.repeat(30000), // ~7500 tokens, well over 1500 limit
    ].join('\n')

    const chunks = chunkDocument(text)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]!.sectionHeading).toBe('Huge Section')
  })
})
