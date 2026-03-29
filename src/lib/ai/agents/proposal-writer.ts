import { generateText } from 'ai'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import { FIXED_SECTIONS } from '@/lib/constants/fixed-sections'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'
import type { KnowledgeEntryWithSimilarity } from '@/lib/services/vector-search'
import type { TypedSupplierContext, CustomerContext } from '@/lib/services/proposal-retrieval'
import type { Learning } from '@/lib/db/schema/learnings'
import type { ExtractedRfpMetadata } from '@/lib/db/schema/rfps'
import type { ContentLibraryEntryWithSimilarity } from '@/lib/services/content-library-retrieval'

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
  rfpName?: string
  rfpMetadata?: ExtractedRfpMetadata | null
  contentLibraryEntries?: ContentLibraryEntryWithSimilarity[]
  rateCardRolesMarkdown?: string
  fixedSections?: Record<string, string>
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
    rfpName,
    rfpMetadata,
    contentLibraryEntries,
    rateCardRolesMarkdown,
    fixedSections,
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

  // RFP metadata block — use extracted metadata when available, fallback to rfpName
  const proposalTitle = rfpMetadata?.title ?? rfpName ?? null
  if (proposalTitle || rfpMetadata) {
    const metadataFields: [string, string | null | undefined][] = [
      ['RFP Title', proposalTitle],
      ['Issuing Organization', rfpMetadata?.issuingOrganization],
      ['Reference Number', rfpMetadata?.referenceNumber],
      ['Submission Deadline', rfpMetadata?.submissionDeadline],
      ['Project Start Date', rfpMetadata?.projectStartDate],
      ['Contact', rfpMetadata?.contactName],
      ['Email', rfpMetadata?.contactEmail],
      ['Phone', rfpMetadata?.contactPhone],
    ]
    const metadataLines = metadataFields
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([label, value]) => `${label}: ${value}`)
    if (metadataLines.length > 0) {
      promptBlocks.push(`## RFP Metadata (use verbatim — do not paraphrase)\n${metadataLines.join('\n')}`)
    }
  }

  promptBlocks.push(`## PRE-COMPUTED PRICING SECTION (insert verbatim)\n${pricingMarkdown}`)

  // Fixed sections — deterministic vendor data blocks
  if (fixedSections && Object.keys(fixedSections).length > 0) {
    for (const def of FIXED_SECTIONS) {
      const content = fixedSections[def.sectionType]
      if (!content) continue
      promptBlocks.push(`## ${def.displayName} (use for ${def.description.toLowerCase().replace(/\.$/, '')})\n${content}`)
    }
  }

  // Content Library block — custom entries matched via semantic search
  if (contentLibraryEntries && contentLibraryEntries.length > 0) {
    const clText = contentLibraryEntries
      .map((e) => `[${e.category}] ${e.name}: ${e.content}`)
      .join('\n\n')
    promptBlocks.push(`## Content Library (Additional Vendor Information)\n${clText}`)
  }

  // Per-role rate card block — individual role rates for rate card tables
  if (rateCardRolesMarkdown && rateCardRolesMarkdown.trim()) {
    promptBlocks.push(`## Standard Rate Card by Role (use to populate per-role rate tables)\n${rateCardRolesMarkdown}`)
  }

  const { text } = await generateText({
    model,
    system: `You are an expert proposal writer generating a complete, professional first-pass proposal in response to an RFP.

YOUR PRIMARY GOAL: Answer every RFP requirement using the knowledge base context, case studies, certifications, and learnings provided. Do NOT simply restate or copy what the RFP asks — provide the vendor's actual response with specific, substantive content.

CONTENT RULES:
1. For each RFP requirement, write a response that directly addresses what the buyer is asking for. If the RFP says "Describe your approach to X," describe the approach using the knowledge base — don't repeat the RFP text.
2. Draw heavily from the Knowledge Base Context, Case Studies, and Certifications sections below. Reference specific capabilities, past experience, and qualifications from these sources.
3. If the knowledge base has relevant content, USE IT. Adapt and integrate it naturally into your response — do not ignore available context.
4. For pricing sections, insert the pre-computed PRICING SECTION exactly as provided — do not modify or recalculate.
5. Use [PLACEHOLDER: brief description] ONLY when the knowledge base has no relevant content AND the clarifying answers AND the Content Library don't cover it.
6. For vendor profile sections, use the fixed section data provided above as the PRIMARY source:
   - Company legal name, HQ address, website, years in business, overview → use "Company Information" section
   - Point of contact, email, phone, contact details → use "Company Contacts" section
   - Core services, capabilities, methodology → use "Services" section
   - Specializations, industry expertise → use "Specialties" section
   - Certifications, compliance, attestations → use "Certifications" section
   - Case studies, references, past projects → use "Past Performance" section
   - Total project fees, fixed fees, retainer pricing, volume discounts → use "Pricing" section
   When a fixed section provides data for an RFP question, use it verbatim. Do NOT use PLACEHOLDER for any field covered by a populated fixed section. Mark these with > *Source: Content Library — [section name]*.
7. For rate card tables requested by the RFP, use the Standard Rate Card by Role data to populate per-role hourly rates. Do NOT use PLACEHOLDER for rates that are provided in the rate card data.
8. When a fixed section has content, use ALL of it as the complete answer. Do NOT split a section into sub-categories and generate PLACEHOLDERs for sub-categories not present in the data. For example, if the Certifications section lists corporate certifications but does not include individual staff certifications, present the provided certifications as the full response — do not add a separate PLACEHOLDER for staff certifications.

IMPORTANT RESTRICTIONS:
- Do NOT generate Terms & Conditions, Assumptions, Exclusions, Payment Terms, Change Management, IP Ownership, Liability, Force Majeure, or Warranty sections. These will be added separately by the system.
- Do NOT perform any pricing calculations. The pricing section is pre-computed and provided to you.
- Do NOT copy or restate the RFP's own text back as a response. Every section must contain the vendor's NEW content responding to the requirement.

FORMATTING RULES:
1. Start with # Proposal: [exact RFP title from the RFP Metadata section]. If no RFP title is provided, use # Proposal.
2. Create one section per RFP requirement (## Heading for each).
3. Immediately after each heading, add a source blockquote: > *Source: [source]*. If no KB source matched this section, write > *Source: No knowledge base match — consider uploading relevant content*
4. Write substantive paragraphs, drawing from the knowledge base and clarifying answers. Keep responses proportional to field complexity: simple factual fields (company name, address, years in business, contact info) should be 1-2 sentences max. Reserve detailed multi-paragraph prose for substantive sections like methodology, technical approach, and case studies.
5. Insert the pre-computed PRICING SECTION exactly as provided.`,
    prompt: `Write a complete proposal based on the following:\n\n${promptBlocks.join('\n\n')}\n\nGenerate the full proposal markdown now.`,
  })

  if (!text || typeof text !== 'string') {
    throw new Error('Proposal writer received invalid response from LLM')
  }

  return { markdownContent: text }
}
