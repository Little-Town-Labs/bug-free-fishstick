import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { readJsonBody } from '@/lib/utils/request'
import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema/customers'
import { knowledgeEntries } from '@/lib/db/schema/knowledge-entries'
import { rfps } from '@/lib/db/schema/rfps'
import { updateCustomerSchema } from '@/lib/utils/validation'
import { eq, and, count } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { customerId } = await params

    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, auth.orgId)))
      .limit(1)

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const [[knowledgeCount], [rfpCount]] = await Promise.all([
      db.select({ count: count() }).from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.customerId, customerId), eq(knowledgeEntries.organizationId, auth.orgId))),
      db.select({ count: count() }).from(rfps)
        .where(and(eq(rfps.customerId, customerId), eq(rfps.organizationId, auth.orgId))),
    ])

    return NextResponse.json({
      customer: {
        ...customer,
        stats: {
          knowledgeEntries: knowledgeCount?.count ?? 0,
          totalRfps: rfpCount?.count ?? 0,
        },
      },
    }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { customerId } = await params
    const body = await readJsonBody(request)

    const parsed = updateCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, auth.orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { customerId } = await params

    const result = await db
      .delete(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, auth.orgId)))

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
