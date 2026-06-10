import type { RateCard, ProposalDefaults, RateCardRole, RateCardDiscount } from '@/lib/db/schema/tenant-settings'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoleRow {
  id: string
  name: string
  unit: 'hour' | 'day' | 'fixed'
  rate: string
}

export interface DiscountRow {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: string
  appliesTo: 'subtotal' | 'total'
  customerIds: string // comma-separated; empty string → null
}

export interface FormState {
  mode: 'blended' | 'by_role'
  blendedRate: string
  blendedRateUnit: 'hour' | 'day' | 'fixed'
  roles: RoleRow[]
  defaultMarginPct: string // display as %, e.g. "20" for 0.2
  currency: string
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: string
  warrantyPeriodDays: string
  discounts: DiscountRow[]
  loading: boolean
  saving: boolean
  saveSuccess: boolean
  errors: Array<{ field: string; message: string }>
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; rateCard: RateCard | null; proposalDefaults: ProposalDefaults | null }
  | { type: 'SET_MODE'; mode: 'blended' | 'by_role' }
  | { type: 'SET_BLENDED_RATE'; value: string }
  | { type: 'SET_BLENDED_RATE_UNIT'; value: 'hour' | 'day' | 'fixed' }
  | { type: 'SET_MARGIN'; value: string }
  | { type: 'SET_CURRENCY'; value: string }
  | { type: 'SET_PRICING_MODEL'; value: 'time_and_materials' | 'fixed_price' | 'cost_plus' }
  | { type: 'SET_PAYMENT_TERMS'; value: string }
  | { type: 'SET_WARRANTY'; value: string }
  | { type: 'ADD_ROLE' }
  | { type: 'UPDATE_ROLE'; id: string; field: keyof RoleRow; value: string }
  | { type: 'DELETE_ROLE'; id: string }
  | { type: 'ADD_DISCOUNT' }
  | { type: 'UPDATE_DISCOUNT'; id: string; field: keyof DiscountRow; value: string }
  | { type: 'DELETE_DISCOUNT'; id: string }
  | { type: 'MOVE_DISCOUNT_UP'; id: string }
  | { type: 'MOVE_DISCOUNT_DOWN'; id: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; errors: Array<{ field: string; message: string }> }

function newRoleId(): string {
  return `role-${Math.random().toString(36).slice(2)}`
}

function newDiscountId(): string {
  return `discount-${Math.random().toString(36).slice(2)}`
}

export const initialState: FormState = {
  mode: 'blended',
  blendedRate: '',
  blendedRateUnit: 'hour',
  roles: [],
  defaultMarginPct: '',
  currency: 'USD',
  pricingModel: 'time_and_materials',
  paymentTermsDays: '30',
  warrantyPeriodDays: '90',
  discounts: [],
  loading: true,
  saving: false,
  saveSuccess: false,
  errors: [],
}

