'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import { Search, Check, ChevronsUpDown } from 'lucide-react'

interface EntityOption {
  id: string
  name: string
  raisonSociale?: string | null
  nomCommercial?: string | null
  ice?: string | null
  ville?: string | null
}

interface EntityComboboxProps {
  entities: EntityOption[]
  value: string
  onValueChange: (id: string) => void
  placeholder?: string
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Display sub-text like ICE or city */
  showSubText?: 'ice' | 'ville' | 'none'
  /** Width of the popover */
  contentWidth?: string
  /** Disable the combobox */
  disabled?: boolean
  /** Extra className for trigger */
  className?: string
}

export function EntityCombobox({
  entities,
  value,
  onValueChange,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  showSubText = 'none',
  contentWidth = 'w-[400px]',
  disabled = false,
  className,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entities
    return entities.filter(e => {
      const name = (e.raisonSociale || e.name || '').toLowerCase()
      const nomCommercial = (e.nomCommercial || '').toLowerCase()
      const ice = (e.ice || '').toLowerCase()
      return name.includes(q) || nomCommercial.includes(q) || ice.includes(q)
    })
  }, [entities, search])

  const selected = useMemo(() => {
    if (!value) return null
    return entities.find(e => e.id === value) || null
  }, [entities, value])

  const displayLabel = (e: EntityOption) => e.raisonSociale || e.name || e.nomCommercial || ''
  const subLabel = (e: EntityOption) => {
    if (showSubText === 'ice') return e.ice || ''
    if (showSubText === 'ville') return e.ville || ''
    return ''
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? (
            <span className="truncate">
              {displayLabel(selected)}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(contentWidth, 'p-0')} align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Aucun résultat trouvé.
            </div>
          ) : (
            filtered.map((e) => {
              const label = displayLabel(e)
              const sub = subLabel(e)
              return (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm',
                    value === e.id && 'bg-accent'
                  )}
                  onClick={() => {
                    onValueChange(e.id)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  {value === e.id && <Check className="h-4 w-4 shrink-0" />}
                  <span className="truncate flex-1">{label}</span>
                  {sub && (
                    <span className="text-xs text-muted-foreground shrink-0">{sub}</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
