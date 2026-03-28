import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { getEntry, updateEntry, deleteEntry } from '@/lib/services/proposal-content-library'

const PatchEntrySchema = z.object({
  category: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
})

type Params = { params: Promise<{ entryId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth()
    const { entryId } = await params
    const entry = await getEntry(entryId, auth.orgId)
    return NextResponse.json({ entry }, { status: 200 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth()
    const { entryId } = await params
    const body = await request.json()
    const parsed = PatchEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }
    const entry = await updateEntry(entryId, auth.orgId, parsed.data)
    return NextResponse.json({ entry }, { status: 200 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 400) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 })
    }
    if (statusCode === 404) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth()
    const { entryId } = await params
    await deleteEntry(entryId, auth.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 403) {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 })
    }
    if (statusCode === 404) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
