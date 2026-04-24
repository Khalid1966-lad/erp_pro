'use client'

import { api } from '@/lib/api'

/* ── Types ─────────────────────────────────────────────────────────── */

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
  footerLine1: string
  footerLine2: string
  footerLine3: string
  footerLine4: string
}

/* ── Cache ─────────────────────────────────────────────────────────── */

let companyCache: CompanyInfo | null = null
let companyFetchPromise: Promise<CompanyInfo> | null = null

export async function getCompanyInfo(): Promise<CompanyInfo> {
  if (companyCache) return companyCache
  if (companyFetchPromise) return companyFetchPromise

  companyFetchPromise = (async () => {
    try {
      const settingsData = await api.get<{ settingsMap: Record<string, string> }>('/settings')
      const m = settingsData.settingsMap || {}
      // Logo exists if company_logo_url is set in settings (stored in DB on Vercel)
      const hasLogo = !!m.company_logo_url
      companyCache = {
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
      }
      return companyCache
    } catch {
      return {
        name: '', address: '', city: '', postalCode: '', country: 'Maroc',
        phone: '', email: '', ice: '', tvaNumber: '', cnss: '', ifNumber: '',
        rc: '', legalForm: '', capital: '', logoUrl: null,
        footerLine1: '', footerLine2: '', footerLine3: '', footerLine4: '',
      }
    }
  })()

  return companyFetchPromise
}

/* ── Format helpers ───────────────────────────────────────────────── */

export const fmtMoney = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD'

export function fmtDate(d: string): string {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d
  }
}

/* ── HTML builders ────────────────────────────────────────────────── */

