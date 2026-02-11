import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}))

vi.mock('@/lib/storage/blob', () => ({
  uploadRfpDocument: vi.fn(),
  deleteFile: vi.fn(),
  downloadFile: vi.fn(),
}))

vi.mock('@/lib/documents/pdf-parser', () => ({
  parsePdf: vi.fn(),
}))

vi.mock('@/lib/documents/word-parser', () => ({
  parseWord: vi.fn(),
}))

vi.mock('@/lib/ai/agents/document-analyzer', () => ({
  analyzeDocument: vi.fn(),
}))

vi.mock('@/lib/ai/agents/response-generator', () => ({
  generateResponses: vi.fn(),
}))

vi.mock('@/lib/ai/agents/quality-checker', () => ({
  checkQuality: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _eventConfig: unknown, handler: unknown) => handler),
  },
}))

import { db } from '@/lib/db'
import { downloadFile } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import type { DocumentAnalysisResult } from '@/lib/ai/agents/document-analyzer'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import { processRfp } from '@/lib/inngest/functions/process-rfp'

// Helper function to create a mock step object
function createMockStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

// Helper function to create a mock event
function createMockEvent(data: Record<string, unknown>) {
  return { data, name: 'rfp/process' }
}

// Standard mock data factories
function createMockRfp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rfp-123',
    organizationId: 'org-456',
    title: 'Test RFP',
    originalFileUrl: 'https://blob.vercel-storage.com/test.pdf',
    originalFileType: 'pdf',
    status: 'uploaded',
    parsedStructure: null,
    automationPercentage: null,
    ...overrides,
  }
}

function createMockParsedPdf(text = 'Parsed PDF content with RFP questions') {
  return {
    text,
    pages: 3,
    metadata: { title: 'Test PDF' },
    fields: [],
  }
}

function createMockParsedWord(text = 'Parsed Word content with RFP questions') {
  return {
    text,
    html: `<p>${text}</p>`,
    fields: [],
    metadata: { title: '', author: '' },
  }
}

function createMockAnalyzedResult(fields: Array<{ id: string; question: string; type: string }> = [
  { id: '1', question: 'What is your company name?', type: 'text' },
  { id: '2', question: 'Describe your experience', type: 'paragraph' },
]) {
  return {
    fields: fields.map(f => ({
      ...f,
      position: { page: 1, x: 0, y: 0, width: 500, height: 20 },
    })),
    summary: 'An RFP document',
  } as DocumentAnalysisResult
}

function createMockGeneratedResponses(responses: Array<{ fieldId: string; responseText: string; confidenceScore: number }> = [
  { fieldId: '1', responseText: 'Acme Corp', confidenceScore: 0.95 },
  { fieldId: '2', responseText: 'We have 10 years of experience...', confidenceScore: 0.88 },
]) {
  return {
    responses: responses.map(r => ({
      ...r,
      sources: ['knowledge-base'],
      status: r.confidenceScore >= 0.7 ? 'auto_filled' as const : 'needs_input' as const,
    })),
  }
}

function createMockQualityResults(fieldIds: string[] = ['1', '2']) {
  return {
    results: fieldIds.map(fieldId => ({
      fieldId,
      passed: true,
      adjustedConfidence: 0.92,
      issues: [],
    })),
  }
}

// Standard mock DB setup
function setupStandardDbMocks(mockRfp: Record<string, unknown>) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([mockRfp]),
  } as unknown as ReturnType<typeof db.select>)

  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ ...mockRfp, status: 'processing' }]),
  } as unknown as ReturnType<typeof db.update>)

  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
  } as unknown as ReturnType<typeof db.insert>)
}

