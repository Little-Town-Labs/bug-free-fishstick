import { put, del, get } from '@vercel/blob'

/**
 * Sanitizes a user-supplied filename for safe use in a blob storage pathname.
 * Strips directory components and replaces characters outside [a-zA-Z0-9._-]
 * so names containing '/' or '..' cannot alter the storage path.
 */
export function sanitizeFilename(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? ''
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  return cleaned || 'upload'
}

export interface UploadOptions {
  organizationId: string
  rfpId: string
  fileName: string
  fileType: 'pdf' | 'docx'
}

/**
 * Uploads an RFP document to Vercel Blob storage
 * @param file - File buffer or readable stream
 * @param options - Upload options including organization/RFP IDs for tenant isolation
 * @returns Object containing the uploaded file URL
 */
export async function uploadRfpDocument(
  file: Buffer | ReadableStream,
  options: UploadOptions
): Promise<{ url: string }> {
  const path = `${options.organizationId}/${options.rfpId}/${options.fileName}`

  const contentType = options.fileType === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  const blob = await put(path, file, {
    access: 'private',
    contentType,
  })

  return { url: blob.url }
}

/**
 * Downloads a blob and returns it as a Buffer. Reads via the authenticated
 * blob API (private access); blobs uploaded before the private-access
 * migration are still public, so a plain fetch is used as a fallback until
 * scripts/migrate-blobs-to-private.ts has been run.
 * @param url - The blob URL to download
 */
export async function downloadFile(url: string): Promise<Buffer> {
  try {
    const result = await get(url, { access: 'private' })
    if (result?.stream) {
      const arrayBuffer = await new Response(result.stream).arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
  } catch {
    // Legacy public blob (or non-blob URL) — fall through to plain fetch
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Deletes a file from Vercel Blob storage
 * @param url - The URL of the file to delete
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url)
}
