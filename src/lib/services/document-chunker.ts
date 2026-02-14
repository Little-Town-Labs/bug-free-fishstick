export interface DocumentChunk {
  content: string
  sectionHeading: string | null
  chunkIndex: number
  totalChunks: number
}

const MAX_CHUNK_TOKENS = 1500
const OVERLAP_TOKENS = 200
const MIN_CHUNK_THRESHOLD = 2000

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function splitByHeadings(text: string): { heading: string | null; content: string }[] {
  // Match markdown-style headings (# to ###) or short all-caps lines (max 80 chars)
  const headingPattern = /^(#{1,3}\s+.+|[A-Z][A-Z\s]{3,77})$/gm
  const sections: { heading: string | null; content: string }[] = []
  let lastIndex = 0
  let lastHeading: string | null = null

  for (const match of text.matchAll(headingPattern)) {
    if (match.index! > lastIndex) {
      const content = text.slice(lastIndex, match.index!).trim()
      if (content) {
        sections.push({ heading: lastHeading, content })
      }
    }
    lastHeading = match[0].replace(/^#+\s*/, '').trim()
    lastIndex = match.index! + match[0].length
  }

  // Remaining text after last heading
  const remaining = text.slice(lastIndex).trim()
  if (remaining) {
    sections.push({ heading: lastHeading, content: remaining })
  }

  return sections
}

function splitByParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
}

function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length <= 1) {
    // No sentence boundaries — force split by character count
    const chunkSize = MAX_CHUNK_TOKENS * 4
    const parts: string[] = []
    for (let i = 0; i < text.length; i += chunkSize) {
      parts.push(text.slice(i, i + chunkSize))
    }
    return parts
  }
  return sentences
}

function splitLargeSection(content: string, maxTokens: number): string[] {
  const paragraphs = splitByParagraphs(content)
  const result: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (estimateTokens(para) > maxTokens) {
      // Paragraph itself is too large — split by sentences
      if (current) {
        result.push(current)
        current = ''
      }
      const sentences = splitBySentences(para)
      for (const sentence of sentences) {
        if (estimateTokens(current + ' ' + sentence) > maxTokens && current) {
          result.push(current)
          current = sentence
        } else {
          current = current ? current + ' ' + sentence : sentence
        }
      }
    } else if (estimateTokens(current + '\n\n' + para) > maxTokens && current) {
      result.push(current)
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current) result.push(current)
  return result
}

function addOverlap(chunks: string[], overlapTokens: number): string[] {
  if (chunks.length <= 1) return chunks

  const overlapChars = overlapTokens * 4
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk
    const prevChunk = chunks[i - 1]!
    const overlap = prevChunk.slice(-overlapChars)
    return overlap + '\n\n' + chunk
  })
}

export function chunkDocument(text: string): DocumentChunk[] {
  if (estimateTokens(text) <= MIN_CHUNK_THRESHOLD) {
    return [{
      content: text,
      sectionHeading: null,
      chunkIndex: 0,
      totalChunks: 1,
    }]
  }

  // Try heading-based split first
  const sections = splitByHeadings(text)
  const rawChunks: { heading: string | null; content: string }[] = []

  if (sections.length > 1 || (sections.length === 1 && sections[0]!.heading !== null)) {
    // We got heading-based sections
    for (const section of sections) {
      if (estimateTokens(section.content) > MAX_CHUNK_TOKENS) {
        const subChunks = splitLargeSection(section.content, MAX_CHUNK_TOKENS)
        for (const sub of subChunks) {
          rawChunks.push({ heading: section.heading, content: sub })
        }
      } else {
        rawChunks.push(section)
      }
    }
  } else {
    // No headings found — paragraph/sentence split
    const parts = splitLargeSection(text, MAX_CHUNK_TOKENS)
    for (const part of parts) {
      rawChunks.push({ heading: null, content: part })
    }
  }

  // Add overlap
  const contents = rawChunks.map(c => c.content)
  const overlapped = addOverlap(contents, OVERLAP_TOKENS)
  const totalChunks = overlapped.length

  return overlapped.map((content, i) => ({
    content,
    sectionHeading: rawChunks[i]!.heading,
    chunkIndex: i,
    totalChunks,
  }))
}