export function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, errors: [] }

    case 'LOAD_SUCCESS': {
      const { rateCard, proposalDefaults } = action
      if (!rateCard) {
        return { ...state, loading: false }
      }
      return {
        ...state,
        loading: false,
        mode: rateCard.mode,
        blendedRate: rateCard.blendedRate != null ? String(rateCard.blendedRate) : '',
        blendedRateUnit: rateCard.blendedRateUnit ?? 'hour',
        roles: rateCard.roles.map((r) => ({
          id: newRoleId(),
          name: r.name,
          unit: r.unit,
          rate: String(r.rate),
        })),
        defaultMarginPct: rateCard.defaultMarginPct != null
          ? String(Math.round(rateCard.defaultMarginPct * 100))
          : '',
        currency: rateCard.currency,
        pricingModel: proposalDefaults?.pricingModel ?? 'time_and_materials',
        paymentTermsDays: proposalDefaults?.paymentTermsDays != null
          ? String(proposalDefaults.paymentTermsDays)
          : '30',
        warrantyPeriodDays: proposalDefaults?.warrantyPeriodDays != null
          ? String(proposalDefaults.warrantyPeriodDays)
          : '90',
        discounts: rateCard.discounts.map((d) => ({
          id: newDiscountId(),
          name: d.name,
          type: d.type,
          value: String(d.value),
          appliesTo: d.appliesTo,
          customerIds: d.customerIds ? d.customerIds.join(', ') : '',
        })),
      }
    }

    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'SET_BLENDED_RATE':
      return { ...state, blendedRate: action.value }

    case 'SET_BLENDED_RATE_UNIT':
      return { ...state, blendedRateUnit: action.value }

    case 'SET_MARGIN':
      return { ...state, defaultMarginPct: action.value }

    case 'SET_CURRENCY':
      return { ...state, currency: action.value }

    case 'SET_PRICING_MODEL':
      return { ...state, pricingModel: action.value }

    case 'SET_PAYMENT_TERMS':
      return { ...state, paymentTermsDays: action.value }

    case 'SET_WARRANTY':
      return { ...state, warrantyPeriodDays: action.value }

    case 'ADD_ROLE':
      return {
        ...state,
        roles: [...state.roles, { id: newRoleId(), name: '', unit: 'hour', rate: '' }],
      }

    case 'UPDATE_ROLE':
      return {
        ...state,
        roles: state.roles.map((r) =>
          r.id === action.id ? { ...r, [action.field]: action.value } : r
        ),
      }

    case 'DELETE_ROLE':
      return { ...state, roles: state.roles.filter((r) => r.id !== action.id) }

    case 'ADD_DISCOUNT':
      return {
        ...state,
        discounts: [
          ...state.discounts,
          {
            id: newDiscountId(),
            name: '',
            type: 'percentage',
            value: '',
            appliesTo: 'total',
            customerIds: '',
          },
        ],
      }

    case 'UPDATE_DISCOUNT':
      return {
        ...state,
        discounts: state.discounts.map((d) =>
          d.id === action.id ? { ...d, [action.field]: action.value } : d
        ),
      }

    case 'DELETE_DISCOUNT':
      return { ...state, discounts: state.discounts.filter((d) => d.id !== action.id) }

    case 'MOVE_DISCOUNT_UP': {
      const idx = state.discounts.findIndex((d) => d.id === action.id)
      if (idx <= 0) return state
      const next = [...state.discounts]
      const tmp = next[idx - 1] as DiscountRow
      next[idx - 1] = next[idx] as DiscountRow
      next[idx] = tmp
      return { ...state, discounts: next }
    }

    case 'MOVE_DISCOUNT_DOWN': {
      const idx = state.discounts.findIndex((d) => d.id === action.id)
      if (idx < 0 || idx >= state.discounts.length - 1) return state
      const next = [...state.discounts]
      const tmp = next[idx + 1] as DiscountRow
      next[idx + 1] = next[idx] as DiscountRow
      next[idx] = tmp
      return { ...state, discounts: next }
    }

    case 'SAVE_START':
      return { ...state, saving: true, saveSuccess: false, errors: [] }

    case 'SAVE_SUCCESS':
      return { ...state, saving: false, saveSuccess: true, errors: [] }

    case 'SAVE_ERROR':
      return { ...state, saving: false, saveSuccess: false, errors: action.errors }

    default:
      return state
  }
}

// ─── Helper: build API payload ────────────────────────────────────────────────

export function parseNum(s: string): number | null {
  const v = parseFloat(s)
  return isNaN(v) ? null : v
}

function parseIntOrNull(s: string): number | null {
  const v = parseInt(s, 10)
  return isNaN(v) ? null : v
}

export function buildPayload(state: FormState): { rateCard: RateCard; proposalDefaults: ProposalDefaults } {
  const roles: RateCardRole[] = state.roles.map((r) => ({
    name: r.name,
    unit: r.unit,
    rate: parseNum(r.rate) ?? 0,
  }))

  const discounts: RateCardDiscount[] = state.discounts.map((d) => {
    const rawIds = d.customerIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return {
      name: d.name,
      type: d.type,
      value: parseNum(d.value) ?? 0,
      appliesTo: d.appliesTo,
      customerIds: rawIds.length > 0 ? rawIds : null,
    }
  })

  const blendedRateRaw = parseNum(state.blendedRate)
  const marginRaw = parseNum(state.defaultMarginPct)

  const rateCard: RateCard = {
    mode: state.mode,
    blendedRate: state.mode === 'blended' ? blendedRateRaw : null,
    blendedRateUnit: state.mode === 'blended' ? state.blendedRateUnit : null,
    roles,
    // Margin is entered as a percentage (e.g. "20" = 20%). Default to 0 when
    // empty so the server Zod schema receives a valid number.
    defaultMarginPct: marginRaw !== null ? marginRaw / 100 : 0,
    currency: state.currency,
    discounts,
  }

  const proposalDefaults: ProposalDefaults = {
    pricingModel: state.pricingModel,
    paymentTermsDays: parseIntOrNull(state.paymentTermsDays) ?? 0,
    warrantyPeriodDays: parseIntOrNull(state.warrantyPeriodDays) ?? 0,
  }

  return { rateCard, proposalDefaults }
}
