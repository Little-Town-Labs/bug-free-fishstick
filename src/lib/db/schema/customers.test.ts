import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import { customers } from './customers'

describe('customers schema', () => {
  it('should have the correct table name', () => {
    expect(getTableName(customers)).toBe('customers')
  })

  it('should have required columns', () => {
    const columns = Object.keys(customers)
    expect(columns).toContain('id')
    expect(columns).toContain('organizationId')
    expect(columns).toContain('name')
    expect(columns).toContain('industry')
    expect(columns).toContain('notes')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })
})
