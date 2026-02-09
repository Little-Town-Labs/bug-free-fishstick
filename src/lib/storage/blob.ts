import { put, del } from '@vercel/blob'

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
    access: 'public',
    contentType,
  })

  return { url: blob.url }
}

/**
 * Deletes a file from Vercel Blob storage
 * @param url - The URL of the file to delete
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url)
}
