import type { Rfp, NewRfp } from '@/lib/db/schema/rfps'
import type { RfpResponse } from '@/lib/db/schema/rfp-responses'
import type { RfpVersion } from '@/lib/db/schema/rfp-versions'

// Re-export status types from schema
export { type RfpStatus, rfpStatuses } from '@/lib/db/schema/rfps'
export { type ResponseStatus, responseStatuses } from '@/lib/db/schema/rfp-responses'
export { type FieldType, fieldTypes } from '@/lib/db/schema/rfp-responses'

// Re-export base types from schema
export type { Rfp, NewRfp, RfpResponse, RfpVersion }

/**
 * Processing status for RFP automation
 * Tracks the current state of AI processing
 */
export interface ProcessingStatus {
  status: 'idle' | 'parsing' | 'extracting_fields' | 'generating_responses' | 'complete' | 'error'
  progress: number // 0-100
  currentStep?: string
  error?: string
}

/**
 * RFP with related responses
 * Used for detailed views and editing
 */
export interface RfpWithResponses extends Rfp {
  responses: RfpResponse[]
  customer?: {
    id: string
    name: string
    settings?: {
      preferredTone?: 'formal' | 'casual' | 'technical'
      industryContext?: string
      customInstructions?: string
    }
  }
}

/**
 * RFP export format
 * Used for generating completed RFP documents
 */
export interface RfpExport {
  rfp: Rfp
  responses: Array<{
    fieldId: string
    question: string
    responseText: string
    status: ResponseStatus
    position: {
      page: number
      x: number
      y: number
      width: number
      height: number
      fontSize?: number
    }
  }>
  metadata: {
    exportedAt: string
    exportedBy: string
    version: number
    automationPercentage: number
  }
}

/**
 * RFP list item
 * Used for list views and dashboards
 */
export interface RfpListItem {
  id: string
  name: string
  status: RfpStatus
  customerName: string
  customerId: string
  dueDate: string | null
  automationPercentage: number
  totalFields: number
  completedFields: number
  createdAt: Date
  updatedAt: Date
}

/**
 * RFP statistics
 * Used for dashboard metrics
 */
export interface RfpStatistics {
  total: number
  byStatus: Record<RfpStatus, number>
  averageAutomationPercentage: number
  totalFields: number
  autoFilledFields: number
  manuallyFilledFields: number
  needsInputFields: number
}
