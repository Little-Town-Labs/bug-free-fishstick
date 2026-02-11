import mammoth from 'mammoth'
import crypto from 'crypto'

export interface ParsedWordResult {
  text: string
  html: string
  fields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
  metadata: {
    title: string
    author: string
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function parseWord(buffer: Buffer): Promise<ParsedWordResult> {
  // Validate input
  if (!buffer || buffer.length === 0) {
    throw new Error('Buffer cannot be empty')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit')
  }

  try {
    // Extract text and HTML
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer })
    ])

    const text = textResult.value
    const html = htmlResult.value

    // Extract fields from text
    const fields = extractFields(text)

    // Return result with metadata
    return {
      text,
      html,
      fields,
      metadata: {
        title: '',
        author: ''
      }
    }
  } catch (error) {
    // Propagate mammoth errors
    if (error instanceof Error && error.message.includes('DOCX')) {
      throw new Error('Invalid DOCX file')
    }
    throw error
  }
}

function extractFields(text: string): ParsedWordResult['fields'] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const fields: ParsedWordResult['fields'] = []
  const lines = text.split('\n')
  let yOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()

    if (!line) {
      yOffset += 20
      continue
    }

    // Check for numbered form fields
    const numberMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (numberMatch) {
      const question = numberMatch[2]!.trim()
      let type: 'text' | 'paragraph' | 'checkbox' | 'table' = 'paragraph'

      // Determine field type
      if (line.includes('___')) {
        type = 'text'
      } else if (line.includes('[ ]')) {
        type = 'checkbox'
      } else if (
        question.startsWith('Describe') ||
        question.startsWith('What') ||
        question.startsWith('How') ||
        question.endsWith('?')
      ) {
        type = 'paragraph'
      }

      // Generate unique field ID
      const fieldIndex = fields.length
      const hash = crypto
        .createHash('md5')
        .update(`${fieldIndex}_${question}`)
        .digest('hex')
        .substring(0, 8)

      fields.push({
        id: `field_${fieldIndex}_${hash}`,
        type,
        question: question.replace(/:\s*_+/, '').trim(),
        position: {
          page: 1,
          x: 0,
          y: yOffset,
          width: 500,
          height: 20
        }
      })
    }

    yOffset += 20
  }

  return fields
}
