'use client'

import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DiscountRow } from './rate-card-form-state'

// ─── Pricing defaults ─────────────────────────────────────────────────────────

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

export function PricingDefaultsSection({
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

// ─── Discounts ────────────────────────────────────────────────────────────────

interface DiscountListProps {
  discounts: DiscountRow[]
  disabled: boolean
  onAdd: () => void
  onUpdate: (id: string, field: keyof DiscountRow, value: string) => void
  onDelete: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export function DiscountList({
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
