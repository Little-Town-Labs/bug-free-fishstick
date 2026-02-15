import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { processRfp } from '@/lib/inngest/functions/process-rfp'
import { exportDocument } from '@/lib/inngest/functions/export-document'
import { generateEmbeddingsFunction } from '@/lib/inngest/functions/generate-embeddings'
import { extractLearnings } from '@/lib/inngest/functions/extract-learnings'
import { generateProposal } from '@/lib/inngest/functions/generate-proposal'
import { generateCompletedDocument } from '@/lib/inngest/functions/generate-completed-document'
import { captureLearning } from '@/lib/inngest/functions/capture-learning'
import { generateContentLibraryEmbedding, batchEmbedContentLibrary } from '@/lib/inngest/functions/content-library-embedding'
import { chunkDocumentFunction } from '@/lib/inngest/functions/chunk-document'
import { computeSnapshots } from '@/lib/inngest/functions/compute-snapshots'
import { computeOrgSnapshotFunction } from '@/lib/inngest/functions/compute-org-snapshot'
import { slackNotify } from '@/lib/inngest/functions/slack-notify'
import { crmSyncRfp } from '@/lib/inngest/functions/crm-sync-rfp'
import { retryFailedSync } from '@/lib/inngest/functions/retry-failed-sync'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processRfp, exportDocument, generateEmbeddingsFunction, extractLearnings, generateProposal, generateCompletedDocument, captureLearning, generateContentLibraryEmbedding, batchEmbedContentLibrary, chunkDocumentFunction, computeSnapshots, computeOrgSnapshotFunction, slackNotify, crmSyncRfp, retryFailedSync],
})
