import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setProcessingStatus,
  getProcessingStatus,
  deleteProcessingStatus,
  type ProcessingStatus,
} from '@/lib/storage/kv'

// Mock @vercel/kv
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}))

import { kv } from '@vercel/kv'

describe('Vercel KV Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setProcessingStatus', () => {
    it('should store RFP processing status with TTL', async () => {
      vi.mocked(kv.set).mockResolvedValue('OK' as any)

      const status: ProcessingStatus = {
        rfpId: 'rfp-123',
        status: 'parsing',
        progress: 25,
        currentStep: 'Extracting text from PDF',
        updatedAt: new Date().toISOString(),
      }

      await setProcessingStatus('rfp-123', status)

      expect(kv.set).toHaveBeenCalledWith(
        'rfp:rfp-123:status',
        JSON.stringify(status),
        { ex: 3600 }
      )
    })

    it('should store status with error field', async () => {
      vi.mocked(kv.set).mockResolvedValue('OK' as any)

      const status: ProcessingStatus = {
        rfpId: 'rfp-456',
        status: 'error',
        progress: 50,
        error: 'Failed to parse document',
        updatedAt: new Date().toISOString(),
      }

      await setProcessingStatus('rfp-456', status)

      const calledValue = vi.mocked(kv.set).mock.calls[0]![1]
      const parsed = JSON.parse(calledValue as string)
      expect(parsed.error).toBe('Failed to parse document')
    })

    it('should use correct key namespacing', async () => {
      vi.mocked(kv.set).mockResolvedValue('OK' as any)

      const status: ProcessingStatus = {
        rfpId: 'rfp-abc',
        status: 'queued',
        progress: 0,
        updatedAt: new Date().toISOString(),
      }

      await setProcessingStatus('rfp-abc', status)

      const calledKey = vi.mocked(kv.set).mock.calls[0]![0]
      expect(calledKey).toBe('rfp:rfp-abc:status')
    })
  })

  describe('getProcessingStatus', () => {
    it('should retrieve status from KV', async () => {
      const status: ProcessingStatus = {
        rfpId: 'rfp-123',
        status: 'extracting',
        progress: 50,
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(kv.get).mockResolvedValue(JSON.stringify(status))

      const result = await getProcessingStatus('rfp-123')

      expect(result).toEqual(status)
      expect(kv.get).toHaveBeenCalledWith('rfp:rfp-123:status')
    })

    it('should return null if status not found', async () => {
      vi.mocked(kv.get).mockResolvedValue(null)

      const result = await getProcessingStatus('rfp-nonexistent')

      expect(result).toBeNull()
    })

    it('should handle object responses from KV', async () => {
      const status: ProcessingStatus = {
        rfpId: 'rfp-456',
        status: 'complete',
        progress: 100,
        updatedAt: new Date().toISOString(),
      }

      // KV might return parsed object directly
      vi.mocked(kv.get).mockResolvedValue(status as any)

      const result = await getProcessingStatus('rfp-456')

      expect(result).toEqual(status)
    })

    it('should parse JSON string responses', async () => {
      const status: ProcessingStatus = {
        rfpId: 'rfp-789',
        status: 'generating',
        progress: 75,
        currentStep: 'Creating response document',
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(kv.get).mockResolvedValue(JSON.stringify(status))

      const result = await getProcessingStatus('rfp-789')

      expect(result).toEqual(status)
      expect(typeof result?.status).toBe('string')
    })
  })

  describe('deleteProcessingStatus', () => {
    it('should delete status by rfpId', async () => {
      vi.mocked(kv.del).mockResolvedValue(1)

      await deleteProcessingStatus('rfp-123')

      expect(kv.del).toHaveBeenCalledWith('rfp:rfp-123:status')
    })

    it('should use correct key namespacing for deletion', async () => {
      vi.mocked(kv.del).mockResolvedValue(1)

      await deleteProcessingStatus('rfp-xyz')

      const calledKey = vi.mocked(kv.del).mock.calls[0]![0]
      expect(calledKey).toBe('rfp:rfp-xyz:status')
    })
  })
})
