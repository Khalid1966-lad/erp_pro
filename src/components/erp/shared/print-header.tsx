'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface CompanyInfo {
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  phone: string
  email: string
  siret: string
  tvaNumber: string
}

const defaultCompany: CompanyInfo = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Maroc',
  phone: '',
  email: '',
  siret: '',
  tvaNumber: '',
}

export function PrintHeader() {
  const [company, setCompany] = useState<CompanyInfo>(defaultCompany)

  useEffect(() => {
    api.get<{ settingsMap: Record<string, string> }>('/settings')
      .then((data) => {
        const m = data.settingsMap || {}
        setCompany({
          name: m.company_name || '',
          address: m.company_address || '',
          city: m.company_city || '',
          postalCode: m.company_postal_code || '',
          country: m.company_country || 'Maroc',
          phone: m.company_phone || '',
          email: m.company_email || '',
          siret: m.company_siret || '',
          tvaNumber: m.company_tva_number || '',
        })
      })
      .catch(() => {})
  }, [])

  const fullAddress = [company.address, company.postalCode, company.city, company.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="print-header mb-6">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Company info */}
        <div className="flex-1">
          {company.name && (
            <h2 className="text-lg font-bold uppercase tracking-wide">{company.name}</h2>
          )}
          {fullAddress && (
            <p className="text-xs text-muted-foreground mt-1">{fullAddress}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted-foreground">
            {company.phone && <span>Tél : {company.phone}</span>}
            {company.email && <span>Email : {company.email}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted-foreground">
            {company.siret && <span>ICE : {company.siret}</span>}
            {company.tvaNumber && <span>TVA : {company.tvaNumber}</span>}
          </div>
        </div>
        {/* Right: Logo placeholder */}
        <div className="flex-shrink-0 w-[100px] h-[100px] flex items-center justify-center border rounded-md bg-muted/20">
          <span className="text-[10px] text-muted-foreground text-center leading-tight px-2">
            Logo
          </span>
        </div>
      </div>
      {/* Separator line */}
      <div className="border-b-2 border-primary mt-3" />
    </div>
  )
}

/** Shared format currency helper */
export const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

/** Print footer with amount in French words */
export function PrintFooter({ amount, label }: { amount: number; label: string }) {
  // Lazy import to avoid SSR issues
  const [words, setWords] = useState('')

  useEffect(() => {
    import('@/lib/number-to-words').then((mod) => {
      setWords(mod.numberToFrenchWords(Math.abs(amount)))
    })
  }, [amount])

  if (!words) return null

  return (
    <div className="mt-6 text-sm italic text-muted-foreground">
      {label} : <span className="font-medium not-italic text-foreground">{words}</span>
    </div>
  )
}
