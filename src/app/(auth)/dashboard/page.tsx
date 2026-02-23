'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { RfpListSkeleton } from '@/components/shared/Skeletons'

interface RfpItem {
  id: string
  name: string
  status: string
  customerCompanyName: string | null
  customerId: string | null
  rfpType: string | null
  complexity: string | null
  createdAt: string
}

interface CustomerOption {
  id: string
  name: string
}

export default function DashboardPage() {
  const [rfps, setRfps] = useState<RfpItem[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [complexityFilter, setComplexityFilter] = useState<string>('all')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRfps = useCallback(async () => {
    try {
      setLoading(true)
      const url =
        customerFilter && customerFilter !== 'all'
          ? `/api/rfps?customerId=${customerFilter}`
          : '/api/rfps'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setRfps(data.rfps ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [customerFilter])

  useEffect(() => {
    fetchRfps()
  }, [fetchRfps])

  const handleDelete = useCallback(async (rfpId: string) => {
    setDeletingId(rfpId)
    try {
      const res = await fetch(`/api/rfps/${rfpId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setRfps((prev) => prev.filter((r) => r.id !== rfpId))
      }
    } finally {
      setDeletingId(null)
      setConfirmingDeleteId(null)
    }
  }, [])

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers')
        if (res.ok) {
          const data = await res.json()
          setCustomers(data.customers ?? [])
        }
      } catch {
        // ignore
      }
    }
    loadCustomers()
  }, [])

  const filteredRfps = rfps.filter((r) => {
    if (typeFilter && typeFilter !== 'all' && r.rfpType !== typeFilter) return false
    if (complexityFilter && complexityFilter !== 'all' && r.complexity !== complexityFilter)
      return false
    return true
  })

  const totalRfps = filteredRfps.length
  const inProgress = filteredRfps.filter((r) =>
    ['draft', 'processing', 'submitted'].includes(r.status)
  ).length
  const completed = filteredRfps.filter((r) => r.status === 'finalized').length

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <Link href="/rfps/new">
          <Button>New RFP</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total RFPs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRfps}</p>
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{inProgress}</p>
          </CardContent>
        </Card>
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 hover:-translate-y-0.5 hover:shadow-md transition-all">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent RFPs</CardTitle>
            <div className="flex items-center gap-2">
              {customers.length > 0 && (
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Complexity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Complexity</SelectItem>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="complex">Complex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<RfpListSkeleton />}>
            {loading ? (
              <RfpListSkeleton />
            ) : rfps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No RFPs yet. Create your first RFP to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRfps.map((rfp) => {
                  const isInProgress = ['draft', 'processing', 'submitted'].includes(rfp.status)
                  const isConfirming = confirmingDeleteId === rfp.id
                  const isDeleting = deletingId === rfp.id

                  return (
                    <Link key={rfp.id} href={`/rfps/${rfp.id}`} className="block">
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium text-sm">{rfp.name}</p>
                          {rfp.customerCompanyName && (
                            <p className="text-xs text-muted-foreground">
                              {rfp.customerCompanyName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {rfp.rfpType && (
                            <Badge variant="outline" className="text-xs">
                              {rfp.rfpType}
                            </Badge>
                          )}
                          {rfp.complexity && (
                            <Badge variant="outline" className="text-xs">
                              {rfp.complexity}
                            </Badge>
                          )}
                          <Badge variant="secondary">{rfp.status}</Badge>
                          {isInProgress &&
                            (isConfirming ? (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={isDeleting}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDelete(rfp.id)
                                  }}
                                >
                                  {isDeleting ? 'Deleting…' : 'Delete'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={isDeleting}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setConfirmingDeleteId(null)
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setConfirmingDeleteId(rfp.id)
                                }}
                                aria-label={`Delete ${rfp.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ))}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
