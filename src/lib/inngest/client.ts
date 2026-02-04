import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'rfp-automator',
  schemas: new EventSchemas().fromRecord<Events>(),
})

// Define event types
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
}

// Import EventSchemas for type safety
import { EventSchemas } from 'inngest'
