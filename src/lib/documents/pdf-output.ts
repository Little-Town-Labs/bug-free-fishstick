import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface PdfOutputOptions {
  originalPdf: Buffer
  responses: Array<{
    fieldId: string
    responseText: string
    position: {
      page: number // 0-indexed page number
      x: number
      y: number
      width: number
      height: number
      fontSize?: number // optional, default 12
    }
  }>
}

export interface PdfOutputResult {
  buffer: Buffer
  pageCount: number
}

/**
 * Generate a PDF with response text overlaid on the original PDF
 */
export async function generatePdfOutput(
  options: PdfOutputOptions
): Promise<PdfOutputResult> {
  const { originalPdf, responses } = options

  // Validate input buffer
  if (!originalPdf || originalPdf.length === 0) {
    throw new Error('Invalid or empty PDF buffer')
  }

  // Load the original PDF
  const doc = await PDFDocument.load(originalPdf)

  // Embed the font
  const font = await doc.embedFont(StandardFonts.Helvetica)

  // Get all pages
  const pages = doc.getPages()
  const pageCount = doc.getPageCount()

  // Process each response
  for (const response of responses) {
    const { responseText, position } = response
    const { page, x, y, width, height, fontSize = 12 } = position

    // Validate position
    if (page < 0 || page >= pageCount) {
      throw new Error(`Page ${page} is out of range (document has ${pageCount} pages)`)
    }

    if (width <= 0 || height <= 0) {
      throw new Error('Invalid field dimensions: width and height must be greater than 0')
    }

    if (x < 0 || y < 0) {
      throw new Error('Invalid coordinates: x and y must be non-negative')
    }

    // Get the target page
    const targetPage = pages[page]

    // Handle text wrapping if needed
    const textWidth = font.widthOfTextAtSize(responseText, fontSize)

    if (textWidth <= width) {
      // Text fits on one line
      targetPage.drawText(responseText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    } else {
      // Text needs to be wrapped
      const lines = wrapText(responseText, width, font, fontSize)
      const lineHeight = font.heightAtSize(fontSize)
      let currentY = y

      for (const line of lines) {
        targetPage.drawText(line, {
          x,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
        currentY -= lineHeight
      }
    }
  }

  // Save the modified PDF
  const pdfBytes = await doc.save()
  const buffer = Buffer.from(pdfBytes)

  return {
    buffer,
    pageCount: doc.getPageCount(),
  }
}

/**
 * Wrap text to fit within a specified width
 */
function wrapText(
  text: string,
  maxWidth: number,
  font: any,
  fontSize: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, fontSize)

    if (testWidth <= maxWidth) {
      currentLine = testLine
    } else {
      // If current line is not empty, save it and start a new line
      if (currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        // Single word is too long, just add it anyway
        lines.push(word)
        currentLine = ''
      }
    }
  }

  // Add the last line if it's not empty
  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}
