// Computed from markdown without LLM calls — provides users visibility into
// how much of the proposal is backed by KB content vs. generated from scratch.

const SECTION_HEADING_RE = /^## .+/gm
const NO_MATCH_INDICATOR = 'No knowledge base match'

export function computeKbCoveragePercentage(markdown: string): number {
  if (!markdown) return 0

  // Split into sections by ## headings
  const headings = markdown.match(SECTION_HEADING_RE)
  if (!headings || headings.length === 0) return 0

  // Split markdown by ## headings to get section content
  const sections = markdown.split(/^## .+$/m).slice(1) // skip content before first ##

  let matched = 0
  for (const section of sections) {
    // Find source blockquotes in this section
    const sources = [...section.matchAll(/^> \*Source: (.+?)\*$/gm)]
    const hasRealSource = sources.some(
      (m) => m[1] && !m[1].includes(NO_MATCH_INDICATOR)
    )
    if (hasRealSource) matched++
  }

  return Math.round((matched / headings.length) * 100)
}