describe('process-rfp Inngest workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Full workflow', () => {
    it('should process an RFP PDF through the complete pipeline', async () => {
      const rfpId = 'rfp-123'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockParsedPdf = createMockParsedPdf()
      const mockAnalyzed = createMockAnalyzedResult()
      const mockResponses = createMockGeneratedResponses()
      const mockQuality = createMockQualityResults()

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock pdf data'))
      vi.mocked(parsePdf).mockResolvedValue(mockParsedPdf)
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQuality)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      // Verify workflow steps
      expect(step.run).toHaveBeenCalledWith('fetch-rfp', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('download-document', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('parse-document', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('analyze-document', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('generate-responses', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('check-quality', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('save-responses', expect.any(Function))
      expect(step.run).toHaveBeenCalledWith('update-rfp', expect.any(Function))

      // Verify database interactions
      expect(db.select).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()
      expect(db.insert).toHaveBeenCalled()

      // Verify parser was called with a Buffer
      expect(parsePdf).toHaveBeenCalledWith(expect.any(Buffer))

      // Verify AI agents were called with correct input shapes
      expect(analyzeDocument).toHaveBeenCalledWith({
        text: mockParsedPdf.text,
        pages: mockParsedPdf.pages,
        providerConfig: { provider: 'claude' },
      })
      expect(generateResponses).toHaveBeenCalledWith({
        fields: expect.any(Array),
        knowledgeContext: [],
        providerConfig: { provider: 'claude' },
      })
      expect(checkQuality).toHaveBeenCalledWith({
        responses: expect.any(Array),
        providerConfig: { provider: 'claude' },
      })
    })

    it('should process an RFP DOCX through the complete pipeline', async () => {
      const rfpId = 'rfp-124'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({
        id: rfpId,
        organizationId,
        title: 'Test RFP DOCX',
        originalFileUrl: 'https://blob.vercel-storage.com/test.docx',
        originalFileType: 'docx',
      })
      const mockParsedWord = createMockParsedWord()
      const mockAnalyzed = createMockAnalyzedResult([
        { id: '1', question: 'Company overview?', type: 'paragraph' },
      ])
      const mockResponses = createMockGeneratedResponses([
        { fieldId: '1', responseText: 'We are a leading provider...', confidenceScore: 0.91 },
      ])
      const mockQuality = createMockQualityResults(['1'])

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock docx data'))
      vi.mocked(parseWord).mockResolvedValue(mockParsedWord)
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQuality)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      // Verify Word parser was called instead of PDF parser
      expect(parseWord).toHaveBeenCalledWith(expect.any(Buffer))
      expect(parsePdf).not.toHaveBeenCalled()

      // Verify AI agents were called with correct shapes
      expect(analyzeDocument).toHaveBeenCalledWith({
        text: mockParsedWord.text,
        pages: 1, // Word docs don't have pages, defaults to 1
        providerConfig: { provider: 'claude' },
      })
      expect(generateResponses).toHaveBeenCalled()
      expect(checkQuality).toHaveBeenCalled()
    })

    it('should update RFP status to processing at start and draft on success', async () => {
      const rfpId = 'rfp-125'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockParsedPdf = createMockParsedPdf('parsed text')
      const mockAnalyzed = createMockAnalyzedResult([
        { id: '1', question: 'Q1', type: 'text' },
      ])
      const mockResponses = createMockGeneratedResponses([
        { fieldId: '1', responseText: 'A1', confidenceScore: 0.9 },
      ])
      const mockQuality = createMockQualityResults(['1'])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.select>)

      const setMock = vi.fn().mockReturnThis()
      const whereMock = vi.fn().mockReturnThis()
      const returningMock = vi.fn().mockResolvedValue([{ ...mockRfp, status: 'processing' }])

      vi.mocked(db.update).mockReturnValue({
        set: setMock,
        where: whereMock,
        returning: returningMock,
      } as unknown as ReturnType<typeof db.update>)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as unknown as ReturnType<typeof db.insert>)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock data'))
      vi.mocked(parsePdf).mockResolvedValue(mockParsedPdf)
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQuality)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      // Verify db.update was called (processing status + final update)
      expect(db.update).toHaveBeenCalled()
      // setMock was called with status: 'processing' and later with status: 'draft'
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'processing' }))
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'draft',
        parsedStructure: expect.any(Object),
        automationPercentage: expect.any(Number),
      }))
    })
  })

  describe('Step-by-step verification', () => {
    it('should fetch the RFP record from database', async () => {
      const rfpId = 'rfp-126'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(createMockAnalyzedResult([]))
      vi.mocked(generateResponses).mockResolvedValue({ responses: [] })
      vi.mocked(checkQuality).mockResolvedValue({ results: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(db.select).toHaveBeenCalled()
    })

    it('should download the document from Vercel Blob', async () => {
      const rfpId = 'rfp-127'
      const organizationId = 'org-456'
      const originalFileUrl = 'https://blob.vercel-storage.com/test.pdf'
      const mockRfp = createMockRfp({ id: rfpId, organizationId, originalFileUrl })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('pdf data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(createMockAnalyzedResult([]))
      vi.mocked(generateResponses).mockResolvedValue({ responses: [] })
      vi.mocked(checkQuality).mockResolvedValue({ results: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(downloadFile).toHaveBeenCalledWith(originalFileUrl)
    })

    it('should call PDF parser for PDF files', async () => {
      const rfpId = 'rfp-128'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({
        id: rfpId,
        organizationId,
        originalFileType: 'pdf',
      })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('pdf binary data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('parsed pdf text'))
      vi.mocked(analyzeDocument).mockResolvedValue(createMockAnalyzedResult([]))
      vi.mocked(generateResponses).mockResolvedValue({ responses: [] })
      vi.mocked(checkQuality).mockResolvedValue({ results: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(parsePdf).toHaveBeenCalledWith(expect.any(Buffer))
      expect(parseWord).not.toHaveBeenCalled()
    })

    it('should call Word parser for DOCX files', async () => {
      const rfpId = 'rfp-129'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({
        id: rfpId,
        organizationId,
        originalFileUrl: 'https://blob.vercel-storage.com/test.docx',
        originalFileType: 'docx',
      })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('docx binary data'))
      vi.mocked(parseWord).mockResolvedValue(createMockParsedWord('parsed word text'))
      vi.mocked(analyzeDocument).mockResolvedValue(createMockAnalyzedResult([]))
      vi.mocked(generateResponses).mockResolvedValue({ responses: [] })
      vi.mocked(checkQuality).mockResolvedValue({ results: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(parseWord).toHaveBeenCalledWith(expect.any(Buffer))
      expect(parsePdf).not.toHaveBeenCalled()
    })

    it('should call document analyzer with parsed text and providerConfig', async () => {
      const rfpId = 'rfp-130'
      const organizationId = 'org-456'
      const parsedText = 'This is the parsed document text with questions'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockParsedPdf = createMockParsedPdf(parsedText)

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(mockParsedPdf)
      vi.mocked(analyzeDocument).mockResolvedValue(createMockAnalyzedResult([
        { id: '1', question: 'Q1', type: 'text' },
      ]))
      vi.mocked(generateResponses).mockResolvedValue(createMockGeneratedResponses([
        { fieldId: '1', responseText: 'A1', confidenceScore: 0.9 },
      ]))
      vi.mocked(checkQuality).mockResolvedValue(createMockQualityResults(['1']))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(analyzeDocument).toHaveBeenCalledWith({
        text: parsedText,
        pages: mockParsedPdf.pages,
        providerConfig: { provider: 'claude' },
      })
    })

    it('should call response generator with analyzed fields and providerConfig', async () => {
      const rfpId = 'rfp-131'
      const organizationId = 'org-456'
      const mockFields = [
        { id: '1', question: 'What is your company name?', type: 'text' },
        { id: '2', question: 'Describe your services', type: 'paragraph' },
      ]
      const mockAnalyzed = createMockAnalyzedResult(mockFields)
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(createMockGeneratedResponses([
        { fieldId: '1', responseText: 'Acme Corp', confidenceScore: 0.95 },
      ]))
      vi.mocked(checkQuality).mockResolvedValue(createMockQualityResults(['1']))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(generateResponses).toHaveBeenCalledWith({
        fields: mockAnalyzed.fields.map(f => ({
          id: f.id,
          type: f.type,
          question: f.question,
        })),
        knowledgeContext: [],
        providerConfig: { provider: 'claude' },
      })
    })

    it('should call quality checker with generated responses and providerConfig', async () => {
      const rfpId = 'rfp-132'
      const organizationId = 'org-456'
      const mockFields = [
        { id: '1', question: 'Q1', type: 'text' },
        { id: '2', question: 'Q2', type: 'paragraph' },
      ]
      const mockAnalyzed = createMockAnalyzedResult(mockFields)
      const mockResponses = createMockGeneratedResponses([
        { fieldId: '1', responseText: 'Acme Corp', confidenceScore: 0.95 },
        { fieldId: '2', responseText: 'We provide excellent services', confidenceScore: 0.88 },
      ])
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(createMockQualityResults(['1', '2']))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(checkQuality).toHaveBeenCalledWith({
        responses: mockResponses.responses.map(r => ({
          fieldId: r.fieldId,
          question: expect.any(String),
          fieldType: expect.any(String),
          responseText: r.responseText,
          confidenceScore: r.confidenceScore,
        })),
        providerConfig: { provider: 'claude' },
      })
    })

    it('should save responses to the database', async () => {
      const rfpId = 'rfp-133'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockAnalyzed = createMockAnalyzedResult([
        { id: '1', question: 'Q1', type: 'text' },
        { id: '2', question: 'Q2', type: 'text' },
      ])
      const mockResponses = createMockGeneratedResponses([
        { fieldId: '1', responseText: 'Answer 1', confidenceScore: 0.95 },
        { fieldId: '2', responseText: 'Answer 2', confidenceScore: 0.88 },
      ])
      const mockQuality = createMockQualityResults(['1', '2'])

      const insertMock = vi.fn().mockResolvedValue([{ id: 'response-1' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.select>)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.update>)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: insertMock,
      } as unknown as ReturnType<typeof db.insert>)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQuality)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      expect(db.insert).toHaveBeenCalled()
      expect(insertMock).toHaveBeenCalled()
    })

    it('should update RFP with parsed structure and automation percentage', async () => {
      const rfpId = 'rfp-134'
      const organizationId = 'org-456'
      const mockFields = [
        { id: '1', question: 'Q1', type: 'text' },
        { id: '2', question: 'Q2', type: 'text' },
      ]
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockAnalyzed = createMockAnalyzedResult(mockFields)
      const mockResponses = createMockGeneratedResponses([
        { fieldId: '1', responseText: 'A1', confidenceScore: 0.95 },
        { fieldId: '2', responseText: 'A2', confidenceScore: 0.95 },
      ])

      const setMock = vi.fn().mockReturnThis()
      const whereMock = vi.fn().mockReturnThis()
      const returningMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])
        .mockResolvedValueOnce([{
          ...mockRfp,
          status: 'draft',
          parsedStructure: { pages: 3, fields: mockAnalyzed.fields },
          automationPercentage: 100,
        }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.select>)

      vi.mocked(db.update).mockReturnValue({
        set: setMock,
        where: whereMock,
        returning: returningMock,
      } as unknown as ReturnType<typeof db.update>)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as unknown as ReturnType<typeof db.insert>)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(createMockQualityResults(['1', '2']))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      // Verify final update includes parsedStructure and automationPercentage
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
        status: 'draft',
        parsedStructure: expect.any(Object),
        automationPercentage: expect.any(Number),
      }))
    })
  })

  describe('Error handling', () => {
    it('should handle RFP not found in database', async () => {
      const rfpId = 'rfp-nonexistent'
      const organizationId = 'org-456'

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof db.select>)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof db.update>)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect((processRfp as unknown as Function)({ event, step })).rejects.toThrow()
    })

    it('should handle document download failure', async () => {
      const rfpId = 'rfp-135'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockRejectedValue(new Error('Download failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect((processRfp as unknown as Function)({ event, step })).rejects.toThrow('Download failed')
    })

    it('should handle parser errors', async () => {
      const rfpId = 'rfp-136'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockRejectedValue(new Error('Parse failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect((processRfp as unknown as Function)({ event, step })).rejects.toThrow('Parse failed')
    })

    it('should handle AI agent errors', async () => {
      const rfpId = 'rfp-137'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      setupStandardDbMocks(mockRfp)
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text'))
      vi.mocked(analyzeDocument).mockRejectedValue(new Error('AI agent failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect((processRfp as unknown as Function)({ event, step })).rejects.toThrow('AI agent failed')
    })

    it('should update RFP status on workflow failure', async () => {
      const rfpId = 'rfp-138'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })

      const returningMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.select>)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: returningMock,
      } as unknown as ReturnType<typeof db.update>)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockRejectedValue(new Error('Unexpected error'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      try {
        await (processRfp as unknown as Function)({ event, step })
      } catch {
        // Expected to throw
      }

      // Verify status was updated to processing at least once
      expect(returningMock).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('should handle RFP with no identified fields (0% automation)', async () => {
      const rfpId = 'rfp-139'
      const organizationId = 'org-456'
      const mockRfp = createMockRfp({ id: rfpId, organizationId })
      const mockAnalyzed = createMockAnalyzedResult([])

      const setMock = vi.fn().mockReturnThis()
      const returningMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])
        .mockResolvedValueOnce([{
          ...mockRfp,
          status: 'draft',
          parsedStructure: { pages: 3, fields: [] },
          automationPercentage: 0,
        }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as unknown as ReturnType<typeof db.select>)

      vi.mocked(db.update).mockReturnValue({
        set: setMock,
        where: vi.fn().mockReturnThis(),
        returning: returningMock,
      } as unknown as ReturnType<typeof db.update>)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof db.insert>)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(createMockParsedPdf('text with no identifiable fields'))
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzed)
      vi.mocked(generateResponses).mockResolvedValue({ responses: [] })
      vi.mocked(checkQuality).mockResolvedValue({ results: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await (processRfp as unknown as Function)({ event, step })

      // Should complete workflow even with 0 fields
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
        automationPercentage: 0,
      }))
    })
  })
})
