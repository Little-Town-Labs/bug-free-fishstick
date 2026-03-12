import { describe, it, expect } from 'vitest'
import type {
  RfpStatus,
  ResponseStatus,
  FieldType,
  ProcessingStatus,
} from '@/types/rfp'
import type {
  KnowledgeEntryType,
  LearningSourceType,
  KnowledgeSearchResult,
} from '@/types/knowledge'
import type { ApiResponse, PaginatedResponse, ValidationError } from '@/types/api'

describe('Type exports', () => {
  it('should export RFP types', () => {
    const status: RfpStatus = 'draft'
    const responseStatus: ResponseStatus = 'auto_filled'
    const fieldType: FieldType = 'text'

    expect(status).toBe('draft')
    expect(responseStatus).toBe('auto_filled')
    expect(fieldType).toBe('text')
  })

  it('should export Knowledge types', () => {
    const entryType: KnowledgeEntryType = 'past_rfp'
    const sourceType: LearningSourceType = 'rfp_approval'

    expect(entryType).toBe('past_rfp')
    expect(sourceType).toBe('rfp_approval')
  })

  it('should export API types', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'test',
      timestamp: new Date().toISOString(),
    }

    expect(response.success).toBe(true)
    expect(response.data).toBe('test')
  })

  it('should support ProcessingStatus interface', () => {
    const status: ProcessingStatus = {
      status: 'generating_responses',
      progress: 50,
      currentStep: 'Generating response 5 of 10',
    }

    expect(status.status).toBe('generating_responses')
    expect(status.progress).toBe(50)
  })

  it('should support KnowledgeSearchResult interface', () => {
    const result: KnowledgeSearchResult = {
      entry: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        organizationId: 'org_123',
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'past_rfp',
        title: 'Test Entry',
        content: 'Content',
        embedding: null,
        chunkIndex: null,
        totalChunks: null,
        sectionHeading: null,
        tags: null,
        sourceEntryId: null,
        processingStatus: 'complete' as const,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      similarity: 0.85,
    }

    expect(result.similarity).toBe(0.85)
    expect(result.entry.type).toBe('past_rfp')
  })

  it('should support PaginatedResponse interface', () => {
    const paginated: PaginatedResponse<string> = {
      data: ['item1', 'item2'],
      pagination: {
        cursor: 'next-cursor',
        hasMore: true,
        limit: 10,
      },
    }

    expect(paginated.data.length).toBe(2)
    expect(paginated.pagination.hasMore).toBe(true)
  })

  it('should support ValidationError interface', () => {
    const error: ValidationError = {
      field: 'email',
      message: 'Invalid email format',
      code: 'invalid_string',
      path: ['email'],
    }

    expect(error.field).toBe('email')
    expect(error.code).toBe('invalid_string')
  })
})
