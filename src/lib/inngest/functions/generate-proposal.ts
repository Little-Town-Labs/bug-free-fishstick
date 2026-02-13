import { inngest } from '@/lib/inngest/client'
import type { GetFunctionInput } from 'inngest'

export const generateProposal = inngest.createFunction(
  { id: 'generate-proposal', name: 'Generate Proposal Draft' },
  { event: 'proposal/generate' },
  async ({
    event,
    step,
  }: GetFunctionInput<typeof inngest, 'proposal/generate'>) => {
    const { draftId, rfpId, organizationId } = event.data

    // TODO: implement in T016
    // Step 1: Fetch RFP, answers, and content library entries
    // Step 2: Run proposal-writer agent
    // Step 3: Save markdown content and set status to 'draft'

    return { draftId, rfpId, organizationId }
  }
)
