import { generateText } from 'ai'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'
import type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'
import type { TypedSupplierContext, CustomerContext } from '@/lib/services/proposal-retrieval'
import type { Learning } from '@/lib/db/schema/learnings'

export interface WriteProposalInput {
  rfpSections: Array<{ id: string; title: string; content: string }>
  requirementResults: KnowledgeEntryWithSimilarity[]
  supplierContext: TypedSupplierContext
  companyProfile: string | null
  customerContext: CustomerContext
  learnings: Learning[]
  pricingMarkdown: string
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}

export interface WriteProposalResult {
  markdownContent: string
}

export async function writeProposal(input: WriteProposalInput): Promise<WriteProposalResult> {
  const {
    rfpSections,
    requirementResults,
    supplierContext,
    companyProfile,
    customerContext,
    learnings,
    pricingMarkdown,
    clarifyingAnswers,
    organizationId,
  } = input

  const model = await getLanguageModelForOrg(organizationId)

  const sectionsText = rfpSections
    .map((s) => `### ${s.title}\n${s.content}`)
    .join('\n\n')

  const requirementText = requirementResults.length > 0
    ? requirementResults.map((r) => `[${r.type}] ${r.title ?? 'Untitled'} (similarity: ${Math.round((r.similarity ?? 0) * 100)}%)\n${r.content}`).join('\n\n')
    : '(No knowledge base results available.)'

  const certsText = supplierContext.certifications.length > 0
    ? supplierContext.certifications.map((c) => `- ${c.title}: ${c.content}`).join('\n')
    : '(No certifications available.)'

  const caseStudiesText = supplierContext.caseStudies.length > 0
    ? supplierContext.caseStudies.map((c) => `- ${c.title}: ${c.content}`).join('\n')
    : '(No case studies available.)'

  const wonRfpsText = supplierContext.wonPastRfps.length > 0
    ? supplierContext.wonPastRfps.map((r) => `- ${r.title}: ${r.content}`).join('\n')
    : '(No past winning proposals available.)'

  const learningsText = learnings.length > 0
    ? learnings.map((l) => `- [${l.sourceType}] ${l.content}`).join('\n')
    : '(No learnings available.)'

  const answersText = clarifyingAnswers.length > 0
    ? clarifyingAnswers
        .map((a) => `Q (${a.rfpSection}): ${a.question}\nA: ${a.answer || '(skipped)'}`)
        .join('\n\n')
    : '(No clarifying answers provided.)'

  // Build prompt sections conditionally
  const promptBlocks: string[] = []

  promptBlocks.push(`## RFP Requirements\n${sectionsText}`)

  if (companyProfile && companyProfile.trim()) {
    promptBlocks.push(`## Company Profile\n${companyProfile}`)
  }

  promptBlocks.push(`## Knowledge Base Context\n${requirementText}`)
  promptBlocks.push(`## Certifications\n${certsText}`)
  promptBlocks.push(`## Case Studies\n${caseStudiesText}`)
  promptBlocks.push(`## Past Winning Proposals\n${wonRfpsText}`)

  if (customerContext) {
    const parts: string[] = []
    if (customerContext.preferredTone) parts.push(`Tone: ${customerContext.preferredTone}`)
    if (customerContext.industryContext) parts.push(`Industry: ${customerContext.industryContext}`)
    if (customerContext.customInstructions) parts.push(`Instructions: ${customerContext.customInstructions}`)
    if (parts.length > 0) {
      promptBlocks.push(`## Customer Preferences\n${parts.join('\n')}`)
    }
  }

  promptBlocks.push(`## Learnings\n${learningsText}`)
  promptBlocks.push(`## Scope & Clarifying Question Answers\n${answersText}`)
  promptBlocks.push(`## PRE-COMPUTED PRICING SECTION (insert verbatim)\n${pricingMarkdown}`)

  const { text } = await generateText({
    model,
    system: `You are an expert proposal writer generating a complete, professional first-pass proposal.

IMPORTANT RESTRICTIONS:
- Do NOT generate Terms & Conditions, Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, or Warranty sections. These will be added separately by the system.
- Do NOT perform any pricing calculations. The pricing section is pre-computed and provided to you.

FORMATTING RULES:
1. Create one section per RFP requirement (## Heading for each).
2. Immediately after each heading, add a source blockquote: > *Source: [source]*
3. Insert the pre-computed PRICING SECTION exactly as provided — do not modify it.
4. Use [PLACEHOLDER: brief description] for any section with insufficient evidence.
5. Start with # Proposal.`,
    prompt: `Write a complete proposal based on the following:\n\n${promptBlocks.join('\n\n')}\n\nGenerate the full proposal markdown now.`,
  })

  if (!text || typeof text !== 'string') {
    throw new Error('Proposal writer received invalid response from LLM')
  }

  return { markdownContent: text }
}
