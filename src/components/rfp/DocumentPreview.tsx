import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Field {
  id: string
  type: string
  question: string
  position: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ParsedStructure {
  pages: number
  fields: Field[]
}

export interface DocumentPreviewProps {
  documentUrl: string | null
  documentType: 'pdf' | 'docx' | null
  parsedStructure: ParsedStructure | null
  fileName?: string
  isLoading?: boolean
}

export function DocumentPreview({
  documentUrl,
  documentType,
  parsedStructure,
  fileName,
  isLoading = false,
}: DocumentPreviewProps) {
  return (
    <Card role="region" aria-label="Document Preview">
      <CardHeader>
        <CardTitle>Document Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div data-testid="document-preview-skeleton">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-full mb-1" />
          </div>
        ) : documentUrl === null ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No document loaded</p>
            <p className="text-sm mt-1">Upload a document to begin</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-medium">{fileName ?? 'Untitled Document'}</span>
              {documentType === 'pdf' && <Badge variant="secondary">PDF</Badge>}
              {documentType === 'docx' && <Badge variant="secondary">DOCX</Badge>}
            </div>

            {parsedStructure === null ? (
              <p className="text-sm text-muted-foreground">
                Document has not been parsed yet. No fields available.
              </p>
            ) : (
              <>
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  <span>{parsedStructure.fields.length} fields detected</span>
                  <span>{parsedStructure.pages} pages</span>
                </div>

                <h3 role="heading" className="text-sm font-semibold mb-2">
                  Extracted Fields
                </h3>

                <ul role="list" className="space-y-2">
                  {parsedStructure.fields.map((field) => (
                    <li key={field.id} role="listitem" className="border rounded p-2 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {field.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Page {field.position.page}
                        </span>
                      </div>
                      <p className={cn('truncate')}>{field.question}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
