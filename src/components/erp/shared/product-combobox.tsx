'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import { Search, Check, ChevronsUpDown, Loader2 } from 'lucide-react'

export interface ProductOption {
  id: string
  reference: string
  designation: string
  priceHT?: number
  purchasePrice?: number
  tvaRate?: number
  productUsage?: string
  productNature?: string
}

interface ProductComboboxProps {
  /** All products to display (already filtered by search) */
  products: ProductOption[]
  /** Currently selected product ID */
  value: string
  /** Loading state */
  loading?: boolean
  /** Current search input value */
  searchValue: string
  /** Called when search input changes */
  onSearchChange: (val: string) => void
  /** Called when a product is selected */
  onSelect: (productId: string) => void
  /** Price field to display: 'priceHT' for sales, 'purchasePrice' for purchases. Default: 'priceHT' */
  priceField?: 'priceHT' | 'purchasePrice'
  /** Placeholder text */
  placeholder?: string
  /** Combobox width */
  contentWidth?: string
  /** Custom className for the trigger */
  className?: string
}

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

export function ProductCombobox({
  products,
  value,
  loading = false,
  searchValue,
  onSearchChange,
  onSelect,
  priceField = 'priceHT',
  placeholder = 'Produit...',
  contentWidth = 'w-[550px]',
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false)

  // Compute the label for the selected product — search across ALL products (not just filtered)
  const selected = useMemo(() => products.find(p => p.id === value), [products, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal h-9 text-xs', className)}
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Chargement...
            </span>
          ) : selected ? (
            <span className="truncate">
              {selected.reference} - {selected.designation}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(contentWidth, 'p-0')} align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Désignation / Réf..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-[250px] overflow-y-auto">
          {products.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Aucun produit trouvé.
            </div>
          ) : (
            products.slice(0, 50).map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-xs',
                  value === p.id && 'bg-accent'
                )}
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                }}
              >
                {value === p.id && <Check className="h-3 w-3 shrink-0" />}
                <span className="font-mono shrink-0 text-muted-foreground">{p.reference}</span>
                <span className="truncate flex-1">{p.designation}</span>
                <span className="shrink-0 font-medium">
                  {formatCurrency(priceField === 'purchasePrice' ? (p.purchasePrice || 0) : (p.priceHT || 0))}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Hook to manage product combobox search state for multiple line items.
 * Returns lineSearches, getFilteredProducts, and resetLineSearches.
 */
export function useProductSearch(allProducts: ProductOption[]) {
  const [lineSearches, setLineSearches] = useState<Record<number | string, string>>({})

  const getFilteredProducts = (idx: number | string) => {
    const q = (lineSearches[idx] || '').toLowerCase()
    if (!q.trim()) return allProducts
    return allProducts.filter(p =>
      p.designation.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q)
    )
  }

  const resetLineSearches = () => setLineSearches({})

  return { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches }
}
