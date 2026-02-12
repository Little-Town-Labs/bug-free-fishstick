import type { KnowledgeEntry, NewKnowledgeEntry } from '@/lib/db/schema/knowledge-entries'
import type { Learning, NewLearning } from '@/lib/db/schema/learnings'

// Re-export types from schema
export { type KnowledgeEntryType, knowledgeEntryTypes } from '@/lib/db/schema/knowledge-entries'
export { type LearningSourceType, learningSourceTypes } from '@/lib/db/schema/learnings'

// Re-export base types from schema
export type { KnowledgeEntry, NewKnowledgeEntry, Learning, NewLearning }

/**
 * Knowledge search result with similarity score
 * Used for semantic search results from vector database
 */
export interface KnowledgeSearchResult {
  entry: KnowledgeEntry
  similarity: number // 0-1 cosine similarity score
  relevance?: number // Optional relevance score (0-1)
}

/**
 * Knowledge entry with enriched metadata
 * Used for detailed views and editing
 */
export interface KnowledgeEntryWithMetadata extends KnowledgeEntry {
  customer: {
    id: string
    name: string
  }
  usageCount?: number
  lastUsedAt?: Date
  tags: string[]
}

/**
 * Knowledge base statistics
 * Used for dashboard metrics
 */
export interface KnowledgeStatistics {
  totalEntries: number
  byType: Record<string, number>
  byCustomer: Array<{
    customerId: string
    customerName: string
    count: number
  }>
  recentlyAdded: number // Last 7 days
  totalWords: number
  averageEntrySize: number
}

/**
 * Learning suggestion
 * Used for auto-learning features
 */
export interface LearningSuggestion {
  content: string
  sourceType: 'rfp_approval' | 'user_correction' | 'manual_entry'
  confidence: number
  sourceMetadata: {
    rfpId?: string
    fieldId?: string
    originalText?: string
    correctedText?: string
  }
  suggestedFor?: string // customer ID if applicable
}

/**
 * Knowledge import result
 * Used for batch knowledge imports
 */
export interface KnowledgeImportResult {
  success: boolean
  imported: number
  failed: number
  errors: Array<{
    line: number
    error: string
    data?: unknown
  }>
  entries: KnowledgeEntry[]
}

/**
 * Vector search configuration
 * Used for configuring semantic search
 */
export interface VectorSearchConfig {
  query: string
  limit: number
  minSimilarity?: number // Minimum similarity threshold (0-1)
  customerId?: string // Filter by customer
  types?: string[] // Filter by entry types
  tags?: string[] // Filter by tags
}
