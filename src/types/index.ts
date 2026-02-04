// Re-export all types from schema
export type {
  TenantSetting,
  NewTenantSetting,
} from '@/lib/db/schema/tenant-settings'

export type { Customer, NewCustomer } from '@/lib/db/schema/customers'

export type {
  KnowledgeEntry,
  NewKnowledgeEntry,
} from '@/lib/db/schema/knowledge-entries'

export type { Rfp, NewRfp } from '@/lib/db/schema/rfps'

export type { RfpResponse, NewRfpResponse } from '@/lib/db/schema/rfp-responses'

export type { RfpVersion, NewRfpVersion } from '@/lib/db/schema/rfp-versions'

export type { Learning, NewLearning } from '@/lib/db/schema/learnings'

// RFP Status enum
export type RfpStatus =
  | 'draft'
  | 'processing'
  | 'review'
  | 'submitted'
  | 'approved'
  | 'finalized'

// Knowledge entry types
export type KnowledgeEntryType =
  | 'rfp_response'
  | 'case_study'
  | 'certification'
  | 'document'

// Field types
export type FieldType = 'text' | 'textarea' | 'checkbox' | 'radio' | 'select'

// Confidence score thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.4,
} as const

// User roles
export type UserRole = 'super_admin' | 'admin' | 'user'
