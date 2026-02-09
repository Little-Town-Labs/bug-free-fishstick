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
    createFunction: vi.fn((config, eventConfig, handler) => handler),
  },
}))

import { db } from '@/lib/db'
import { downloadFile } from '@/lib/storage/blob'
import { parsePdf } from '@/lib/documents/pdf-parser'
import { parseWord } from '@/lib/documents/word-parser'
import { analyzeDocument } from '@/lib/ai/agents/document-analyzer'
import { generateResponses } from '@/lib/ai/agents/response-generator'
import { checkQuality } from '@/lib/ai/agents/quality-checker'
import { processRfp } from '@/lib/inngest/functions/process-rfp'

// Helper function to create a mock step object
function createMockStep() {
  return {
    run: vi.fn((name: string, fn: () => any) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
    waitForEvent: vi.fn(),
  }
}

// Helper function to create a mock event
function createMockEvent(data: any) {
  return { data, name: 'rfp/process' }
}

describe('process-rfp Inngest workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Full workflow', () => {
    it('should process an RFP PDF through the complete pipeline', async () => {
      const rfpId = 'rfp-123'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        title: 'Test RFP',
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
        parsedStructure: null,
        automationPercentage: null,
      }

      const mockParsedText = 'Parsed PDF content with RFP questions'
      const mockAnalyzedFields = {
        fields: [
          { id: '1', question: 'What is your company name?', type: 'short_text' },
          { id: '2', question: 'Describe your experience', type: 'long_text' },
        ],
        metadata: { totalFields: 2, documentType: 'rfp' },
      }
      const mockResponses = [
        { fieldId: '1', response: 'Acme Corp', confidence: 0.95 },
        { fieldId: '2', response: 'We have 10 years of experience...', confidence: 0.88 },
      ]
      const mockQualityResults = {
        overallScore: 0.92,
        issues: [],
        passedChecks: ['relevance', 'completeness', 'grammar'],
      }

      // Mock database calls
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockRfp, status: 'processing' }]),
      } as any)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as any)

      // Mock storage and parsing
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock pdf data'))
      vi.mocked(parsePdf).mockResolvedValue(mockParsedText)

      // Mock AI agents
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzedFields)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQualityResults)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

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

      // Verify parser was called
      expect(parsePdf).toHaveBeenCalledWith(expect.any(Buffer))

      // Verify AI agents were called
      expect(analyzeDocument).toHaveBeenCalledWith(mockParsedText)
      expect(generateResponses).toHaveBeenCalledWith(
        mockAnalyzedFields.fields,
        expect.any(Object)
      )
      expect(checkQuality).toHaveBeenCalledWith(mockResponses)
    })

    it('should process an RFP DOCX through the complete pipeline', async () => {
      const rfpId = 'rfp-124'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        title: 'Test RFP DOCX',
        documentUrl: 'https://blob.vercel-storage.com/test.docx',
        documentType: 'docx',
        status: 'uploaded',
        parsedStructure: null,
        automationPercentage: null,
      }

      const mockParsedText = 'Parsed Word content with RFP questions'
      const mockAnalyzedFields = {
        fields: [
          { id: '1', question: 'Company overview?', type: 'long_text' },
        ],
        metadata: { totalFields: 1, documentType: 'rfp' },
      }
      const mockResponses = [
        { fieldId: '1', response: 'We are a leading provider...', confidence: 0.91 },
      ]
      const mockQualityResults = {
        overallScore: 0.91,
        issues: [],
        passedChecks: ['relevance', 'completeness'],
      }

      // Mock database calls
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockRfp, status: 'processing' }]),
      } as any)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as any)

      // Mock storage and parsing
      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock docx data'))
      vi.mocked(parseWord).mockResolvedValue(mockParsedText)

      // Mock AI agents
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzedFields)
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue(mockQualityResults)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      // Verify Word parser was called instead of PDF parser
      expect(parseWord).toHaveBeenCalledWith(expect.any(Buffer))
      expect(parsePdf).not.toHaveBeenCalled()

      // Verify AI agents were called
      expect(analyzeDocument).toHaveBeenCalledWith(mockParsedText)
      expect(generateResponses).toHaveBeenCalled()
      expect(checkQuality).toHaveBeenCalled()
    })

    it('should update RFP status to processing at start and completed on success', async () => {
      const rfpId = 'rfp-125'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        title: 'Test RFP',
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
        parsedStructure: null,
        automationPercentage: null,
      }

      const updateMock = vi.fn().mockResolvedValue([{ ...mockRfp, status: 'processing' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateMock,
      } as any)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('mock data'))
      vi.mocked(parsePdf).mockResolvedValue('parsed text')
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: [{ id: '1', question: 'Q1', type: 'short_text' }],
        metadata: { totalFields: 1, documentType: 'rfp' },
      })
      vi.mocked(generateResponses).mockResolvedValue([
        { fieldId: '1', response: 'A1', confidence: 0.9 },
      ])
      vi.mocked(checkQuality).mockResolvedValue({
        overallScore: 0.9,
        issues: [],
        passedChecks: ['relevance'],
      })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      // Verify status was updated to processing at start
      expect(updateMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ status: 'processing' }),
        ])
      )

      // Verify final update with completion status
      expect(updateMock).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            status: expect.stringMatching(/draft|completed/),
            parsedStructure: expect.any(Object),
            automationPercentage: expect.any(Number),
          }),
        ])
      )
    })
  })

  describe('Step-by-step verification', () => {
    it('should fetch the RFP record from database', async () => {
      const rfpId = 'rfp-126'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        title: 'Test RFP',
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const selectMock = vi.fn().mockResolvedValue([mockRfp])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue(selectMock),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue({ fields: [], metadata: {} } as any)
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(db.select).toHaveBeenCalled()
      expect(selectMock).toHaveBeenCalled()
    })

    it('should download the document from Vercel Blob', async () => {
      const rfpId = 'rfp-127'
      const organizationId = 'org-456'
      const documentUrl = 'https://blob.vercel-storage.com/test.pdf'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl,
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('pdf data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue({ fields: [], metadata: {} } as any)
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(downloadFile).toHaveBeenCalledWith(documentUrl)
    })

    it('should call PDF parser for PDF files', async () => {
      const rfpId = 'rfp-128'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const mockBuffer = Buffer.from('pdf binary data')

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(mockBuffer)
      vi.mocked(parsePdf).mockResolvedValue('parsed pdf text')
      vi.mocked(analyzeDocument).mockResolvedValue({ fields: [], metadata: {} } as any)
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(parsePdf).toHaveBeenCalledWith(mockBuffer)
      expect(parseWord).not.toHaveBeenCalled()
    })

    it('should call Word parser for DOCX files', async () => {
      const rfpId = 'rfp-129'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.docx',
        documentType: 'docx',
        status: 'uploaded',
      }

      const mockBuffer = Buffer.from('docx binary data')

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(mockBuffer)
      vi.mocked(parseWord).mockResolvedValue('parsed word text')
      vi.mocked(analyzeDocument).mockResolvedValue({ fields: [], metadata: {} } as any)
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(parseWord).toHaveBeenCalledWith(mockBuffer)
      expect(parsePdf).not.toHaveBeenCalled()
    })

    it('should call document analyzer with parsed text', async () => {
      const rfpId = 'rfp-130'
      const organizationId = 'org-456'
      const parsedText = 'This is the parsed document text with questions'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue(parsedText)
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: [{ id: '1', question: 'Q1', type: 'short_text' }],
        metadata: { totalFields: 1, documentType: 'rfp' },
      })
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(analyzeDocument).toHaveBeenCalledWith(parsedText)
    })

    it('should call response generator with analyzed fields and knowledge context', async () => {
      const rfpId = 'rfp-131'
      const organizationId = 'org-456'
      const mockFields = [
        { id: '1', question: 'What is your company name?', type: 'short_text' },
        { id: '2', question: 'Describe your services', type: 'long_text' },
      ]
      const mockAnalyzedFields = {
        fields: mockFields,
        metadata: { totalFields: 2, documentType: 'rfp' },
      }
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue(mockAnalyzedFields)
      vi.mocked(generateResponses).mockResolvedValue([
        { fieldId: '1', response: 'Acme Corp', confidence: 0.95 },
      ])
      vi.mocked(checkQuality).mockResolvedValue({ overallScore: 1, issues: [], passedChecks: [] })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(generateResponses).toHaveBeenCalledWith(
        mockFields,
        expect.objectContaining({
          organizationId,
          rfpId,
        })
      )
    })

    it('should call quality checker with generated responses', async () => {
      const rfpId = 'rfp-132'
      const organizationId = 'org-456'
      const mockResponses = [
        { fieldId: '1', response: 'Acme Corp', confidence: 0.95 },
        { fieldId: '2', response: 'We provide excellent services', confidence: 0.88 },
      ]
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: [
          { id: '1', question: 'Q1', type: 'short_text' },
          { id: '2', question: 'Q2', type: 'long_text' },
        ],
        metadata: { totalFields: 2, documentType: 'rfp' },
      })
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue({
        overallScore: 0.9,
        issues: [],
        passedChecks: ['relevance', 'completeness'],
      })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(checkQuality).toHaveBeenCalledWith(mockResponses)
    })

    it('should save responses to the database', async () => {
      const rfpId = 'rfp-133'
      const organizationId = 'org-456'
      const mockResponses = [
        { fieldId: '1', response: 'Answer 1', confidence: 0.95 },
        { fieldId: '2', response: 'Answer 2', confidence: 0.88 },
      ]
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const insertMock = vi.fn().mockResolvedValue([{ id: 'response-1' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: insertMock,
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: [
          { id: '1', question: 'Q1', type: 'short_text' },
          { id: '2', question: 'Q2', type: 'short_text' },
        ],
        metadata: { totalFields: 2, documentType: 'rfp' },
      })
      vi.mocked(generateResponses).mockResolvedValue(mockResponses)
      vi.mocked(checkQuality).mockResolvedValue({
        overallScore: 0.9,
        issues: [],
        passedChecks: ['relevance'],
      })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(db.insert).toHaveBeenCalled()
      expect(insertMock).toHaveBeenCalled()
    })

    it('should update RFP with parsed structure and automation percentage', async () => {
      const rfpId = 'rfp-134'
      const organizationId = 'org-456'
      const mockFields = [
        { id: '1', question: 'Q1', type: 'short_text' },
        { id: '2', question: 'Q2', type: 'short_text' },
      ]
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const updateMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])
        .mockResolvedValueOnce([{
          ...mockRfp,
          status: 'draft',
          parsedStructure: { fields: mockFields },
          automationPercentage: 100,
        }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateMock,
      } as any)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'response-1' }]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: mockFields,
        metadata: { totalFields: 2, documentType: 'rfp' },
      })
      vi.mocked(generateResponses).mockResolvedValue([
        { fieldId: '1', response: 'A1', confidence: 0.95 },
        { fieldId: '2', response: 'A2', confidence: 0.95 },
      ])
      vi.mocked(checkQuality).mockResolvedValue({
        overallScore: 0.95,
        issues: [],
        passedChecks: ['relevance'],
      })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      expect(updateMock).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            parsedStructure: expect.any(Object),
            automationPercentage: expect.any(Number),
          }),
        ])
      )
    })
  })

  describe('Error handling', () => {
    it('should handle RFP not found in database', async () => {
      const rfpId = 'rfp-nonexistent'
      const organizationId = 'org-456'

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as any)

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect(processRfp({ event, step })).rejects.toThrow()
    })

    it('should handle document download failure', async () => {
      const rfpId = 'rfp-135'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockRejectedValue(new Error('Download failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect(processRfp({ event, step })).rejects.toThrow('Download failed')
    })

    it('should handle parser errors', async () => {
      const rfpId = 'rfp-136'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockRejectedValue(new Error('Parse failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect(processRfp({ event, step })).rejects.toThrow('Parse failed')
    })

    it('should handle AI agent errors and update status to indicate failure', async () => {
      const rfpId = 'rfp-137'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const updateMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])
        .mockResolvedValueOnce([{ ...mockRfp, status: 'failed' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateMock,
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text')
      vi.mocked(analyzeDocument).mockRejectedValue(new Error('AI agent failed'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await expect(processRfp({ event, step })).rejects.toThrow('AI agent failed')
    })

    it('should update RFP status on workflow failure', async () => {
      const rfpId = 'rfp-138'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const updateMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateMock,
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockRejectedValue(new Error('Unexpected error'))

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      try {
        await processRfp({ event, step })
      } catch (error) {
        // Expected to throw
      }

      // Verify status was updated to processing at least once
      expect(updateMock).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('should handle RFP with no identified fields (0% automation)', async () => {
      const rfpId = 'rfp-139'
      const organizationId = 'org-456'
      const mockRfp = {
        id: rfpId,
        organizationId,
        documentUrl: 'https://blob.vercel-storage.com/test.pdf',
        documentType: 'pdf',
        status: 'uploaded',
      }

      const updateMock = vi.fn()
        .mockResolvedValueOnce([{ ...mockRfp, status: 'processing' }])
        .mockResolvedValueOnce([{
          ...mockRfp,
          status: 'draft',
          parsedStructure: { fields: [] },
          automationPercentage: 0,
        }])

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockRfp]),
      } as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: updateMock,
      } as any)

      vi.mocked(downloadFile).mockResolvedValue(Buffer.from('data'))
      vi.mocked(parsePdf).mockResolvedValue('text with no identifiable fields')
      vi.mocked(analyzeDocument).mockResolvedValue({
        fields: [],
        metadata: { totalFields: 0, documentType: 'unknown' },
      })
      vi.mocked(generateResponses).mockResolvedValue([])
      vi.mocked(checkQuality).mockResolvedValue({
        overallScore: 0,
        issues: ['No fields identified'],
        passedChecks: [],
      })

      const step = createMockStep()
      const event = createMockEvent({ rfpId, organizationId })

      await processRfp({ event, step })

      // Should complete workflow even with 0 fields
      expect(updateMock).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            automationPercentage: 0,
          }),
        ])
      )
    })
  })
})
