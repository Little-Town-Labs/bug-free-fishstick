import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { rfps, proposalDrafts, tenantSettings, proposalTemplates } from '@/lib/db/schema'
import { proposalTemplateSections } from '@/lib/db/schema/proposal-templates'
import type { ProposalTemplate } from '@/lib/db/schema/proposal-templates'
import type { CoverageReport } from '@/lib/db/schema/proposal-drafts'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/services/encryption'
import { getRateCard } from '@/lib/services/rate-card'
import {
  searchByRequirements,
  fetchTypedSupplierContext,
  fetchCustomerContext,
  fetchLearnings,
} from '@/lib/services/proposal-retrieval'
import type { CustomerContext, TypedSupplierContext } from '@/lib/services/proposal-retrieval'
import type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'
import type { Learning } from '@/lib/db/schema/learnings'
import { parseScopeLines } from '@/lib/services/scope-line-parser'
import { computePricingEstimate } from '@/lib/services/pricing-computation'
import { writeProposal } from '@/lib/ai/agents/proposal-writer'
import { checkCoverage } from '@/lib/ai/agents/proposal-coverage-checker'
import { updateDraftContent } from '@/lib/services/proposal-draft'
import { computeKbCoveragePercentage } from '@/lib/services/kb-coverage-metric'
import { fetchContentLibraryForProposal, fetchFixedSectionsForProposal, formatRateCardRoles } from '@/lib/services/content-library-retrieval'
import type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-retrieval'

// ─── Private helpers ────────────────────────────────────────────────────────

function generateCoverageReportFallback(rfp: { parsedStructure?: { fields: Array<{ id: string; question: string }> } | null }): CoverageReport {
  return {
    coverageScore: 0,
    evaluatedAt: new Date().toISOString(),
    requirements: rfp.parsedStructure?.fields.map((f) => ({
      requirementId: f.id,
      question: f.question,
      addressed: false,
      evidence: null,
      gap: 'Coverage evaluation failed — use Re-check Coverage to retry',
    })) ?? [],
  }
}

function renderTemplatesBlock(templates: ProposalTemplate[]): string {
  if (templates.length === 0) return ''
  const sorted = [...templates].sort((a, b) => {
    const aIdx = proposalTemplateSections.indexOf(a.section as typeof proposalTemplateSections[number])
    const bIdx = proposalTemplateSections.indexOf(b.section as typeof proposalTemplateSections[number])
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.sortOrder - b.sortOrder
  })
  const body = sorted.map((t) => `### ${t.title}\n\n${t.content}`).join('\n\n')
  return `\n\n---\n\n## Supplier Terms & Conditions\n\n${body}`
}

function matchesSituational(
  template: ProposalTemplate,
  rfpType: string | null,
  industryTags: string[] | null,
): boolean {
  const hasRfpTypeTrigger = template.triggerRfpTypes !== null && template.triggerRfpTypes.length > 0
  const hasTagTrigger = template.triggerIndustryTags !== null && template.triggerIndustryTags.length > 0
  if (!hasRfpTypeTrigger && !hasTagTrigger) return true
  if (hasRfpTypeTrigger && rfpType && template.triggerRfpTypes!.includes(rfpType)) return true
  if (hasTagTrigger && industryTags?.some((tag) => template.triggerIndustryTags!.includes(tag))) return true
  return false
}

// ─── Inngest function ───────────────────────────────────────────────────────

