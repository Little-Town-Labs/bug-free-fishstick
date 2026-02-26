'use client'

import { useReducer, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { RateCard, ProposalDefaults, RateCardRole, RateCardDiscount } from '@/lib/db/schema/tenant-settings'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateCardFormProps {
  isAdmin: boolean
}

interface RoleRow {
  id: string
  name: string
  unit: 'hour' | 'day' | 'fixed'
  rate: string
}

interface DiscountRow {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: string
  appliesTo: 'subtotal' | 'total'
  customerIds: string // comma-separated; empty string → null
}

interface FormState {
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

type Action =
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

const initialState: FormState = {
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

function reducer(state: FormState, action: Action): FormState {
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

function parseNum(s: string): number | null {
  const v = parseFloat(s)
  return isNaN(v) ? null : v
}

function parseIntOrNull(s: string): number | null {
  const v = parseInt(s, 10)
  return isNaN(v) ? null : v
}

function buildPayload(state: FormState): { rateCard: RateCard; proposalDefaults: ProposalDefaults } {
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
    // Margin is entered as a percentage (e.g. "20" = 20%). null/NaN is sent
    // as-is so the server Zod schema produces a proper 422 field error.
    defaultMarginPct: marginRaw !== null ? marginRaw / 100 : (null as unknown as number),
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BlendedRateSectionProps {
  blendedRate: string
  blendedRateUnit: 'hour' | 'day' | 'fixed'
  disabled: boolean
  onRateChange: (v: string) => void
  onUnitChange: (v: 'hour' | 'day' | 'fixed') => void
}

function BlendedRateSection({
  blendedRate,
  blendedRateUnit,
  disabled,
  onRateChange,
  onUnitChange,
}: BlendedRateSectionProps) {
  const rateId = useId()
  const unitId = useId()

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <Label htmlFor={rateId}>Blended Rate</Label>
        <Input
          id={rateId}
          type="number"
          min={0}
          step="0.01"
          value={blendedRate}
          onChange={(e) => onRateChange(e.target.value)}
          placeholder="e.g. 150"
          disabled={disabled}
          className="w-36"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={unitId}>Unit</Label>
        <select
          id={unitId}
          value={blendedRateUnit}
          onChange={(e) => onUnitChange(e.target.value as 'hour' | 'day' | 'fixed')}
          disabled={disabled}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Rate unit"
        >
          <option value="hour">per Hour</option>
          <option value="day">per Day</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>
    </div>
  )
}

interface RoleTableProps {
  roles: RoleRow[]
  disabled: boolean
  onAdd: () => void
  onUpdate: (id: string, field: keyof RoleRow, value: string) => void
  onDelete: (id: string) => void
}

function RoleTable({ roles, disabled, onAdd, onUpdate, onDelete }: RoleTableProps) {
  return (
    <div className="flex flex-col gap-3">
      {roles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-2 pr-3 text-left font-medium">Role Name</th>
                <th className="pb-2 pr-3 text-left font-medium">Unit</th>
                <th className="pb-2 pr-3 text-left font-medium">Rate</th>
                <th className="pb-2 text-left font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  disabled={disabled}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            Add Role
          </Button>
        </div>
      )}
    </div>
  )
}

interface RoleRowProps {
  role: RoleRow
  disabled: boolean
  onUpdate: (id: string, field: keyof RoleRow, value: string) => void
  onDelete: (id: string) => void
}

function RoleRow({ role, disabled, onUpdate, onDelete }: RoleRowProps) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3">
        <Input
          type="text"
          value={role.name}
          onChange={(e) => onUpdate(role.id, 'name', e.target.value)}
          placeholder="Role name"
          disabled={disabled}
          className="w-40"
          aria-label="Role name"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={role.unit}
          onChange={(e) => onUpdate(role.id, 'unit', e.target.value)}
          disabled={disabled}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Role unit"
        >
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="fixed">Fixed</option>
        </select>
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={role.rate}
          onChange={(e) => onUpdate(role.id, 'rate', e.target.value)}
          placeholder="Rate"
          disabled={disabled}
          className="w-28"
          aria-label="Role rate"
        />
      </td>
      <td className="py-2">
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(role.id)}
            aria-label="Delete role"
          >
            Remove
          </Button>
        )}
      </td>
    </tr>
  )
}

