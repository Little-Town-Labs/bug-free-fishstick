'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ProposalTemplate } from '@/lib/db/schema/proposal-templates'

interface TemplateDeleteConfirmProps {
  open: boolean
  target: ProposalTemplate | null
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function TemplateDeleteConfirm({
  open,
  target,
  isDeleting,
  onConfirm,
  onCancel,
}: TemplateDeleteConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <strong>{target?.title ?? 'this template'}</strong>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
