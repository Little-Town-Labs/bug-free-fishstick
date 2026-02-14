import { pgTable, text, timestamp, uuid, date, real, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const rfpStatuses = ['draft', 'processing', 'submitted', 'approved', 'finalized'] as const
export type RfpStatus = (typeof rfpStatuses)[number]

export const rfps = pgTable(
  'rfps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    assignedUserId: text('assigned_user_id').notNull(),

    // RFP metadata
    name: text('name').notNull(),
    status: text('status', { enum: rfpStatuses }).notNull().default('draft'),

    // Contact info
    customerCompanyName: text('customer_company_name'),
    customerContactName: text('customer_contact_name'),
    customerContactInfo: jsonb('customer_contact_info').$type<{
      email?: string
      phone?: string
      address?: string
    }>(),

    // Dates
    receiveDate: date('receive_date'),
    dueDate: date('due_date'),
    completionDate: date('completion_date'),

    // Files (Vercel Blob URLs)
    originalFileUrl: text('original_file_url'),
    originalFileType: text('original_file_type', { enum: ['pdf', 'docx'] }),
    completedFileUrl: text('completed_file_url'),
    completedFileError: text('completed_file_error'),

    // Processing state
    automationPercentage: real('automation_percentage').default(0),
    version: integer('version').notNull().default(1),

    // Classification (auto-detected during processing)
    rfpType: text('rfp_type', { enum: ['technical', 'commercial', 'compliance', 'mixed'] as const }),
    complexity: text('complexity', { enum: ['simple', 'medium', 'complex'] as const }),
    industryTags: jsonb('industry_tags').$type<string[]>(),
    suggestedAssigneeId: text('suggested_assignee_id'),

    // Approval workflow
    returnComments: text('return_comments'),

    // Outcome tracking (set after finalization)
    outcome: text('outcome', { enum: ['won', 'lost'] as const }),
    outcomeSetAt: timestamp('outcome_set_at'),
    crmDealId: text('crm_deal_id'),

    // Parsed document structure (cached)
    parsedStructure: jsonb('parsed_structure').$type<{
      pages: number
      fields: Array<{
        id: string
        type: 'text' | 'paragraph' | 'checkbox' | 'table'
        question: string
        position: { page: number; x: number; y: number; width: number; height: number }
      }>
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('rfps_org_idx').on(table.organizationId),
    index('rfps_customer_idx').on(table.customerId),
    index('rfps_user_idx').on(table.assignedUserId),
    index('rfps_status_idx').on(table.status),
    index('rfps_type_idx').on(table.organizationId, table.rfpType),
    index('rfps_complexity_idx').on(table.organizationId, table.complexity),
  ]
)

export type Rfp = typeof rfps.$inferSelect
export type NewRfp = typeof rfps.$inferInsert
