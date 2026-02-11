import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { processRfp } from '@/lib/inngest/functions/process-rfp'
import { exportDocument } from '@/lib/inngest/functions/export-document'
import { generateEmbeddingsFunction } from '@/lib/inngest/functions/generate-embeddings'
import { extractLearnings } from '@/lib/inngest/functions/extract-learnings'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processRfp, exportDocument, generateEmbeddingsFunction, extractLearnings],
})
