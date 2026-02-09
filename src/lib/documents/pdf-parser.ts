import pdfParse from 'pdf-parse'

export interface ParsedPdfResult {
  text: string
  pages: number
  metadata: {
    title?: string
    author?: string
  }
  fields: Array<{
    id: string
    type: 'text' | 'paragraph' | 'checkbox' | 'table'
    question: string
    position: { page: number; x: number; y: number; width: number; height: number }
  }>
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Parse a PDF buffer and extract text, metadata, and structured form fields
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdfResult> {
  // Validate input
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty buffer provided')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit')
  }

  // Parse the PDF using pdf-parse
  const data = await pdfParse(buffer)

  // Extract metadata
  const metadata: { title?: string; author?: string } = {}
  if (data.info?.Title) {
    metadata.title = data.info.Title
  }
  if (data.info?.Author) {
    metadata.author = data.info.Author
  }

  // Extract structured fields from text
  const fields = extractFields(data.text)

  return {
    text: data.text,
    pages: data.numpages,
    metadata,
    fields,
  }
}

/**
 * Extract structured form fields from PDF text content
 */
function extractFields(text: string): ParsedPdfResult['fields'] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const fields: ParsedPdfResult['fields'] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    const nextLine = i + 1 < lines.length ? lines[i + 1]!.trim() : ''

    // Pattern 1: Text field - "N. Label: ___"
    const textFieldMatch = line.match(/^\d+\.\s+(.+?):\s*_{2,}/)
    if (textFieldMatch) {
      const question = textFieldMatch[1]!.trim()
      fields.push({
        id: generateFieldId(fields.length),
        type: 'text',
        question,
        position: {
          page: 1,
          x: 0,
          y: i * 20,
          width: 500,
          height: 20,
        },
      })
      continue
    }

    // Pattern 2: Paragraph field - "N. Please provide/describe..." followed by empty line
    const paragraphMatch = line.match(/^\d+\.\s+(Please provide|Describe|Please describe|Provide|Explain).+?[:.?]?$/i)
    if (paragraphMatch && nextLine === '') {
      const question = line.replace(/^\d+\.\s+/, '').replace(/[:.?]*$/, '').trim()
      fields.push({
        id: generateFieldId(fields.length),
        type: 'paragraph',
        question,
        position: {
          page: 1,
          x: 0,
          y: i * 20,
          width: 500,
          height: 20,
        },
      })
      continue
    }

    // Pattern 3: Checkbox field - "N. Question? [ ]" or "N. Question? [x]"
    const checkboxMatch = line.match(/^\d+\.\s+(.+?)\s*\[\s*[x\s]?\s*\]/)
    if (checkboxMatch) {
      const question = checkboxMatch[1]!.trim()
      fields.push({
        id: generateFieldId(fields.length),
        type: 'checkbox',
        question,
        position: {
          page: 1,
          x: 0,
          y: i * 20,
          width: 500,
          height: 20,
        },
      })
      continue
    }

    // Pattern 4: Table field - "Table N:" or lines with "| ... |"
    const tableMatch = line.match(/^Table\s+\d+:/i) || line.match(/^\|.+\|/)
    if (tableMatch) {
      // For table headers, extract the table title
      let question = 'Table'
      if (line.match(/^Table\s+\d+:/i)) {
        question = line.trim()
      }

      // Check if we already added this table (avoid duplicates for multi-line tables)
      const lastField = fields[fields.length - 1]
      if (lastField?.type === 'table' && i > 0) {
        // This is likely a continuation of the previous table
        continue
      }

      fields.push({
        id: generateFieldId(fields.length),
        type: 'table',
        question,
        position: {
          page: 1,
          x: 0,
          y: i * 20,
          width: 500,
          height: 20,
        },
      })
    }
  }

  return fields
}

/**
 * Generate a unique field ID
 */
function generateFieldId(index: number): string {
  return `field_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
