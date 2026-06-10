import { NextRequest, NextResponse } from 'next/server'
import { requireAuthLimited, isAdmin, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { rfps } from '@/lib/db/schema/rfps'
import { eq, and } from 'drizzle-orm'
import { encryptJson, decryptJson } from '@/lib/services/encryption'
import { updateRfpSchema } from '@/lib/utils/validation'

interface ContactInfo {
  email?: string
  phone?: string
  address?: string
}

function decryptRfpPii<T extends { customerContactInfo?: unknown }>(rfp: T): T {
  return {
    ...rfp,
    customerContactInfo: decryptJson<ContactInfo>(rfp.customerContactInfo),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    return NextResponse.json({ rfp: decryptRfpPii(rfp) }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateRfpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    if (parsed.data.assignedUserId !== undefined && !isAdmin(auth.orgRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Encrypt PII before storage
    const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
    if (updateData.customerContactInfo !== undefined) {
      updateData.customerContactInfo = encryptJson(updateData.customerContactInfo)
    }

    const [updatedRfp] = await db
      .update(rfps)
      .set(updateData)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))
      .returning()

    if (!updatedRfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    return NextResponse.json({ rfp: decryptRfpPii(updatedRfp) }, { status: 200 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> }
) {
  try {
    const auth = await requireAuthLimited()
    const { rfpId } = await params

    const result = await db
      .delete(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, auth.orgId)))

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    throw error
  }
}
