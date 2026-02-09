import { Document, Packer, Paragraph, TextRun } from 'docx'

export interface WordOutputOptions {
  originalDocx: Buffer
  responses: Array<{
    fieldId: string
    responseText: string
    position: {
      page: number
      x: number
      y: number
      width: number
      height: number
    }
  }>
}

export interface WordOutputResult {
  buffer: Buffer
}

export async function generateWordOutput(
  options: WordOutputOptions
): Promise<WordOutputResult> {
  // Validate input
  if (!options.originalDocx || options.originalDocx.length === 0) {
    throw new Error('Original DOCX buffer cannot be empty')
  }

  // Build sections with response paragraphs
  const children = options.responses.map((response) =>
    new Paragraph({
      children: [new TextRun(response.responseText)],
    })
  )

  // Create the document with all responses
  const doc = new Document({
    sections: [{ children }],
  })

  // Generate the output buffer
  const buffer = await Packer.toBuffer(doc)

  return { buffer }
}
