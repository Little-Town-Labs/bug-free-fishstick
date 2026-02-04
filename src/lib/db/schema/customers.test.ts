import { describe, it, expect } from 'vitest'
import { customers } from './customers'

describe('customers schema', () => {
  it('should have the correct table name', () => {
    expect(customers._.name).toBe('customers')
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