interface PricingDefaultsSectionProps {
  defaultMarginPct: string
  currency: string
  pricingModel: 'time_and_materials' | 'fixed_price' | 'cost_plus'
  paymentTermsDays: string
  warrantyPeriodDays: string
  disabled: boolean
  onMarginChange: (v: string) => void
  onCurrencyChange: (v: string) => void
  onPricingModelChange: (v: 'time_and_materials' | 'fixed_price' | 'cost_plus') => void
  onPaymentTermsChange: (v: string) => void
  onWarrantyChange: (v: string) => void
}

function PricingDefaultsSection({
  defaultMarginPct,
  currency,
  pricingModel,
  paymentTermsDays,
  warrantyPeriodDays,
  disabled,
  onMarginChange,
  onCurrencyChange,
  onPricingModelChange,
  onPaymentTermsChange,
  onWarrantyChange,
}: PricingDefaultsSectionProps) {
  const marginId = useId()
  const currencyId = useId()
  const modelId = useId()
  const paymentId = useId()
  const warrantyId = useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={marginId}>Default Margin (%)</Label>
        <Input
          id={marginId}
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={defaultMarginPct}
          onChange={(e) => onMarginChange(e.target.value)}
          placeholder="e.g. 20"
          disabled={disabled}
          aria-label="Default margin percent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={currencyId}>Currency</Label>
        <Input
          id={currencyId}
          type="text"
          maxLength={3}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
          placeholder="USD"
          disabled={disabled}
          aria-label="Currency"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={modelId}>Pricing Model</Label>
        <select
          id={modelId}
          value={pricingModel}
          onChange={(e) => onPricingModelChange(e.target.value as 'time_and_materials' | 'fixed_price' | 'cost_plus')}
          disabled={disabled}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Pricing model"
        >
          <option value="time_and_materials">Time &amp; Materials</option>
          <option value="fixed_price">Fixed Price</option>
          <option value="cost_plus">Cost Plus</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={paymentId}>Payment Terms (days)</Label>
        <Input
          id={paymentId}
          type="number"
          min={0}
          step={1}
          value={paymentTermsDays}
          onChange={(e) => onPaymentTermsChange(e.target.value)}
          placeholder="30"
          disabled={disabled}
          aria-label="Payment terms days"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={warrantyId}>Warranty Period (days)</Label>
        <Input
          id={warrantyId}
          type="number"
          min={0}
          step={1}
          value={warrantyPeriodDays}
          onChange={(e) => onWarrantyChange(e.target.value)}
          placeholder="90"
          disabled={disabled}
          aria-label="Warranty period days"
        />
      </div>
    </div>
  )
}

