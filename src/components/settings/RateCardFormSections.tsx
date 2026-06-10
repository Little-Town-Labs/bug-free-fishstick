'use client'

import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RoleRow } from './rate-card-form-state'

// ─── Mode selector ────────────────────────────────────────────────────────────

interface ModeSelectorProps {
  mode: 'blended' | 'by_role'
  disabled: boolean
  onChange: (mode: 'blended' | 'by_role') => void
}

export function ModeSelector({ mode, disabled, onChange }: ModeSelectorProps) {
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

// ─── Blended rate ─────────────────────────────────────────────────────────────

interface BlendedRateSectionProps {
  blendedRate: string
  blendedRateUnit: 'hour' | 'day' | 'fixed'
  disabled: boolean
  onRateChange: (v: string) => void
  onUnitChange: (v: 'hour' | 'day' | 'fixed') => void
}

export function BlendedRateSection({
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

// ─── Role table ───────────────────────────────────────────────────────────────

interface RoleTableProps {
  roles: RoleRow[]
  disabled: boolean
  onAdd: () => void
  onUpdate: (id: string, field: keyof RoleRow, value: string) => void
  onDelete: (id: string) => void
}

export function RoleTable({ roles, disabled, onAdd, onUpdate, onDelete }: RoleTableProps) {
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
                <RoleTableRow
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

interface RoleTableRowProps {
  role: RoleRow
  disabled: boolean
  onUpdate: (id: string, field: keyof RoleRow, value: string) => void
  onDelete: (id: string) => void
}

function RoleTableRow({ role, disabled, onUpdate, onDelete }: RoleTableRowProps) {
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

// ─── Save section ─────────────────────────────────────────────────────────────

interface SaveSectionProps {
  saving: boolean
  saveSuccess: boolean
  errors: Array<{ field: string; message: string }>
  onSave: () => void
}

export function SaveSection({ saving, saveSuccess, errors, onSave }: SaveSectionProps) {
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
