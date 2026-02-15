import { Inngest, EventSchemas } from 'inngest'

type Events = {
  'rfp/uploaded': {
    data: {
      rfpId: string
      organizationId: string
      fileUrl: string
    }
  }
  'rfp/process': {
    data: {
      rfpId: string
      organizationId: string
    }
  }
  'rfp/generate-embeddings': {
    data: {
      knowledgeEntryId: string
      organizationId: string
      content: string
    }
  }
  'rfp/export': {
    data: {
      rfpId: string
      organizationId: string
      format: 'pdf' | 'docx'
    }
  }
  'rfp/extract-learnings': {
    data: {
      rfpId: string
      organizationId: string
    }
  }
  'rfp/generate-completed-document': {
    data: {
      rfpId: string
      organizationId: string
    }
  }
  'proposal/generate': {
    data: {
      draftId: string
      rfpId: string
      organizationId: string
    }
  }
  'rfp/capture-learning': {
    data: {
      type: 'accept' | 'edit' | 'reject'
      rfpId: string
      fieldId: string
      organizationId: string
      customerId?: string
      userId: string
      originalText?: string
      correctedText?: string
      questionType?: string
      confidence?: number
    }
  }
  'content-library/generate-embedding': {
    data: {
      entryId: string
      organizationId: string
    }
  }
  'content-library/batch-embed': {
    data: {
      organizationId: string
    }
  }
  'knowledge/chunk-document': {
    data: {
      knowledgeEntryId: string
      organizationId: string
      customerId?: string
    }
  }
  'analytics/compute-snapshots': {
    data: Record<string, never>
  }
  'analytics/compute-org-snapshot': {
    data: {
      organizationId: string
      snapshotDate: string
    }
  }
  'integration/slack-notify': {
    data: {
      organizationId: string
      eventType: string
      rfpId: string
      rfpName: string
      assignedUserId?: string
      actorUserId?: string
      extraFields?: Record<string, string>
    }
  }
  'integration/crm-sync-rfp': {
    data: {
      organizationId: string
      rfpId: string
      outcome: 'won' | 'lost'
      crmDealId?: string
    }
  }
  'integration/retry-failed': {
    data: {
      syncEventId: string
      organizationId: string
    }
  }
}

export const inngest = new Inngest({
  id: 'rfp-automator',
  schemas: new EventSchemas().fromRecord<Events>(),
})