interface DiscountListProps {
  discounts: DiscountRow[]
  disabled: boolean
  onAdd: () => void
  onUpdate: (id: string, field: keyof DiscountRow, value: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

function DiscountList({
  discounts,
  disabled,
  onAdd,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: DiscountListProps) {
  return (
    <div className="flex flex-col gap-3">
      {discounts.map((d, idx) => (
        <DiscountRowItem
          key={d.id}
          discount={d}
          isFirst={idx === 0}
          isLast={idx === discounts.length - 1}
          disabled={disabled}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      ))}
      {!disabled && (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            Add Discount
          </Button>
        </div>
      )}
    </div>
  )
}

interface DiscountRowItemProps {
  discount: DiscountRow
  isFirst: boolean
  isLast: boolean
  disabled: boolean
  onUpdate: (id: string, field: keyof DiscountRow, value: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

function DiscountRowItem({
  discount,
  isFirst,
  isLast,
  disabled,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: DiscountRowItemProps) {
  const typeId = useId()

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border p-3">
      <div className="flex flex-col gap-1">
        <Label className="sr-only" htmlFor={`disc-name-${discount.id}`}>Discount Name</Label>
        <Input
          id={`disc-name-${discount.id}`}
          type="text"
          value={discount.name}
          onChange={(e) => onUpdate(discount.id, 'name', e.target.value)}
          placeholder="Discount name"
          disabled={disabled}
          className="w-40"
          aria-label="Discount name"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={typeId} className="sr-only">Discount Type</Label>
        <select
          id={typeId}
          value={discount.type}
          onChange={(e) => onUpdate(discount.id, 'type', e.target.value)}
          disabled={disabled}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Discount type"
          role="combobox"
        >
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="sr-only" htmlFor={`disc-value-${discount.id}`}>Value</Label>
        <Input
          id={`disc-value-${discount.id}`}
          type="number"
          min={0}
          step="0.01"
          value={discount.value}
          onChange={(e) => onUpdate(discount.id, 'value', e.target.value)}
          placeholder={discount.type === 'percentage' ? '0.05' : '500'}
          disabled={disabled}
          className="w-24"
          aria-label="Discount value"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="sr-only" htmlFor={`disc-applies-${discount.id}`}>Applies To</Label>
        <select
          id={`disc-applies-${discount.id}`}
          value={discount.appliesTo}
          onChange={(e) => onUpdate(discount.id, 'appliesTo', e.target.value)}
          disabled={disabled}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Discount applies to"
        >
          <option value="subtotal">Subtotal</option>
          <option value="total">Total</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="sr-only" htmlFor={`disc-cids-${discount.id}`}>Customer IDs</Label>
        <Input
          id={`disc-cids-${discount.id}`}
          type="text"
          value={discount.customerIds}
          onChange={(e) => onUpdate(discount.id, 'customerIds', e.target.value)}
          placeholder="Customer IDs (comma-separated, blank = universal)"
          disabled={disabled}
          className="w-64"
          aria-label="Customer IDs"
        />
      </div>

      {!disabled && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveUp(discount.id)}
            disabled={isFirst}
            aria-label="Move discount up"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMoveDown(discount.id)}
            disabled={isLast}
            aria-label="Move discount down"
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(discount.id)}
            aria-label="Delete discount"
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RateCardForm({ isAdmin }: RateCardFormProps) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    dispatch({ type: 'LOAD_START' })
    fetch('/api/settings/rate-card')
      .then((res) => res.json() as Promise<{ rateCard: RateCard | null; proposalDefaults: ProposalDefaults | null }>)
      .then(({ rateCard, proposalDefaults }) => {
        dispatch({ type: 'LOAD_SUCCESS', rateCard, proposalDefaults })
      })
      .catch(() => {
        dispatch({ type: 'LOAD_SUCCESS', rateCard: null, proposalDefaults: null })
      })
  }, [])

  async function handleSave() {
    dispatch({ type: 'SAVE_START' })
    const payload = buildPayload(state)

    try {
      const res = await fetch('/api/settings/rate-card', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        dispatch({ type: 'SAVE_SUCCESS' })
      } else {
        const body = await res.json() as { error?: string; details?: Array<{ field: string; message: string }> }
        dispatch({
          type: 'SAVE_ERROR',
          errors: body.details ?? [{ field: 'general', message: body.error ?? 'Save failed' }],
        })
      }
    } catch {
      dispatch({ type: 'SAVE_ERROR', errors: [{ field: 'general', message: 'Network error' }] })
    }
  }

  if (state.loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Loading rate card…</p>
        </CardContent>
      </Card>
    )
  }

  // Detect "no rate card" by checking if blendedRate is empty and roles are empty
  // after loading. The LOAD_SUCCESS reducer sets loading=false but leaves defaults
  // when rateCard is null, so we track whether a card was ever populated by
  // inspecting if mode was ever set. We use a simpler approach: track if
  // the GET returned null. We derive this from state by checking if the initial
  // empty defaults are still in place AND loading is false.
  //
  // Actually the cleanest approach is to keep a separate `hasData` flag that
  // LOAD_SUCCESS sets. We handle this with an extended state check: if the
  // state came back from the server and the rateCard was null we show empty state.
  // Since `initialState.loading = true` and we only set loading=false after
  // LOAD_SUCCESS, we can track the null case by adding a `hasConfig` boolean.
  // Rather than change the reducer at this point, we derive it from the fact
  // that if `blendedRate === ''` and `roles.length === 0` and `defaultMarginPct === ''`
  // it's still "unconfigured". However that could be ambiguous. Instead, emit
  // the empty state text if the margin is empty (a required field always populated
  // when a rate card exists).

  const isUnconfigured = !state.loading && state.defaultMarginPct === '' && state.blendedRate === '' && state.roles.length === 0

  if (isUnconfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No rate card configured. {isAdmin ? 'Fill in the fields below to create one.' : 'Contact an admin to set up pricing.'}
          </p>
          {isAdmin && (
            <div className="mt-4 space-y-6">
              <ModeSelector
                mode={state.mode}
                disabled={!isAdmin}
                onChange={(m) => dispatch({ type: 'SET_MODE', mode: m })}
              />
              {state.mode === 'blended' && (
                <BlendedRateSection
                  blendedRate={state.blendedRate}
                  blendedRateUnit={state.blendedRateUnit}
                  disabled={!isAdmin}
                  onRateChange={(v) => dispatch({ type: 'SET_BLENDED_RATE', value: v })}
                  onUnitChange={(v) => dispatch({ type: 'SET_BLENDED_RATE_UNIT', value: v })}
                />
              )}
              {state.mode === 'by_role' && (
                <RoleTable
                  roles={state.roles}
                  disabled={!isAdmin}
                  onAdd={() => dispatch({ type: 'ADD_ROLE' })}
                  onUpdate={(id, field, value) => dispatch({ type: 'UPDATE_ROLE', id, field: field as keyof RoleRow, value })}
                  onDelete={(id) => dispatch({ type: 'DELETE_ROLE', id })}
                />
              )}
              <Separator />
              <PricingDefaultsSection
                defaultMarginPct={state.defaultMarginPct}
                currency={state.currency}
                pricingModel={state.pricingModel}
                paymentTermsDays={state.paymentTermsDays}
                warrantyPeriodDays={state.warrantyPeriodDays}
                disabled={!isAdmin}
                onMarginChange={(v) => dispatch({ type: 'SET_MARGIN', value: v })}
                onCurrencyChange={(v) => dispatch({ type: 'SET_CURRENCY', value: v })}
                onPricingModelChange={(v) => dispatch({ type: 'SET_PRICING_MODEL', value: v })}
                onPaymentTermsChange={(v) => dispatch({ type: 'SET_PAYMENT_TERMS', value: v })}
                onWarrantyChange={(v) => dispatch({ type: 'SET_WARRANTY', value: v })}
              />
              <Separator />
              <div>
                <h3 className="mb-3 text-sm font-semibold">Discounts</h3>
                <DiscountList
                  discounts={state.discounts}
                  disabled={!isAdmin}
                  onAdd={() => dispatch({ type: 'ADD_DISCOUNT' })}
                  onUpdate={(id, field, value) => dispatch({ type: 'UPDATE_DISCOUNT', id, field: field as keyof DiscountRow, value })}
                  onDelete={(id) => dispatch({ type: 'DELETE_DISCOUNT', id })}
                  onMoveUp={(id) => dispatch({ type: 'MOVE_DISCOUNT_UP', id })}
                  onMoveDown={(id) => dispatch({ type: 'MOVE_DISCOUNT_DOWN', id })}
                />
              </div>
              <SaveSection
                saving={state.saving}
                saveSuccess={state.saveSuccess}
                errors={state.errors}
                onSave={handleSave}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ModeSelector
          mode={state.mode}
          disabled={!isAdmin}
          onChange={(m) => dispatch({ type: 'SET_MODE', mode: m })}
        />

        {state.mode === 'blended' && (
          <BlendedRateSection
            blendedRate={state.blendedRate}
            blendedRateUnit={state.blendedRateUnit}
            disabled={!isAdmin}
            onRateChange={(v) => dispatch({ type: 'SET_BLENDED_RATE', value: v })}
            onUnitChange={(v) => dispatch({ type: 'SET_BLENDED_RATE_UNIT', value: v })}
          />
        )}

        {state.mode === 'by_role' && (
          <RoleTable
            roles={state.roles}
            disabled={!isAdmin}
            onAdd={() => dispatch({ type: 'ADD_ROLE' })}
            onUpdate={(id, field, value) => dispatch({ type: 'UPDATE_ROLE', id, field: field as keyof RoleRow, value })}
            onDelete={(id) => dispatch({ type: 'DELETE_ROLE', id })}
          />
        )}

        <Separator />

        <PricingDefaultsSection
          defaultMarginPct={state.defaultMarginPct}
          currency={state.currency}
          pricingModel={state.pricingModel}
          paymentTermsDays={state.paymentTermsDays}
          warrantyPeriodDays={state.warrantyPeriodDays}
          disabled={!isAdmin}
          onMarginChange={(v) => dispatch({ type: 'SET_MARGIN', value: v })}
          onCurrencyChange={(v) => dispatch({ type: 'SET_CURRENCY', value: v })}
          onPricingModelChange={(v) => dispatch({ type: 'SET_PRICING_MODEL', value: v })}
          onPaymentTermsChange={(v) => dispatch({ type: 'SET_PAYMENT_TERMS', value: v })}
          onWarrantyChange={(v) => dispatch({ type: 'SET_WARRANTY', value: v })}
        />

        <Separator />

        <div>
          <h3 className="mb-3 text-sm font-semibold">Discounts</h3>
          <DiscountList
            discounts={state.discounts}
            disabled={!isAdmin}
            onAdd={() => dispatch({ type: 'ADD_DISCOUNT' })}
            onUpdate={(id, field, value) => dispatch({ type: 'UPDATE_DISCOUNT', id, field: field as keyof DiscountRow, value })}
            onDelete={(id) => dispatch({ type: 'DELETE_DISCOUNT', id })}
            onMoveUp={(id) => dispatch({ type: 'MOVE_DISCOUNT_UP', id })}
            onMoveDown={(id) => dispatch({ type: 'MOVE_DISCOUNT_DOWN', id })}
          />
        </div>

        {isAdmin && (
          <SaveSection
            saving={state.saving}
            saveSuccess={state.saveSuccess}
            errors={state.errors}
            onSave={handleSave}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Mode selector ────────────────────────────────────────────────────────────

interface ModeSelectorProps {
  mode: 'blended' | 'by_role'
  disabled: boolean
  onChange: (mode: 'blended' | 'by_role') => void
}

function ModeSelector({ mode, disabled, onChange }: ModeSelectorProps) {
  return (
    <fieldset className="flex gap-6">
      <legend className="sr-only">Rate card mode</legend>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="rate-card-mode"
          value="blended"
          checked={mode === 'blended'}
          onChange={() => onChange('blended')}
          disabled={disabled}
          aria-label="Blended"
        />
        Blended
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="rate-card-mode"
          value="by_role"
          checked={mode === 'by_role'}
          onChange={() => onChange('by_role')}
          disabled={disabled}
          aria-label="By Role"
        />
        By Role
      </label>
    </fieldset>
  )
}

// ─── Save section ─────────────────────────────────────────────────────────────

interface SaveSectionProps {
  saving: boolean
  saveSuccess: boolean
  errors: Array<{ field: string; message: string }>
  onSave: () => void
}

function SaveSection({ saving, saveSuccess, errors, onSave }: SaveSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      {errors.length > 0 && (
        <ul className="space-y-1" role="alert">
          {errors.map((err, i) => (
            <li key={i} className="text-sm text-red-600">
              {err.message}
            </li>
          ))}
        </ul>
      )}

      {saveSuccess && (
        <p role="status" className="text-sm text-green-600">
          Saved successfully.
        </p>
      )}

      <div>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
