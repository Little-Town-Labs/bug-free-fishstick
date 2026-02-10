'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Customer {
  id: string
  name: string
}

interface CustomerSelectorProps {
  customers: Customer[]
  selectedId?: string
  onSelect: (id: string) => void
  isLoading?: boolean
}

export function CustomerSelector({
  customers,
  selectedId,
  onSelect,
  isLoading = false,
}: CustomerSelectorProps) {
  if (isLoading) {
    return <Skeleton data-testid="customer-selector-skeleton" className="h-9 w-48" />
  }

  const selectedCustomer = customers.find((c) => c.id === selectedId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="customer-selector-trigger"
          variant="outline"
          className={cn('min-w-[12rem] justify-between', !selectedCustomer && 'text-muted-foreground')}
        >
          <span>{selectedCustomer ? selectedCustomer.name : 'Select customer'}</span>
          <span className="ml-2 opacity-50">&#8964;</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="customer-selector-menu" align="start" className="min-w-[12rem]">
        {customers.length === 0 ? (
          <DropdownMenuItem disabled data-testid="customer-selector-empty">
            No customers available
          </DropdownMenuItem>
        ) : (
          customers.map((customer) => (
            <DropdownMenuItem
              key={customer.id}
              data-testid={`customer-option-${customer.id}`}
              onClick={() => onSelect(customer.id)}
              className={cn(selectedId === customer.id && 'font-medium')}
            >
              {customer.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