export const generateProposal = inngest.createFunction(
  { id: 'generate-proposal', name: 'Generate Proposal Draft' },
  { event: 'proposal/generate' },
  async ({ event, step }) => {
    const { draftId, rfpId, organizationId } = event.data

    // Pre-step: decrypt BYOK OpenAI key (never serialized by Inngest)
    const openaiApiKey = await (async () => {
      const [row] = await db
        .select({ k: tenantSettings.openaiApiKeyEncrypted })
        .from(tenantSettings)
        .where(eq(tenantSettings.organizationId, organizationId))
        .limit(1)
      return row?.k ? decrypt(row.k) : undefined
    })()

    try {
      // Step 1: Fetch draft and RFP
      const { draft, rfp } = await step.run('fetch-draft-and-rfp', async () => {
        const [d] = await db
          .select()
          .from(proposalDrafts)
          .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, organizationId)))
          .limit(1)
        const [r] = await db
          .select()
          .from(rfps)
          .where(and(eq(rfps.id, rfpId), eq(rfps.organizationId, organizationId)))
          .limit(1)
        return { draft: d, rfp: r }
      })

      if (!draft || !rfp) throw new Error('Draft or RFP not found')

      // Steps 2–7: Parallel fetches (includes Content Library)
      const [
        customerContext,
        requirementResults,
        { supplierContext, companyProfile, learnings },
        requiredTemplates,
        allSituationalTemplates,
        { fixedSections, customEntries: contentLibraryEntries },
      ] = await Promise.all([
        step.run('fetch-customer-context', async () => {
          if (!rfp.customerId) return null
          try { return await fetchCustomerContext(rfp.customerId, organizationId) }
          catch { return null }
        }),
        step.run('search-requirements', async () => {
          try { return await searchByRequirements(rfp.parsedStructure?.fields ?? [], organizationId, openaiApiKey, rfp.customerId ?? undefined) }
          catch { return [] }
        }),
        step.run('fetch-typed-supplier-context', async () => {
          try {
            const [ctx, learns, [settings]] = await Promise.all([
              fetchTypedSupplierContext(organizationId, rfp.industryTags as string[] | null, rfp.rfpType),
              fetchLearnings(organizationId, rfp.customerId ?? undefined),
              db.select({ cp: tenantSettings.companyProfile })
                .from(tenantSettings)
                .where(eq(tenantSettings.organizationId, organizationId))
                .limit(1),
            ])
            return { supplierContext: ctx, learnings: learns, companyProfile: (settings?.cp ?? null) as string | null }
          } catch {
            return { supplierContext: { companyDocs: [], certifications: [], caseStudies: [], wonPastRfps: [] }, learnings: [], companyProfile: null }
          }
        }),
        step.run('fetch-required-templates', async () => {
          try {
            return await db.select().from(proposalTemplates)
              .where(and(eq(proposalTemplates.organizationId, organizationId), eq(proposalTemplates.isRequired, true)))
          } catch { return [] }
        }),
        step.run('fetch-situational-templates', async () => {
          try {
            return await db.select().from(proposalTemplates)
              .where(and(eq(proposalTemplates.organizationId, organizationId), eq(proposalTemplates.isRequired, false)))
          } catch { return [] }
        }),
        step.run('fetch-content-library', async () => {
          try {
            const [fixedSections, customEntries] = await Promise.all([
              fetchFixedSectionsForProposal(organizationId),
              fetchContentLibraryForProposal(
                organizationId,
                rfp.parsedStructure?.fields ?? [],
                openaiApiKey,
              ),
            ])
            return { fixedSections, customEntries }
          } catch { return { fixedSections: {} as Record<string, string>, customEntries: [] as ContentLibraryEntryWithSimilarity[] } }
        }),
      // Inngest step.run returns Jsonify<T> which converts Date→string; cast back to original types
      ]) as unknown as [
        CustomerContext,
        KnowledgeEntryWithSimilarity[],
        { supplierContext: TypedSupplierContext; learnings: Learning[]; companyProfile: string | null },
        ProposalTemplate[],
        ProposalTemplate[],
        { fixedSections: Record<string, string>; customEntries: ContentLibraryEntryWithSimilarity[] },
      ]

      // Filter situational templates (OR logic)
      const situationalTemplates = allSituationalTemplates.filter((t) =>
        matchesSituational(t, rfp.rfpType, rfp.industryTags as string[] | null),
      )

      // Step 7: Compute pricing + extract rate card roles
      const { pricingMarkdown, rateCardRolesMarkdown } = await step.run('compute-pricing', async () => {
        const { rateCard, proposalDefaults } = await getRateCard(organizationId)
        const scopeLines = parseScopeLines(draft.clarifyingQuestions ?? [])
        const estimate = computePricingEstimate(
          rateCard,
          scopeLines,
          proposalDefaults?.pricingModel ?? 'time_and_materials',
        )
        return {
          pricingMarkdown: estimate.formattedMarkdown,
          rateCardRolesMarkdown: formatRateCardRoles(rateCard),
        }
      })

      // Step 8: Generate proposal content
      const rfpSections = rfp.parsedStructure
        ? rfp.parsedStructure.fields.map((f) => ({ id: f.id, title: f.question, content: f.question }))
        : [{ id: 'default', title: rfp.name, content: rfp.name }]

      const { markdownContent } = await step.run('generate-proposal-content', async () => {
        return writeProposal({
          rfpSections,
          requirementResults,
          supplierContext,
          companyProfile,
          customerContext,
          learnings,
          pricingMarkdown,
          clarifyingAnswers: draft.clarifyingQuestions ?? [],
          organizationId,
          rfpName: rfp.name,
          rfpMetadata: rfp.extractedMetadata,
          contentLibraryEntries,
          rateCardRolesMarkdown,
          fixedSections,
        })
      })

      // Step 9: Coverage check
      const coverageReport = await step.run('check-requirement-coverage', async () => {
        const allTemplates = [...requiredTemplates, ...situationalTemplates]
        const evaluateCoverageTemplates = allTemplates
          .filter((t) => t.evaluateCoverage)
          .map((t) => ({ title: t.title, content: t.content }))
        try {
          return await checkCoverage({
            requirements: rfp.parsedStructure?.fields.map((f) => ({ id: f.id, question: f.question })) ?? [],
            proposalMarkdown: markdownContent,
            evaluateCoverageTemplates,
            organizationId,
          })
        } catch {
          return generateCoverageReportFallback(rfp)
        }
      })

      // Step 10: Inject templates verbatim post-LLM
      const finalMarkdown = await step.run('inject-required-templates', async () => {
        const allTemplates = [...requiredTemplates, ...situationalTemplates]
        return markdownContent + renderTemplatesBlock(allTemplates)
      })

      // Step 11: Compute KB coverage metric and save content + coverage report
      await step.run('save-proposal-content', async () => {
        const kbCoveragePercentage = computeKbCoveragePercentage(finalMarkdown)
        const enrichedCoverageReport = { ...coverageReport, kbCoveragePercentage }
        return updateDraftContent(draftId, organizationId, finalMarkdown, enrichedCoverageReport)
      })

      return { draftId, status: 'draft' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during generation'
      await db.update(proposalDrafts)
        .set({ status: 'error', generationError: msg, updatedAt: new Date() })
        .where(and(eq(proposalDrafts.id, draftId), eq(proposalDrafts.organizationId, organizationId)))
      return { draftId, status: 'error', error: msg }
    }
  },
)
