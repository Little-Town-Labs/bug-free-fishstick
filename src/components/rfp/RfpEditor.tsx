'use client'

import { DocumentPreview } from '@/components/rfp/DocumentPreview'
import type { ParsedStructure } from '@/components/rfp/DocumentPreview'
import { ResponseCard } from '@/components/rfp/ResponseCard'

interface RfpEditorProps {
  rfpId: string
  documentUrl: string | null
  documentType: 'pdf' | 'docx' | null
  parsedStructure: ParsedStructure | null
  fileName?: string
  responses: Array<{
    id: string
    fieldId: string
    fieldType: string
    question: string
    responseText: string | null
    confidenceScore: number | null
    status: 'auto_filled' | 'needs_input' | 'manually_filled' | 'approved'
  }>
  onAcceptResponse?: (fieldId: string) => void
  onEditResponse?: (fieldId: string, newText: string) => void
  onRejectResponse?: (fieldId: string) => void
  isProcessing?: boolean
}

export function RfpEditor({
  documentUrl,
  documentType,
  parsedStructure,
  fileName,
  responses,
  onAcceptResponse,
  onEditResponse,
  onRejectResponse,
  isProcessing = false,
}: RfpEditorProps) {
  return (
    <div className="relative">
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Processing RFP...</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <DocumentPreview
            documentUrl={documentUrl}
            documentType={documentType}
            parsedStructure={parsedStructure}
            fileName={fileName}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Responses</h2>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No responses yet. Process the RFP to generate AI responses.
            </p>
          ) : (
            responses.map((response) => (
              <ResponseCard
                key={response.id}
                fieldId={response.fieldId}
                question={response.question}
                responseText={response.responseText}
                confidenceScore={response.confidenceScore}
                status={response.status}
                fieldType={response.fieldType}
                onAccept={onAcceptResponse}
                onEdit={onEditResponse}
                onReject={onRejectResponse}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
