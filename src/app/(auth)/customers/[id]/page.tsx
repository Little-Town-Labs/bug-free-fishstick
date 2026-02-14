'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { KnowledgeEntryCard } from '@/components/knowledge/KnowledgeEntryCard'
import { KnowledgeUploader } from '@/components/knowledge/KnowledgeUploader'
import { CustomerSettingsForm } from '@/components/customers/CustomerSettingsForm'
import type { KnowledgeEntry } from '@/lib/db/schema/knowledge-entries'

interface CustomerSettings {
  preferredTone?: 'formal' | 'casual' | 'technical'
  industryContext?: string
  customInstructions?: string
}

interface Customer {
  id: string
  name: string
  description: string | null
  settings: CustomerSettings | null
  createdAt: string
  stats?: {
    knowledgeEntries: number
    totalRfps: number
  }
}

interface RfpSummary {
  id: string
  name: string
  status: string
  createdAt: string
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const customerId = params.id

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [rfps, setRfps] = useState<RfpSummary[]>([])
  const [customerLoading, setCustomerLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [rfpsLoading, setRfpsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fetchCustomer = useCallback(async () => {
    try {
      setCustomerLoading(true)
      const res = await fetch(`/api/customers/${customerId}`)
      if (!res.ok) throw new Error('Failed to fetch customer')
      const data = await res.json()
      setCustomer(data.customer ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setCustomerLoading(false)
    }
  }, [customerId])

  const fetchEntries = useCallback(async () => {
    try {
      setEntriesLoading(true)
      const res = await fetch(`/api/customers/${customerId}/knowledge`)
      if (!res.ok) throw new Error('Failed to fetch knowledge entries')
      const data = await res.json()
      setEntries(data.entries ?? data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setEntriesLoading(false)
    }
  }, [customerId])

  const fetchRfps = useCallback(async () => {
    try {
      setRfpsLoading(true)
      const res = await fetch(`/api/rfps?customerId=${customerId}`)
      if (!res.ok) throw new Error('Failed to fetch RFPs')
      const data = await res.json()
      setRfps(data.rfps ?? [])
    } catch {
      // non-critical, don't set error
    } finally {
      setRfpsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchCustomer()
    fetchEntries()
    fetchRfps()
  }, [fetchCustomer, fetchEntries, fetchRfps])

  // Poll for processing status updates
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const hasProcessing = entries.some(
      e => e.processingStatus && e.processingStatus !== 'complete' && e.processingStatus !== 'error'
    )
    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        fetchEntries()
      }, 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [entries, fetchEntries])

  const handleDelete = async (entryId: string) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/knowledge/${entryId}`, {
        method: 'DELETE',
      })
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
      const res = await fetch(`/api/customers/${customerId}/knowledge/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to upload document')
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
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="outline" size="sm">Back to Customers</Button>
        </Link>
        {customerLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-bold">{customer?.name ?? 'Customer'}</h1>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!customerLoading && customer && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {customer.description && (
              <p className="text-sm text-muted-foreground">{customer.description}</p>
            )}
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Knowledge entries:{' '}
                <Badge variant="secondary">{entriesLoading ? '...' : entries.length}</Badge>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="knowledge">
        <TabsList>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="rfps">RFPs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Knowledge Entries</h2>
            <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
              <DialogTrigger asChild>
                <Button size="sm">Upload Document</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload to Knowledge Base</DialogTitle>
                </DialogHeader>
                <KnowledgeUploader
                  onUpload={handleUpload}
                  isUploading={isUploading}
                />
              </DialogContent>
            </Dialog>
          </div>

          {entriesLoading ? (
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
                  No knowledge entries yet. Upload a document to populate the knowledge base.
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
        </TabsContent>

        <TabsContent value="rfps" className="space-y-4">
          <h2 className="text-lg font-semibold">RFP History</h2>
          {rfpsLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Card key={i}><CardContent className="pt-4"><Skeleton className="h-5 w-3/4" /></CardContent></Card>
              ))}
            </div>
          ) : rfps.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No RFPs for this customer yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rfps.map((rfp) => (
                <Link key={rfp.id} href={`/rfps/${rfp.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <span className="font-medium text-sm">{rfp.name}</span>
                      <Badge variant="secondary">{rfp.status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-lg font-semibold">Customer Settings</h2>
          <Card>
            <CardContent className="pt-6">
              <CustomerSettingsForm
                customerId={customerId}
                settings={customer?.settings ?? null}
                isAdmin={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
