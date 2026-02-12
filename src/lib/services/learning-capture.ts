import { db } from '@/lib/db'
import { learnings } from '@/lib/db/schema'
import type { Learning } from '@/lib/db/schema'

export interface CaptureCorrection {
  rfpId: string
  fieldId: string
  organizationId: string
  customerId?: string | null
  createdBy: string
  originalText: string
  correctedText: string
}

export async function captureCorrection(input: CaptureCorrection): Promise<Learning> {
  const [row] = await db
    .insert(learnings)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      content: `Field correction: ${input.correctedText}`,
      sourceType: 'user_correction',
      createdBy: input.createdBy,
      sourceMetadata: {
        rfpId: input.rfpId,
        fieldId: input.fieldId,
        originalText: input.originalText,
        correctedText: input.correctedText,
      },
    })
    .returning()

  if (!row) throw new Error('Failed to insert learning record')
  return row
}

export interface CaptureManualLearning {
  organizationId: string
  customerId?: string | null
  content: string
  createdBy: string
}

export async function captureManualLearning(input: CaptureManualLearning): Promise<Learning> {
  const [row] = await db
    .insert(learnings)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      content: input.content,
      sourceType: 'manual_entry',
      createdBy: input.createdBy,
      sourceMetadata: null,
    })
    .returning()

  if (!row) throw new Error('Failed to insert learning record')
  return row
}
