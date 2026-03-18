'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { KnowledgeEntryCard } from '@/components/knowledge/KnowledgeEntryCard'
import { KnowledgeUploader } from '@/components/knowledge/KnowledgeUploader'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'

export default function CompanyKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/knowledge')
      if (!res.ok) throw new Error('Failed to fetch knowledge entries')
      const data = await res.json()
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleDelete = async (entryId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${entryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete entry')
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleUpload = async (file: File, type: string, title: string) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('title', title)
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to upload document')
      }
      setUploaderOpen(false)
      await fetchEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company Knowledge</h1>
        <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Upload Document</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload to Company Knowledge Base</DialogTitle>
              <DialogDescription>
                Add documents to your organization&apos;s shared knowledge base.
              </DialogDescription>
            </DialogHeader>
            <KnowledgeUploader onUpload={handleUpload} isUploading={isUploading} />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              No company knowledge entries yet. Upload a document to populate the knowledge base.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <KnowledgeEntryCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
