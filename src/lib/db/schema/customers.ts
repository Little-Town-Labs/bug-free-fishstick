import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id').notNull(),

    // Customer info
    name: text('name').notNull(),
    description: text('description'),

    // Customer-specific settings
    settings: jsonb('settings').$type<{
      preferredTone?: 'formal' | 'casual' | 'technical'
      industryContext?: string
      customInstructions?: string
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('customers_org_idx').on(table.organizationId)]
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
