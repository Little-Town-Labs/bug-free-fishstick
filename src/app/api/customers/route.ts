import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema/customers'
import { createCustomerSchema } from '@/lib/utils/validation'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const auth = await requireAuth()

    const customersList = await db
      .select()
      .from(customers)
      .where(eq(customers.organizationId, auth.orgId))

    return NextResponse.json({ customers: customersList }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    const body = await request.json()

    const parsed = createCustomerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const [created] = await db
      .insert(customers)
      .values({
        organizationId: auth.orgId,
        name: parsed.data.name,
        description: parsed.data.description,
        settings: parsed.data.settings,
      })
      .returning()

    return NextResponse.json({ customer: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
