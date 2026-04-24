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
  ice: string
  tvaNumber: string
  cnss: string
  ifNumber: string
  rc: string
  legalForm: string
  capital: string
  logoUrl: string | null
  // Print footer lines
  footerLine1: string
  footerLine2: string
  footerLine3: string
  footerLine4: string
}

const defaultCompany: CompanyInfo = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Maroc',
  phone: '',
  email: '',
  ice: '',
  tvaNumber: '',
  cnss: '',
  ifNumber: '',
  rc: '',
  legalForm: '',
  capital: '',
  logoUrl: null,
  footerLine1: '',
  footerLine2: '',
  footerLine3: '',
  footerLine4: '',
}

export function PrintHeader() {
  const [company, setCompany] = useState<CompanyInfo>(defaultCompany)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<{ settingsMap: Record<string, string> }>('/settings'),
      fetch('/api/logo').then(r => r.ok).catch(() => false),
    ]).then(([data, hasLogo]) => {
      const m = data.settingsMap || {}
      setCompany({
        name: m.company_name || '',
        address: m.company_address || '',
        city: m.company_city || '',
        postalCode: m.company_postal_code || '',
        country: m.company_country || 'Maroc',
        phone: m.company_phone || '',
        email: m.company_email || '',
        ice: m.company_siret || '',
        tvaNumber: m.company_tva_number || '',
        cnss: m.company_cnss || '',
        ifNumber: m.company_if || '',
        rc: m.company_rc || '',
        legalForm: m.company_legal_form || '',
        capital: m.company_capital || '',
        logoUrl: hasLogo ? `/api/logo?t=${Date.now()}` : null,
        footerLine1: m.print_footer_line1 || '',
        footerLine2: m.print_footer_line2 || '',
        footerLine3: m.print_footer_line3 || '',
        footerLine4: m.print_footer_line4 || '',
      })
    }).catch(() => {})
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
          {company.legalForm && (
            <p className="text-xs text-muted-foreground">{company.legalForm}</p>
          )}
          {fullAddress && (
            <p className="text-xs text-muted-foreground mt-1">{fullAddress}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted-foreground">
            {company.phone && <span>Tél : {company.phone}</span>}
            {company.email && <span>Email : {company.email}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted-foreground">
            {company.ice && <span>ICE : {company.ice}</span>}
            {company.ifNumber && <span>IF : {company.ifNumber}</span>}
            {company.cnss && <span>CNSS : {company.cnss}</span>}
            {company.tvaNumber && <span>TVA : {company.tvaNumber}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted-foreground">
            {company.rc && <span>RC : {company.rc}</span>}
            {company.capital && <span>Capital : {company.capital}</span>}
          </div>
        </div>
        {/* Right: Logo */}
        <div className="flex-shrink-0 w-[100px] h-[100px] flex items-center justify-center border rounded-md bg-muted/20 overflow-hidden">
          {company.logoUrl && !logoError ? (
            <img
              src={company.logoUrl}
              alt="Logo"
              className="w-full h-full object-contain p-1"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-[10px] text-muted-foreground text-center leading-tight px-2">
              Logo
            </span>
          )}
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

/** Print section with amount in French words */
export function PrintFooter({ amount, label }: { amount: number; label: string }) {
  const [words, setWords] = useState('')
  const [footerLines, setFooterLines] = useState<string[]>([])

  useEffect(() => {
    import('@/lib/number-to-words').then((mod) => {
      setWords(mod.numberToFrenchWords(Math.abs(amount)))
    })
    api.get<{ settingsMap: Record<string, string> }>('/settings')
      .then((data) => {
        const m = data.settingsMap || {}
        const lines = [
          m.print_footer_line1,
          m.print_footer_line2,
          m.print_footer_line3,
          m.print_footer_line4,
        ].filter(Boolean)
        setFooterLines(lines)
      })
      .catch(() => {})
  }, [amount])

  return (
    <div className="mt-6 space-y-4">
      {words && (
        <div className="text-sm italic text-muted-foreground">
          {label} : <span className="font-medium not-italic text-foreground">{words}</span>
        </div>
      )}
      {footerLines.length > 0 && (
        <div className="border-t pt-4 mt-4 space-y-1">
          {footerLines.map((line, i) => (
            <p key={i} className="text-[10px] text-center text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
