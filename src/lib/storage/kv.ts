import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/**
 * Returns a shared Upstash Redis client.
 * Accepts both UPSTASH_REDIS_REST_* (canonical) and KV_REST_API_* (legacy) env vars.
 * Returns null when neither set of credentials is available (e.g. local dev).
 */
export function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  if (!url || !token) return null

  _redis = new Redis({ url, token })
  return _redis
}

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
 * Stores RFP processing status in Upstash Redis with TTL
 * @param rfpId - The RFP ID
 * @param status - Processing status object
 */
export async function setProcessingStatus(rfpId: string, status: ProcessingStatus): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.set(`rfp:${rfpId}:status`, JSON.stringify(status), { ex: PROCESSING_STATUS_TTL })
}

/**
 * Retrieves RFP processing status from Upstash Redis
 * @param rfpId - The RFP ID
 * @returns Processing status or null if not found
 */
export async function getProcessingStatus(rfpId: string): Promise<ProcessingStatus | null> {
  const redis = getRedis()
  if (!redis) return null

  const data = await redis.get<string>(`rfp:${rfpId}:status`)
  if (!data) return null

  // Handle both string and object responses from KV
  return typeof data === 'string' ? JSON.parse(data) : data
}

/**
 * Deletes RFP processing status from Upstash Redis
 * @param rfpId - The RFP ID
 */
export async function deleteProcessingStatus(rfpId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.del(`rfp:${rfpId}:status`)
}
