import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthLimited, AuthError } from '@/lib/utils/auth'
import { authErrorResponse } from '@/lib/utils/api-error'
import { submitAnswers } from '@/lib/services/proposal-draft'

type Params = { params: Promise<{ rfpId: string; draftId: string }> }

const answersSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      answer: z.string(),
    })
  ),
})

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuthLimited()
    const { draftId } = await params

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = answersSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const draft = await submitAnswers(draftId, orgId, parsed.data.answers)
    return NextResponse.json({ draft }, { status: 202 })
  } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err)
    }
    const statusCode = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode
    if (statusCode === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (statusCode === 409) return NextResponse.json({ error: (err as Error).message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
