'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload } from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StepIndicator({ step }: { step: number }) {
  const steps = ['Details', 'Upload', 'Review']
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const num = i + 1
        const active = num === step
        const complete = num < step
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                  ${
                    active || complete
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'border-2 border-muted text-muted-foreground scale-100'
                  }`}
              >
                {num}
              </div>
              <span
                className={`text-xs transition-all duration-200 ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 w-16 mb-5 transition-all duration-500 ${num < step ? 'bg-primary' : 'bg-muted'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function NewRfpPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [rfpName, setRfpName] = useState('')

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/customers')
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data.customers ?? [])
      })
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false))
  }, [])

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
  }

  async function handleSubmit() {
    if (!selectedFile) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      // Step 1: Create RFP
      const createRes = await fetch('/api/rfps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rfpName, customerId }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error ?? 'Failed to create RFP')
      }
      const { rfp } = await createRes.json()

      // Step 2: Upload file
      const formData = new FormData()
      formData.append('file', selectedFile)
      const uploadRes = await fetch(`/api/rfps/${rfp.id}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error ?? 'Failed to upload file')
      }

      // Step 3: Trigger processing
      const processRes = await fetch(`/api/rfps/${rfp.id}/process`, {
        method: 'POST',
      })
      if (!processRes.ok) {
        const err = await processRes.json()
        throw new Error(err.error ?? 'Failed to start processing')
      }

      router.push(`/rfps/${rfp.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setIsSubmitting(false)
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)

  return (
    <div className="container mx-auto py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm" disabled={isSubmitting}>
            Back
          </Button>
        </Link>
        <h1 className="font-display text-3xl font-bold">Create New RFP</h1>
      </div>

      <StepIndicator step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>RFP Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rfp-name">RFP Name</Label>
              <Input
                id="rfp-name"
                placeholder="e.g., Q1 2026 Security Assessment"
                value={rfpName}
                onChange={(e) => setRfpName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              {customersLoading ? (
                <Select disabled>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Loading customers..." />
                  </SelectTrigger>
                </Select>
              ) : customers.length === 0 ? (
                <div className="space-y-1">
                  <Select disabled>
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="No customers available" />
                    </SelectTrigger>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    No customers found.{' '}
                    <Link href="/customers" className="underline">
                      Create one first →
                    </Link>
                  </p>
                </div>
              ) : (
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!rfpName.trim() || !customerId}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files[0] ?? null
                handleFileChange(file)
              }}
            >
              {selectedFile ? (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <Upload className="size-8 mx-auto text-primary" />
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs mt-2"
                    onClick={() => handleFileChange(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="size-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Drag and drop your RFP document here</p>
                  <p className="text-xs text-muted-foreground">Supports PDF and DOCX formats</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                id="file-upload"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {!selectedFile && (
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!selectedFile}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm rounded-md border p-4 bg-muted/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">RFP Name</span>
                <span className="font-medium">{rfpName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedCustomer?.name ?? customerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Document</span>
                <span className="font-medium">
                  {selectedFile
                    ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}`
                    : 'No file selected'}
                </span>
              </div>
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create RFP'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
