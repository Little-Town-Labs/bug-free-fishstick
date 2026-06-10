'use client'

import { useReducer, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { RateCard, ProposalDefaults } from '@/lib/db/schema/tenant-settings'
import {
  initialState,
  reducer,
  parseNum,
  buildPayload,
  type FormState,
  type RoleRow,
  type DiscountRow,
} from './rate-card-form-state'
import {
  ModeSelector,
  BlendedRateSection,
  RoleTable,
  SaveSection,
} from './RateCardFormSections'
import { PricingDefaultsSection, DiscountList } from './RateCardPricingSections'

interface RateCardFormProps {
  isAdmin: boolean
}

function validateForm(state: FormState): Array<{ field: string; message: string }> {
  const validationErrors: Array<{ field: string; message: string }> = []

  if (state.mode === 'blended') {
    const br = parseNum(state.blendedRate)
    if (br === null || br <= 0) {
      validationErrors.push({ field: 'blendedRate', message: 'Blended rate is required and must be a positive number' })
    }
  } else {
    if (state.roles.length === 0) {
      validationErrors.push({ field: 'roles', message: 'At least one role is required in by-role mode' })
    }
    for (const r of state.roles) {
      const rate = parseNum(r.rate)
      if (rate === null || rate <= 0) {
        validationErrors.push({ field: `role.${r.name || 'unnamed'}`, message: `Role "${r.name || 'unnamed'}" requires a positive rate` })
      }
      if (!r.name.trim()) {
        validationErrors.push({ field: `role.${r.id}`, message: 'Role name is required' })
      }
    }
  }

  for (const d of state.discounts) {
    if (!d.name.trim()) {
      validationErrors.push({ field: `discount.${d.id}`, message: 'Discount name is required' })
    }
    const val = parseNum(d.value)
    if (val === null || val < 0) {
      validationErrors.push({ field: `discount.${d.name || 'unnamed'}`, message: `Discount "${d.name || 'unnamed'}" requires a non-negative value` })
    } else if (d.type === 'percentage' && val > 1) {
      validationErrors.push({ field: `discount.${d.name}`, message: `Discount "${d.name}" must be a decimal fraction ≤ 1 (e.g. 0.15 for 15%)` })
    }
  }

  return validationErrors
}

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
    // Client-side validation before submitting
    const validationErrors = validateForm(state)

    if (validationErrors.length > 0) {
      dispatch({ type: 'SAVE_ERROR', errors: validationErrors })
      return
    }

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

  const formSections = (
    <>
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
    </>
  )

  if (state.loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Loading rate card…</p>
        </CardContent>
      </Card>
    )
  }

  // Detect "no rate card" after loading: a populated card always has a margin,
  // so empty margin + empty blended rate + no roles means unconfigured.
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
              {formSections}
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
        {formSections}

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
