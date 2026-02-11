import type { RfpStatus } from '@/lib/db/schema/rfps'

export class WorkflowError extends Error {
  constructor(
    message: string,
    public statusCode = 409
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export const VALID_TRANSITIONS: Record<RfpStatus, RfpStatus[]> = {
  draft: ['submitted'],
  processing: [],
  submitted: ['approved', 'draft'],
  approved: ['finalized'],
  finalized: [],
}

export function canTransition(from: RfpStatus, to: RfpStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function validateTransition(from: RfpStatus, to: RfpStatus): void {
  if (!canTransition(from, to)) {
    throw new WorkflowError(
      `Invalid transition: ${from} → ${to}`,
      409
    )
  }
}

export function getAvailableTransitions(status: RfpStatus): RfpStatus[] {
  return VALID_TRANSITIONS[status]
}
