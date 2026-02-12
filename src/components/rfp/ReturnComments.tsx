'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ReturnCommentsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (comments: string) => void
  isLoading?: boolean
}

export function ReturnComments({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: ReturnCommentsProps) {
  const [comments, setComments] = useState('')

  const handleSubmit = () => {
    if (comments.trim()) {
      onSubmit(comments.trim())
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setComments('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="return-comments-dialog">
        <DialogHeader>
          <DialogTitle>Return RFP for Revision</DialogTitle>
          <DialogDescription>
            Provide feedback explaining what needs to be revised before resubmission.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            data-testid="return-comments-input"
            placeholder="Describe what needs to be revised..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            disabled={isLoading}
          />
        </div>

        <DialogFooter>
          <Button
            data-testid="return-comments-cancel"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            data-testid="return-comments-submit"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!comments.trim() || isLoading}
          >
            Return RFP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