function buildHeaderHtml(c: CompanyInfo): string {
  const fullAddress = [c.address, c.postalCode, c.city, c.country].filter(Boolean).join(', ')
  const identLine1 = [c.ice ? `ICE : ${c.ice}` : '', c.ifNumber ? `IF : ${c.ifNumber}` : '', c.cnss ? `CNSS : ${c.cnss}` : '', c.tvaNumber ? `TVA : ${c.tvaNumber}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')
  const identLine2 = [c.rc ? `RC : ${c.rc}` : '', c.capital ? `Capital : ${c.capital}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')
  const contactLine = [c.phone ? `Tél : ${c.phone}` : '', c.email ? `Email : ${c.email}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')

  const logoSrc = c.logoUrl ? (c.logoUrl.startsWith('http') ? c.logoUrl : `${window.location.origin}${c.logoUrl}`) : ''
  const logoBlock = c.logoUrl
    ? `<div style="flex-shrink:0;width:100px;height:100px;border:1px solid #e5e7eb;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
         <img src="${logoSrc}" alt="Logo" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#9ca3af\\'>Logo</span>'">
       </div>`
    : ''

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px;">
      <div style="flex:1;">
        ${c.name ? `<div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${esc(c.name)}</div>` : ''}
        ${c.legalForm ? `<div style="font-size:11px;color:#6b7280;">${esc(c.legalForm)}</div>` : ''}
        ${fullAddress ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${esc(fullAddress)}</div>` : ''}
        ${contactLine ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${contactLine}</div>` : ''}
        ${identLine1 ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${identLine1}</div>` : ''}
        ${identLine2 ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${identLine2}</div>` : ''}
      </div>
      ${logoBlock}
    </div>
    <div style="border-top:2px solid #1a1a1a;margin-bottom:16px;"></div>`
}

function buildFooterHtml(amountInWords?: string, footerLines?: string[]): string {
  let html = ''
  if (amountInWords) {
    html += `<div style="margin-top:20px;font-size:11px;font-style:italic;color:#374151;">${esc(amountInWords)}</div>`
  }
  if (footerLines && footerLines.length > 0) {
    html += `<div style="margin-top:24px;padding-top:10px;border-top:1px solid #d1d5db;">`
    footerLines.forEach(line => {
      html += `<div style="text-align:center;font-size:9px;color:#6b7280;margin:2px 0;">${esc(line)}</div>`
    })
    html += `</div>`
  }
  return html
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ── Print styles ─────────────────────────────────────────────────── */

const PRINT_CSS = `
@page { size: A4; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #1a1a1a; font-size: 11px; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.doc-title {
  text-align: center; font-size: 15px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 12px;
}
.info-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px 16px;
  margin-bottom: 12px; font-size: 11px;
}
.info-grid .label { color: #6b7280; font-size: 10px; }
.info-grid .value { font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; }
th { background: #f3f4f6; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #374151; }
td { font-size: 11px; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.totals-box {
  display: flex; justify-content: flex-end; margin-top: 12px;
}
.totals-table { width: 320px; border-collapse: collapse; }
.totals-table tr td {
  border: none; padding: 3px 8px; font-size: 11px;
}
.totals-table .total-label { color: #6b7280; }
.totals-table .total-value { text-align: right; font-weight: 500; }
.totals-table .grand-total td {
  border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 13px; padding-top: 6px;
}
.totals-table .grand-total .total-value { color: #1a1a1a; }
.negative td { color: #dc2626 !important; }
.notes-box {
  margin-top: 10px; padding: 8px 12px; background: #f9fafb; border-radius: 6px;
  font-size: 11px; border: 1px solid #e5e7eb;
}
.notes-box .notes-label { color: #6b7280; }
.section-title {
  font-size: 12px; font-weight: 600; margin: 16px 0 6px; color: #374151;
  border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;
}
.badge {
  display: inline-block; padding: 1px 8px; border-radius: 9999px;
  font-size: 10px; font-weight: 500;
}
.badge-green { background: #dcfce7; color: #166534; }
.badge-red { background: #fee2e2; color: #991b1b; }
.badge-yellow { background: #fef9c3; color: #854d0e; }
.badge-blue { background: #dbeafe; color: #1e40af; }
.badge-gray { background: #f3f4f6; color: #374151; }
.sub-table { margin-top: 6px; }
.sub-table th { font-size: 9px; padding: 4px 6px; }
.sub-table td { font-size: 10px; padding: 4px 6px; }
`

/* ── Main print function ──────────────────────────────────────────── */

export async function printDocument(options: {
  title: string            // e.g., "DEVIS", "FACTURE"
  docNumber: string
  infoGrid: Array<{ label: string; value: string; colspan?: number }>
  columns: Array<{ label: string; align?: string }>
  rows: Array<Array<{ value: string | number; align?: string }>>
  totals: Array<{ label: string; value: string; bold?: boolean; negative?: boolean }>
  notes?: string
  amountInWords?: string
  amountInWordsLabel?: string
  negativeTotals?: boolean
  subSections?: string    // Additional HTML sections below the main table
}) {
  const company = await getCompanyInfo()

  // Build info grid
  let infoHtml = '<div class="info-grid">'
  for (const item of options.infoGrid) {
    const colspanStyle = item.colspan ? `grid-column: span ${item.colspan};` : ''
    infoHtml += `<div style="${colspanStyle}"><div class="label">${esc(item.label)}</div><div class="value">${esc(String(item.value))}</div></div>`
  }
  infoHtml += '</div>'

  // Build table
  let tableHtml = '<table><thead><tr>'
  for (const col of options.columns) {
    tableHtml += `<th class="${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}">${esc(col.label)}</th>`
  }
  tableHtml += '</tr></thead><tbody>'
  for (const row of options.rows) {
    const isNegative = options.negativeTotals && row.length > 0
    tableHtml += '<tr>'
    for (const cell of row) {
      tableHtml += `<td class="${cell.align === 'right' ? 'text-right' : cell.align === 'center' ? 'text-center' : ''}">${esc(String(cell.value))}</td>`
    }
    tableHtml += '</tr>'
  }
  tableHtml += '</tbody></table>'

  // Build totals
  let totalsHtml = '<div class="totals-box"><table class="totals-table">'
  for (let i = 0; i < options.totals.length; i++) {
    const t = options.totals[i]
    const isGrandTotal = t.bold
    const isNegative = t.negative || options.negativeTotals
    totalsHtml += `<tr class="${isGrandTotal ? 'grand-total' : ''} ${isNegative ? 'negative' : ''}">
      <td class="total-label">${esc(t.label)}</td>
      <td class="total-value">${esc(t.value)}</td>
    </tr>`
  }
  totalsHtml += '</table></div>'

  // Notes
  let notesHtml = ''
  if (options.notes) {
    notesHtml = `<div class="notes-box"><span class="notes-label">Notes : </span>${esc(options.notes)}</div>`
  }

  // Amount in words
  const amountText = options.amountInWordsLabel
    ? `${options.amountInWordsLabel} : ${options.amountInWords}`
    : options.amountInWords

  // Footer lines from company settings
  const footerLines = [company.footerLine1, company.footerLine2, company.footerLine3, company.footerLine4].filter(Boolean)

  // Assemble body
  const bodyHtml = `
    ${buildHeaderHtml(company)}
    <div class="doc-title">${esc(options.title)}${options.docNumber ? ` N° ${esc(options.docNumber)}` : ''}</div>
    ${infoHtml}
    ${tableHtml}
    ${notesHtml}
    ${totalsHtml}
    ${options.subSections || ''}
    ${buildFooterHtml(amountText, footerLines)}
  `

  // Full HTML document
  const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${esc(options.title)} ${esc(options.docNumber)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`

  // Use a hidden iframe to avoid browser header/footer ("about:blank 1/1")
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    alert('Erreur lors de la préparation de l\'impression.')
    return
  }

  iframeDoc.open()
  iframeDoc.write(fullHtml)
  iframeDoc.close()

  // Wait for images/fonts to load, then print
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.print()
      } catch {
        // fallback: open in new tab
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(fullHtml)
          win.document.close()
          win.print()
        }
      }
      // Clean up iframe after print dialog closes
      setTimeout(() => document.body.removeChild(iframe), 2000)
    }, 500)
  }
}
