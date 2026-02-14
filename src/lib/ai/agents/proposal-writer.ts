import { generateText } from 'ai'
import { getLanguageModelForOrg } from '@/lib/ai/providers'
import type { ClarifyingQuestion } from '@/lib/db/schema/proposal-drafts'

export interface WriteProposalInput {
  rfpSections: Array<{
    title: string
    content: string
  }>
  knowledgeContext: Array<{
    content: string
    source: string
  }>
  contentLibraryEntries: Array<{
    id: string
    name: string
    category: string
    content: string
    similarity?: number
  }>
  clarifyingAnswers: ClarifyingQuestion[]
  organizationId: string
}

export interface WriteProposalResult {
  markdownContent: string
}

export async function writeProposal(input: WriteProposalInput): Promise<WriteProposalResult> {
  const {
    rfpSections,
    knowledgeContext,
    contentLibraryEntries,
    clarifyingAnswers,
    organizationId,
  } = input

  const model = await getLanguageModelForOrg(organizationId)

  const sectionsText = rfpSections
    .map(s => `### ${s.title}\n${s.content}`)
    .join('\n\n')

  const knowledgeText = knowledgeContext.length > 0
    ? knowledgeContext.map(k => `[Source: ${k.source}]\n${k.content}`).join('\n\n')
    : '(No knowledge base documents available.)'

  const libraryText = contentLibraryEntries.length > 0
    ? contentLibraryEntries.map(e => {
        const relevance = e.similarity !== undefined ? ` (relevance: ${Math.round(e.similarity * 100)}%)` : ''
        return `[${e.category}] ${e.name}${relevance}:\n${e.content}`
      }).join('\n\n')
    : '(No content library entries available.)'

  const answersText = clarifyingAnswers.length > 0
    ? clarifyingAnswers
        .map(a => `Q (${a.rfpSection}): ${a.question}\nA: ${a.answer || '(skipped)'}`)
        .join('\n\n')
    : '(No clarifying answers provided.)'

  const { text } = await generateText({
    model,
    system: `You are an expert proposal writer. Generate a complete, professional first-pass proposal in markdown format.

CRITICAL FORMATTING RULES:
1. Mirror the structure of the RFP — create one section heading per RFP section.
2. Immediately after each section heading (## Section Name), add a source annotation blockquote:
   - If content comes from the knowledge base: \`> *Source: knowledge base*\`
   - If content comes from a content library entry: \`> *Source: content library — [entry name]*\`
   - If content comes from a user answer: \`> *Source: user answer*\`
   - If content is inferred/generated: \`> *Source: generated*\`
3. If information is missing, add a placeholder: \`[PLACEHOLDER: brief description of what's needed]\`
4. Use professional proposal language throughout.
5. The proposal must start with a \`# Proposal\` heading.`,
    prompt: `Write a complete proposal based on the following:

## RFP Sections to Address
${sectionsText}

## Company Knowledge Base
${knowledgeText}

## Content Library
${libraryText}

## Clarifying Question Answers
${answersText}

Generate the full proposal markdown now.`,
  })

  if (!text || typeof text !== 'string') {
    throw new Error('Proposal writer received invalid response from LLM')
  }

  return { markdownContent: text }
}
