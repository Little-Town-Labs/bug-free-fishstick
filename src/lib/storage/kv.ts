import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export interface ProcessingStatus {
  rfpId: string
  status: 'queued' | 'parsing' | 'extracting' | 'generating' | 'checking' | 'complete' | 'error'
  progress: number
  currentStep?: string
  error?: string
  updatedAt: string
}

const PROCESSING_STATUS_TTL = 3600 // 1 hour

/**
 * Stores RFP processing status in Vercel KV with TTL
 * @param rfpId - The RFP ID
 * @param status - Processing status object
 */
export async function setProcessingStatus(
  rfpId: string,
  status: ProcessingStatus
): Promise<void> {
  await redis.set(
    `rfp:${rfpId}:status`,
    JSON.stringify(status),
    { ex: PROCESSING_STATUS_TTL }
  )
}

/**
 * Retrieves RFP processing status from Vercel KV
 * @param rfpId - The RFP ID
 * @returns Processing status or null if not found
 */
export async function getProcessingStatus(
  rfpId: string
): Promise<ProcessingStatus | null> {
  const data = await redis.get<string>(`rfp:${rfpId}:status`)

  if (!data) return null

  // Handle both string and object responses from KV
  return typeof data === 'string' ? JSON.parse(data) : data
}

/**
 * Deletes RFP processing status from Vercel KV
 * @param rfpId - The RFP ID
 */
export async function deleteProcessingStatus(rfpId: string): Promise<void> {
  await redis.del(`rfp:${rfpId}:status`)
}
