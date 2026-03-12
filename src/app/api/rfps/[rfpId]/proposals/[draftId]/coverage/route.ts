import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/utils/auth'
import { db } from '@/lib/db'
import { proposalDrafts, rfps, proposalTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { checkCoverage } from '@/lib/ai/agents/proposal-coverage-checker'

type Params = { params: Promise<{ rfpId: string; draftId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await requireAuth()
    const { rfpId, draftId } = await params

    // Fetch draft (tenant-scoped)
    const [draft] = await db
      .select()
      .from(proposalDrafts)
      .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))
      .limit(1)

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // Fetch RFP (tenant-scoped)
    const [rfp] = await db
      .select()
      .from(rfps)
      .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, orgId)))
      .limit(1)

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    // Fetch templates with evaluateCoverage: true
    const templates = await db
      .select()
      .from(proposalTemplates)
      .where(and(eq(proposalTemplates.organizationId, orgId), eq(proposalTemplates.evaluateCoverage, true)))

    const evaluateCoverageTemplates = templates.map((t) => ({ title: t.title, content: t.content }))

    // Run coverage check
    const coverageReport = await checkCoverage({
      requirements: rfp.parsedStructure?.fields.map((f) => ({ id: f.id, question: f.question })) ?? [],
      proposalMarkdown: draft.markdownContent ?? '',
      evaluateCoverageTemplates,
      organizationId: orgId,
    })

    // Save to draft
    await db
      .update(proposalDrafts)
      .set({ coverageReport, updatedAt: new Date() })
      .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, orgId)))

    return NextResponse.json(coverageReport)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Coverage evaluation failed' }, { status: 500 })
  }
}
