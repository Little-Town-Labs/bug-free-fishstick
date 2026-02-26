import { generateObject } from 'ai'
import { z } from 'zod'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import type { CoverageReport, CoverageRequirement } from '@/lib/db/schema/proposal-drafts'

export interface CoverageCheckerInput {
  requirements: Array<{ id: string; question: string }>
  proposalMarkdown: string
  evaluateCoverageTemplates: Array<{ title: string; content: string }>
  organizationId: string
}

const coverageResultSchema = z.object({
  requirements: z.array(
    z.object({
      requirementId: z.string(),
      addressed: z.boolean(),
      evidence: z.string().nullable(),
      gap: z.string().nullable(),
    })
  ),
})

export async function checkCoverage(input: CoverageCheckerInput): Promise<CoverageReport> {
  const allRequirements = [
    ...input.requirements.map((r) => ({
      requirementId: r.id,
      question: r.question,
    })),
    ...input.evaluateCoverageTemplates.map((t) => ({
      requirementId: `template:${t.title}`,
      question: `Does the proposal include content for: ${t.title}?`,
    })),
  ]

  if (allRequirements.length === 0) {
    return {
      coverageScore: 0,
      evaluatedAt: new Date().toISOString(),
      requirements: [],
    }
  }

  if (!input.proposalMarkdown || input.proposalMarkdown.trim().length === 0) {
    return {
      coverageScore: 0,
      evaluatedAt: new Date().toISOString(),
      requirements: allRequirements.map((r) => ({
        requirementId: r.requirementId,
        question: r.question,
        addressed: false,
        evidence: null,
        gap: 'Proposal content is empty',
      })),
    }
  }

  const model = await getLanguageModelForOrg(input.organizationId)

  const { object } = await generateObject({
    model,
    schema: coverageResultSchema,
    prompt: `You are a proposal coverage evaluator. Your job is to determine whether a proposal addresses each RFP requirement.

For each requirement below, examine the proposal and determine:
- **addressed**: true if the proposal contains substantive content responding to this requirement (not just a placeholder like "[PLACEHOLDER]")
- **evidence**: if addressed, quote the most relevant sentence or phrase from the proposal that demonstrates coverage (keep quotes under 200 characters)
- **gap**: if not addressed, briefly explain what is missing (keep under 200 characters)

Requirements to evaluate:
${allRequirements.map((r, i) => `${i + 1}. [${r.requirementId}] ${r.question}`).join('\n')}

Proposal:
${input.proposalMarkdown}`,
  })

  const resultMap = new Map(
    object.requirements.map((r) => [r.requirementId, r])
  )

  const requirements: CoverageRequirement[] = allRequirements.map((r) => {
    const result = resultMap.get(r.requirementId)
    return {
      requirementId: r.requirementId,
      question: r.question,
      addressed: result?.addressed ?? false,
      evidence: result?.evidence ?? null,
      gap: result?.gap ?? 'No evaluation result returned',
    }
  })

  const addressedCount = requirements.filter((r) => r.addressed).length
  const coverageScore = requirements.length > 0
    ? Math.round((addressedCount / requirements.length) * 100)
    : 0

  return {
    coverageScore,
    evaluatedAt: new Date().toISOString(),
    requirements,
  }
}
