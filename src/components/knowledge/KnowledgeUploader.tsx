'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type KnowledgeEntryType =
  | 'past_rfp'
  | 'case_study'
  | 'certification'
  | 'company_doc'
  | 'product_doc'
  | 'technical_spec'
  | 'faq'

const ENTRY_TYPES: { value: KnowledgeEntryType; label: string }[] = [
  { value: 'past_rfp', label: 'Past RFP' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'certification', label: 'Certification' },
  { value: 'company_doc', label: 'Company Doc' },
  { value: 'product_doc', label: 'Product Doc' },
  { value: 'technical_spec', label: 'Technical Spec' },
  { value: 'faq', label: 'FAQ' },
]

interface KnowledgeUploaderProps {
  onUpload: (file: File, type: string, title: string) => void
  isUploading?: boolean
  error?: string | null
}

export function KnowledgeUploader({ onUpload, isUploading = false, error = null }: KnowledgeUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedType, setSelectedType] = useState<KnowledgeEntryType>('past_rfp')
  const [title, setTitle] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
    if (file && !title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    handleFileChange(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0] ?? null
    handleFileChange(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) return
    onUpload(selectedFile, selectedType, title)
  }

  return (
    <form data-testid="knowledge-uploader" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div
        data-testid="upload-drop-zone"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
        )}
      >
        <input
          data-testid="file-input"
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          accept=".pdf,.doc,.docx,.txt"
        />
        {selectedFile ? (
          <p data-testid="selected-file-name" className="text-sm font-medium">
            {selectedFile.name}
          </p>
        ) : (
          <div>
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, TXT</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="knowledge-type">Type</Label>
        <select
          id="knowledge-type"
          data-testid="type-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as KnowledgeEntryType)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {ENTRY_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="knowledge-title">Title</Label>
        <Input
          id="knowledge-title"
          data-testid="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title for this entry"
        />
      </div>

      {error && (
        <p data-testid="upload-error" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {isUploading && (
        <p data-testid="uploading-state" className="text-sm text-muted-foreground">
          Uploading...
        </p>
      )}

      <Button
        data-testid="upload-submit-button"
        type="submit"
        disabled={!selectedFile || isUploading}
      >
        {isUploading ? 'Uploading...' : 'Upload'}
      </Button>
    </form>
  )
}
