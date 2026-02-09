import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadRfpDocument, deleteFile } from '@/lib/storage/blob'

// Mock @vercel/blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

import { put, del } from '@vercel/blob'

describe('Vercel Blob Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadRfpDocument', () => {
    it('should upload a PDF file and return URL', async () => {
      const mockBlob = { url: 'https://blob.vercel-storage.com/test.pdf' }
      vi.mocked(put).mockResolvedValue(mockBlob as any)

      const file = Buffer.from('test pdf content')
      const options = {
        organizationId: 'org-123',
        rfpId: 'rfp-456',
        fileName: 'proposal.pdf',
        fileType: 'pdf' as const,
      }

      const result = await uploadRfpDocument(file, options)

      expect(result.url).toBe(mockBlob.url)
      expect(put).toHaveBeenCalledWith(
        'org-123/rfp-456/proposal.pdf',
        file,
        {
          access: 'public',
          contentType: 'application/pdf',
        }
      )
    })

    it('should upload a DOCX file with correct content type', async () => {
      const mockBlob = { url: 'https://blob.vercel-storage.com/test.docx' }
      vi.mocked(put).mockResolvedValue(mockBlob as any)

      const file = Buffer.from('test docx content')
      const options = {
        organizationId: 'org-123',
        rfpId: 'rfp-456',
        fileName: 'proposal.docx',
        fileType: 'docx' as const,
      }

      await uploadRfpDocument(file, options)

      expect(put).toHaveBeenCalledWith(
        'org-123/rfp-456/proposal.docx',
        file,
        {
          access: 'public',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
      )
    })

    it('should generate path with organizationId for tenant isolation', async () => {
      const mockBlob = { url: 'https://blob.vercel-storage.com/test.pdf' }
      vi.mocked(put).mockResolvedValue(mockBlob as any)

      const file = Buffer.from('test content')
      const options = {
        organizationId: 'org-abc',
        rfpId: 'rfp-xyz',
        fileName: 'test.pdf',
        fileType: 'pdf' as const,
      }

      await uploadRfpDocument(file, options)

      const calledPath = vi.mocked(put).mock.calls[0]![0]
      expect(calledPath).toMatch(/^org-abc\//)
      expect(calledPath).toContain('rfp-xyz')
      expect(calledPath).toContain('test.pdf')
    })

    it('should work with ReadableStream input', async () => {
      const mockBlob = { url: 'https://blob.vercel-storage.com/test.pdf' }
      vi.mocked(put).mockResolvedValue(mockBlob as any)

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const options = {
        organizationId: 'org-123',
        rfpId: 'rfp-456',
        fileName: 'test.pdf',
        fileType: 'pdf' as const,
      }

      const result = await uploadRfpDocument(stream, options)

      expect(result.url).toBe(mockBlob.url)
      expect(put).toHaveBeenCalled()
    })
  })

  describe('deleteFile', () => {
    it('should delete file by URL', async () => {
      vi.mocked(del).mockResolvedValue(undefined as any)

      const url = 'https://blob.vercel-storage.com/test.pdf'
      await deleteFile(url)

      expect(del).toHaveBeenCalledWith(url)
    })

    it('should handle deletion errors', async () => {
      vi.mocked(del).mockRejectedValue(new Error('Delete failed'))

      const url = 'https://blob.vercel-storage.com/test.pdf'

      await expect(deleteFile(url)).rejects.toThrow('Delete failed')
    })
  })
})
