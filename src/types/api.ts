/**
 * Generic API response wrapper
 * Provides consistent response structure across all endpoints
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  timestamp: string
}

/**
 * API error structure
 * Provides detailed error information for debugging and user feedback
 */
export interface ApiError {
  code: string
  message: string
  details?: unknown
  statusCode: number
  path?: string
}

/**
 * Paginated response with cursor pagination
 * Used for efficient pagination of large datasets
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    cursor: string | null // Next cursor for pagination, null if no more results
    hasMore: boolean
    total?: number // Total count (optional, may be expensive to compute)
    limit: number
  }
}

/**
 * Validation error structure
 * Used for Zod validation errors with field-level details
 */
export interface ValidationError {
  field: string
  message: string
  code: string
  path: (string | number)[]
}

/**
 * Batch operation result
 * Used for operations that process multiple items
 */
export interface BatchOperationResult<T> {
  success: number
  failed: number
  total: number
  results: Array<{
    success: boolean
    data?: T
    error?: ApiError
  }>
}

/**
 * Upload result
 * Used for file upload responses
 */
export interface UploadResult {
  url: string
  filename: string
  size: number
  mimeType: string
  uploadedAt: string
}

/**
 * Job status
 * Used for tracking long-running background jobs
 */
export interface JobStatus {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0-100
  startedAt?: string
  completedAt?: string
  error?: ApiError
  result?: unknown
}

/**
 * Health check response
 * Used for monitoring API availability
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  services: {
    database: 'up' | 'down'
    storage: 'up' | 'down'
    cache: 'up' | 'down'
    llm: 'up' | 'down'
  }
  timestamp: string
}

/**
 * Common error codes
 * Used for consistent error handling across the application
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  LLM_ERROR: 'LLM_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // Business logic errors
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_FAILED: 'OPERATION_FAILED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
