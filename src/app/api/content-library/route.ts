import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { readJsonBody } from '@/lib/utils/request'
import { createEntry, listEntries, ensureFixedSections } from '@/lib/services/proposal-content-library'

const CreateEntrySchema = z.object({
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()
    await ensureFixedSections(auth.orgId, 'system')
    const category = request.nextUrl.searchParams.get('category') ?? undefined
    const rawType = request.nextUrl.searchParams.get('type')
    const typeFilter = rawType === 'fixed' || rawType === 'custom' ? rawType : undefined
    const entries = await listEntries(auth.orgId, category, typeFilter)
    return NextResponse.json({ entries }, { status: 200 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthLimited()
    const body = await readJsonBody(request)
    const parsed = CreateEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }
    const entry = await createEntry(auth.orgId, auth.userId, parsed.data)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
