import type { RateCard, RateCardDiscount } from '../db/schema/tenant-settings'

// ---------------------------------------------------------------------------
// Exported interfaces (authoritative source; contract matches contracts/pricing-computation-types.ts)
// ---------------------------------------------------------------------------

export interface ScopeLineItem {
  description: string
  role: string | null
  quantity: number
  unit: 'hour' | 'day' | 'fixed'
}

export interface ComputedLineItem {
  description: string
  role: string | null
  quantity: number
  unit: 'hour' | 'day' | 'fixed'
  unitRate: number
  lineTotal: number
  isFallbackRole: boolean
}

export interface AppliedDiscount {
  name: string
  amount: number
}

export interface PricingEstimate {
  mode: 'blended' | 'by_role'
  model: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  lineItems: ComputedLineItem[]
  subtotal: number
  marginPct: number
  marginAmount: number
  discountsApplied: AppliedDiscount[]
  total: number
  currency: string
  formattedMarkdown: string
  isPlaceholder: boolean
  totalFlooredAtZero: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_MARKDOWN = '[PLACEHOLDER: pricing details required]'
const DEFAULT_CURRENCY = 'USD'

// ---------------------------------------------------------------------------
// Private helpers — integer cent arithmetic
// ---------------------------------------------------------------------------

function toCents(n: number): number {
  return Math.round(n * 100)
}

function fromCents(n: number): number {
  return Math.round(n) / 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Private helper — rate resolution
// ---------------------------------------------------------------------------

function resolveRate(
  rateCard: RateCard,
  lineItem: ScopeLineItem,
): { unitRate: number; role: string | null; isFallbackRole: boolean } {
  if (rateCard.mode === 'blended') {
    return { unitRate: rateCard.blendedRate!, role: null, isFallbackRole: false }
  }

  // by_role mode
  const roles = rateCard.roles
  const inputRole = lineItem.role?.toLowerCase()
  const matched = inputRole
    ? roles.find((r) => r.name.toLowerCase() === inputRole)
    : undefined

  if (matched) {
    return { unitRate: matched.rate, role: matched.name, isFallbackRole: false }
  }

  // Fallback: first role (roles.length > 0 guaranteed by placeholder guard in main fn)
  const fallback = roles[0]!
  return { unitRate: fallback.rate, role: fallback.name, isFallbackRole: true }
}

// ---------------------------------------------------------------------------
// Private helper — discount filtering
// ---------------------------------------------------------------------------

function filterDiscounts(
  discounts: RateCardDiscount[],
  customerId?: string,
): RateCardDiscount[] {
  return discounts.filter(
    (d) => d.customerIds === null || (customerId !== undefined && d.customerIds.includes(customerId)),
  )
}

// ---------------------------------------------------------------------------
// Private helper — markdown formatting
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`
}

function formatMarkdown(
  lineItems: ComputedLineItem[],
  subtotal: number,
  marginPct: number,
  marginAmount: number,
  discountsApplied: AppliedDiscount[],
  total: number,
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus',
  currency: string,
  mode: 'blended' | 'by_role',
): string {
  const modelLabel =
    pricingModel === 'time_and_materials'
      ? 'Time & Materials'
      : pricingModel === 'fixed_price'
        ? 'Fixed Price'
        : 'Cost-Plus'

  const totalLabel =
    pricingModel === 'fixed_price' ? '**Fixed Price Total**' : '**Total**'

  const marginLabel =
    pricingModel === 'cost_plus' ? '*Cost-Plus Margin*' : `*Margin (${Math.round(marginPct * 100)}%)*`

  const lines: string[] = []

  // Header
  lines.push(`**Pricing (${modelLabel})** — ${currency}`)
  lines.push('')

  if (mode === 'blended') {
    // Column headers
    lines.push('| Description | Qty | Unit | Rate | Total |')
    lines.push('|---|---|---|---|---|')

    // Line item rows
    for (const li of lineItems) {
      lines.push(
        `| ${li.description} | ${li.quantity} | ${li.unit} | ${formatCurrency(li.unitRate, currency)} | ${formatCurrency(li.lineTotal, currency)} |`,
      )
    }

    // Summary rows
    lines.push(`| | | | **Subtotal** | ${formatCurrency(subtotal, currency)} |`)
    lines.push(`| | | | ${marginLabel} | ${formatCurrency(marginAmount, currency)} |`)
    for (const d of discountsApplied) {
      lines.push(`| *${d.name}* | | | | −${formatCurrency(d.amount, currency)} |`)
    }
    lines.push(`| | | | ${totalLabel} | ${formatCurrency(total, currency)} |`)
  } else {
    // by_role mode — extra Role column
    lines.push('| Description | Role | Qty | Unit | Rate | Total |')
    lines.push('|---|---|---|---|---|---|')

    for (const li of lineItems) {
      lines.push(
        `| ${li.description} | ${li.role ?? ''} | ${li.quantity} | ${li.unit} | ${formatCurrency(li.unitRate, currency)} | ${formatCurrency(li.lineTotal, currency)} |`,
      )
    }

    lines.push(`| | | | | **Subtotal** | ${formatCurrency(subtotal, currency)} |`)
    lines.push(`| | | | | ${marginLabel} | ${formatCurrency(marginAmount, currency)} |`)
    for (const d of discountsApplied) {
      lines.push(`| *${d.name}* | | | | | −${formatCurrency(d.amount, currency)} |`)
    }
    lines.push(`| | | | | ${totalLabel} | ${formatCurrency(total, currency)} |`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computePricingEstimate(
  rateCard: RateCard | null | undefined,
  scopeLines: ScopeLineItem[] | null | undefined,
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus',
  customerId?: string,
): PricingEstimate {
  // Phase 1: Placeholder guard
  const isInvalidRateCard =
    !rateCard ||
    (rateCard.mode === 'blended' && rateCard.blendedRate === null) ||
    (rateCard.mode === 'by_role' && rateCard.roles.length === 0)

  const isInvalidScopeLines = !scopeLines || scopeLines.length === 0

  if (isInvalidRateCard || isInvalidScopeLines) {
    return {
      mode: rateCard?.mode ?? 'blended',
      model: pricingModel,
      lineItems: [],
      subtotal: 0,
      marginPct: 0,
      marginAmount: 0,
      discountsApplied: [],
      total: 0,
      currency: rateCard?.currency ?? DEFAULT_CURRENCY,
      formattedMarkdown: PLACEHOLDER_MARKDOWN,
      isPlaceholder: true,
      totalFlooredAtZero: false,
    }
  }

  const currency = rateCard.currency ?? DEFAULT_CURRENCY

  // Phase 2 + 3: Rate resolution and line total computation
  const computedLineItems: ComputedLineItem[] = scopeLines.map((line) => {
    const resolved = resolveRate(rateCard, line)
    const unitRateCents = toCents(resolved.unitRate)
    const lineTotalCents = unitRateCents * line.quantity
    const lineTotal = fromCents(lineTotalCents)
    return {
      description: line.description,
      role: resolved.role,
      quantity: line.quantity,
      unit: line.unit,
      unitRate: resolved.unitRate,
      lineTotal,
      isFallbackRole: resolved.isFallbackRole,
    }
  })

  // Phase 3: Subtotal
  const subtotalCents = computedLineItems.reduce((sum, li) => sum + toCents(li.lineTotal), 0)
  const subtotal = fromCents(subtotalCents)

  // Phase 4: Margin
  const marginPct = rateCard.defaultMarginPct
  const marginAmountCents = Math.round(subtotalCents * marginPct)
  const marginAmount = fromCents(marginAmountCents)

  // Phase 5: Discount filtering and computation
  const filteredDiscounts = filterDiscounts(rateCard.discounts, customerId)

  // Pre-compute reference bases (non-cascading per TD-005)
  const subtotalPlusMarginCents = subtotalCents + marginAmountCents

  const discountsApplied: AppliedDiscount[] = filteredDiscounts.map((d) => {
    const baseCents =
      d.appliesTo === 'subtotal' ? subtotalCents : subtotalPlusMarginCents

    const amount =
      d.type === 'percentage'
        ? fromCents(Math.round(baseCents * d.value))
        : round2(d.value)

    return { name: d.name, amount }
  })

  // Phase 6: Total with floor
  const discountSumCents = discountsApplied.reduce((sum, d) => sum + toCents(d.amount), 0)
  const rawTotalCents = subtotalCents + marginAmountCents - discountSumCents
  const totalFlooredAtZero = rawTotalCents < 0
  const total = fromCents(Math.max(0, rawTotalCents))

  // Phase 7: Markdown formatting
  const formattedMarkdown = formatMarkdown(
    computedLineItems,
    subtotal,
    marginPct,
    marginAmount,
    discountsApplied,
    total,
    pricingModel,
    currency,
    rateCard.mode,
  )

  return {
    mode: rateCard.mode,
    model: pricingModel,
    lineItems: computedLineItems,
    subtotal,
    marginPct,
    marginAmount,
    discountsApplied,
    total,
    currency,
    formattedMarkdown,
    isPlaceholder: false,
    totalFlooredAtZero,
  }
}
