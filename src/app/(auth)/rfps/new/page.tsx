'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewRfpPage() {
  const [step, setStep] = useState(1)
  const [rfpName, setRfpName] = useState('')
  const [customerName, setCustomerName] = useState('')

  return (
    <div className="container mx-auto py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Back</Button>
        </Link>
        <h1 className="text-3xl font-bold">Create New RFP</h1>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={step >= 1 ? 'font-semibold text-foreground' : ''}>1. Details</span>
        <span>&rarr;</span>
        <span className={step >= 2 ? 'font-semibold text-foreground' : ''}>2. Upload</span>
        <span>&rarr;</span>
        <span className={step >= 3 ? 'font-semibold text-foreground' : ''}>3. Review</span>
      </div>

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
              <Input
                id="customer"
                placeholder="e.g., Acme Corporation"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!rfpName}>
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
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <p className="text-muted-foreground mb-2">
                Drag and drop your RFP document here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Supports PDF and DOCX formats
              </p>
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>
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
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">RFP Name</span>
                <span className="font-medium">{rfpName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{customerName || 'Not specified'}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button>
                Create RFP
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
