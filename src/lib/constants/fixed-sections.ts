export const FIXED_SECTIONS = [
  {
    sectionType: 'company_info' as const,
    displayName: 'Company Information',
    description:
      'Company legal name, year founded, headquarters address, website URL, brief company overview, number of employees.',
    sortOrder: 1,
  },
  {
    sectionType: 'company_contacts' as const,
    displayName: 'Company Contacts',
    description:
      'Primary point of contact (name, title, email, phone), secondary contacts, mailing address if different from HQ.',
    sortOrder: 2,
  },
  {
    sectionType: 'services' as const,
    displayName: 'Services',
    description:
      'Core service offerings, service descriptions, engagement models, delivery methodology.',
    sortOrder: 3,
  },
  {
    sectionType: 'specialties' as const,
    displayName: 'Specialties',
    description:
      'Industry verticals, technical specializations, differentiators, areas of expertise.',
    sortOrder: 4,
  },
  {
    sectionType: 'certifications' as const,
    displayName: 'Certifications',
    description:
      'Corporate certifications (ISO, SOC, etc.), staff certifications (AWS, PMP, etc.), compliance attestations with holder names and expiration dates.',
    sortOrder: 5,
  },
  {
    sectionType: 'past_performance' as const,
    displayName: 'Past Performance',
    description:
      'Case studies, notable client engagements (anonymized if needed), project outcomes, references.',
    sortOrder: 6,
  },
] as const

export type FixedSectionType = (typeof FIXED_SECTIONS)[number]['sectionType']

export interface FixedSectionDefinition {
  readonly sectionType: FixedSectionType
  readonly displayName: string
  readonly description: string
  readonly sortOrder: number
}

export const FIXED_SECTION_TYPES = new Set<FixedSectionType>(
  FIXED_SECTIONS.map((s) => s.sectionType)
)

export function getFixedSectionDef(
  sectionType: FixedSectionType
): FixedSectionDefinition | undefined {
  return FIXED_SECTIONS.find((s) => s.sectionType === sectionType)
}
