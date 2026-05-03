'use client'

import { api } from '@/lib/api'
import html2pdf from 'html2pdf.js'

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
  logoShape: 'square' | 'rectangle'
  logoWidth: number
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
        logoShape: m.company_logo_shape === 'rectangle' ? 'rectangle' : 'square',
        logoWidth: parseInt(m.company_logo_width, 10) || 140,
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
        rc: '', legalForm: '', capital: '', logoUrl: null, logoShape: 'square', logoWidth: 140,
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
  const isRect = c.logoShape === 'rectangle'
  const logoW = c.logoWidth + 'px'
  const logoH = isRect ? Math.round(c.logoWidth * 0.43) + 'px' : c.logoWidth + 'px'
  const logoBlock = c.logoUrl
    ? `<div style="flex-shrink:0;width:${logoW};height:${logoH};overflow:hidden;">
         <img src="${logoSrc}" alt="Logo" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;" onerror="this.style.display='none'">
       </div>`
    : ''

  return `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:12px;">
      ${logoBlock}
      <div style="flex:1;">
        ${c.name ? `<div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${esc(c.name)}</div>` : ''}
        ${c.legalForm ? `<div style="font-size:11px;color:#6b7280;">${esc(c.legalForm)}</div>` : ''}
        ${fullAddress ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${esc(fullAddress)}</div>` : ''}
        ${contactLine ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${contactLine}</div>` : ''}
        ${identLine1 ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${identLine1}</div>` : ''}
        ${identLine2 ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${identLine2}</div>` : ''}
      </div>
    </div>
    <div style="border-top:2px solid #1a1a1a;margin-bottom:16px;"></div>`
}

function buildFooterHtml(amountInWords?: string, footerLines?: string[]): string {
  let html = ''
  // Amount in words — stays in content flow (appears once at end of document)
  if (amountInWords) {
    html += `<div style="margin-top:20px;font-size:11px;font-style:italic;color:#374151;">${esc(amountInWords)}</div>`
  }
  // Print footer — fixed at bottom of EVERY printed A4 page
  if (footerLines && footerLines.length > 0) {
    html += `<div class="print-footer">`
    footerLines.forEach(line => {
      html += `<div>${esc(line)}</div>`
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
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #1a1a1a; font-size: 11px; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page-wrapper { padding: 15mm; min-height: 100vh; padding-bottom: 40mm; }
.print-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 8mm 15mm 10mm;
  border-top: 1px solid #d1d5db;
  background: #fff;
  text-align: center;
  font-size: 9px; color: #6b7280;
  line-height: 1.6;
}
.print-footer div { margin: 1px 0; }
@media screen {
  .print-footer { display: none; }
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

/* ── Document HTML builder (shared) ───────────────────────────────── */

export type PrintOptions = {
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
}

export async function buildDocumentHtml(options: PrintOptions): Promise<string> {
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
<body><div class="page-wrapper">${bodyHtml}</div></body>
</html>`

  return fullHtml
}

/* ── Direct PDF download (no print dialog) ────────────────────────── */

export async function downloadPdf(options: PrintOptions): Promise<void> {
  const fullHtml = await buildDocumentHtml(options)

  // Create a hidden container
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;z-index:-1;opacity:0;pointer-events:none;'
  document.body.appendChild(container)

  // Parse HTML and extract body content
  const parser = new DOMParser()
  const doc = parser.parseFromString(fullHtml, 'text/html')
  const pageWrapper = doc.querySelector('.page-wrapper')
  if (pageWrapper) {
    container.innerHTML = pageWrapper.innerHTML
  } else {
    container.innerHTML = fullHtml
  }

  // Inject print styles temporarily (with a marker for cleanup)
  const injectedStyle = document.createElement('style')
  injectedStyle.setAttribute('data-pdf-gen', 'true')
  injectedStyle.textContent = PRINT_CSS
  document.head.appendChild(injectedStyle)

  try {
    // Wait for images to load
    const images = container.querySelectorAll('img')
    if (images.length > 0) {
      await Promise.allSettled(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve()
          return new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
            setTimeout(resolve, 3000)
          })
        })
      )
    }

    const filename = `${options.title}_${options.docNumber || 'document'}.pdf`

    await html2pdf().set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
    }).from(container).save()
  } finally {
    document.body.removeChild(container)
    document.head.removeChild(injectedStyle)
  }
}

/* ── Main print function ──────────────────────────────────────────── */

export async function printDocument(options: PrintOptions) {
  const fullHtml = await buildDocumentHtml(options)

  // ── Full-screen preview dialog with zoom, scroll & pan ──
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;font-family:system-ui,sans-serif;'

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid #e5e7eb;flex-shrink:0;'
  toolbar.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:#374151;">Aperçu — ${esc(options.title)} ${esc(options.docNumber)}</span>
    <div style="flex:1"></div>
    <span id="print-pan-hint" style="font-size:11px;color:#9ca3af;display:inline;">🖱 Double-clic pour zoomer</span>
    <button id="print-zoom-out" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:16px;color:#374151;" title="Zoom −">−</button>
    <span id="print-zoom-level" style="font-size:12px;color:#6b7280;min-width:48px;text-align:center;">100%</span>
    <button id="print-zoom-in" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:16px;color:#374151;" title="Zoom +">+</button>
    <button id="print-zoom-fit" style="padding:0 10px;height:32px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;color:#374151;" title="Ajuster à l'écran">Ajuster</button>
    <div style="width:1px;height:20px;background:#e5e7eb;"></div>
    <button id="print-btn" style="display:flex;align-items:center;gap:6px;padding:0 14px;height:32px;border:none;border-radius:6px;background:#1a1a1a;color:#fff;cursor:pointer;font-size:13px;font-weight:500;">🖨 Imprimer</button>
    <button id="print-close" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:16px;color:#374151;" title="Fermer">✕</button>
  `

  // Scrollable container (overflow:auto enables native mouse wheel scroll)
  const container = document.createElement('div')
  container.style.cssText = 'flex:1;overflow:auto;background:#f3f4f6;'

  // Centering + spacing wrapper
  const centerWrap = document.createElement('div')
  centerWrap.style.cssText = 'display:flex;justify-content:center;align-items:flex-start;padding:20px;min-height:100%;min-width:100%;'

  // Scaled wrapper – its dimensions match the visually scaled page so scrollbars appear correctly
  const scaledWrap = document.createElement('div')
  scaledWrap.style.cssText = 'position:relative;flex-shrink:0;'

  // Actual A4 page – positioned absolutely so its layout size doesn't affect scaledWrap
  const page = document.createElement('div')
  page.style.cssText = 'position:absolute;top:0;left:0;width:210mm;min-height:297mm;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,0.15);transform-origin:top left;'

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;pointer-events:none;'
  page.appendChild(iframe)
  scaledWrap.appendChild(page)
  centerWrap.appendChild(scaledWrap)
  container.appendChild(centerWrap)

  overlay.appendChild(toolbar)
  overlay.appendChild(container)
  document.body.appendChild(overlay)
  document.body.style.overflow = 'hidden'

  // Write content into iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (iframeDoc) {
    iframeDoc.open()
    iframeDoc.write(fullHtml)
    iframeDoc.close()
  }

  // ── Zoom state ──
  let zoom = 1
  const zoomLevels = [0.25, 0.33, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1, 1.1, 1.25, 1.5, 2, 3]
  let zoomIdx = zoomLevels.indexOf(1)

  // A4 dimensions in px at 96dpi
  const A4_W = 794
  const A4_H = 1123
  let actualContentH = A4_H

  // Measure actual iframe content height after load
  const measureContent = () => {
    try {
      const doc = iframe.contentDocument
      if (doc?.documentElement) {
        actualContentH = Math.max(doc.documentElement.scrollHeight, A4_H)
      }
    } catch { /* cross-origin guard */ }
  }

  const updateLayout = () => {
    const sw = Math.round(A4_W * zoom)
    const sh = Math.round(actualContentH * zoom)
    scaledWrap.style.width = sw + 'px'
    scaledWrap.style.minHeight = sh + 'px'
    // Center only when content fits within the viewport
    const fits = sw + 40 <= container.clientWidth
    centerWrap.style.justifyContent = fits ? 'center' : 'flex-start'
  }

  const updatePanHint = () => {
    const hasOverflow = container.scrollHeight > container.clientHeight + 2 ||
                        container.scrollWidth > container.clientWidth + 2
    if (!isPanning) {
      container.style.cursor = hasOverflow ? 'grab' : 'default'
    }
  }

  const applyZoom = () => {
    zoom = zoomLevels[zoomIdx]
    page.style.transform = `scale(${zoom})`
    document.getElementById('print-zoom-level')!.textContent = Math.round(zoom * 100) + '%'
    updateLayout()
    requestAnimationFrame(updatePanHint)
  }

  const fitZoom = () => {
    const vw = container.clientWidth - 40
    const vh = container.clientHeight - 40
    const scaleW = vw / A4_W
    const scaleH = vh / A4_H
    const best = Math.min(scaleW, scaleH, 1)
    // Find closest zoom level
    zoomIdx = 0
    for (let i = 0; i < zoomLevels.length; i++) {
      if (zoomLevels[i] <= best) zoomIdx = i
    }
    applyZoom()
    container.scrollLeft = 0
    container.scrollTop = 0
  }

  // ── Drag-to-pan ──
  let isPanning = false
  let panStartX = 0, panStartY = 0
  let scrollStartX = 0, scrollStartY = 0

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return // only left button
    // Only enable pan when content overflows
    if (container.scrollHeight <= container.clientHeight + 2 &&
        container.scrollWidth <= container.clientWidth + 2) return
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    scrollStartX = container.scrollLeft
    scrollStartY = container.scrollTop
    container.style.cursor = 'grabbing'
    e.preventDefault()
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isPanning) return
    container.scrollLeft = scrollStartX - (e.clientX - panStartX)
    container.scrollTop = scrollStartY - (e.clientY - panStartY)
  }

  const onMouseUp = () => {
    if (isPanning) {
      isPanning = false
      updatePanHint()
    }
  }

  container.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  // ── Double-click to toggle zoom (fit ↔ 100%) ──
  let lastClickTime = 0
  const onDblClick = (e: MouseEvent) => {
    // If current zoom is close to 100%, fit to screen; otherwise go to 100%
    if (zoom >= 0.95 && zoom <= 1.05) {
      fitZoom()
    } else {
      zoomIdx = zoomLevels.indexOf(1)
      applyZoom()
      // Scroll to center
      container.scrollLeft = (scaledWrap.scrollWidth - container.clientWidth) / 2
      container.scrollTop = 0
    }
  }
  container.addEventListener('dblclick', onDblClick)

  // ── Cleanup helper ──
  const cleanup = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    container.removeEventListener('dblclick', onDblClick)
    document.removeEventListener('keydown', onKey)
    document.body.style.overflow = ''
  }

  // ── Button events ──
  document.getElementById('print-zoom-in')!.onclick = () => { if (zoomIdx < zoomLevels.length - 1) { zoomIdx++; applyZoom() } }
  document.getElementById('print-zoom-out')!.onclick = () => { if (zoomIdx > 0) { zoomIdx--; applyZoom() } }
  document.getElementById('print-zoom-fit')!.onclick = fitZoom

  document.getElementById('print-btn')!.onclick = () => {
    overlay.style.display = 'none'
    document.body.style.overflow = ''
    try {
      iframe.contentWindow?.print()
    } catch {
      const win = window.open('', '_blank')
      if (win) { win.document.write(fullHtml); win.document.close(); win.print() }
    }
    setTimeout(() => { cleanup(); try { document.body.removeChild(overlay) } catch {} }, 3000)
  }

  document.getElementById('print-close')!.onclick = () => {
    cleanup()
    document.body.removeChild(overlay)
  }

  // ── Keyboard shortcuts ──
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { cleanup(); document.body.removeChild(overlay) }
    if (e.key === '+' || e.key === '=') { if (zoomIdx < zoomLevels.length - 1) { zoomIdx++; applyZoom() } }
    if (e.key === '-') { if (zoomIdx > 0) { zoomIdx--; applyZoom() } }
  }
  document.addEventListener('keydown', onKey)

  // Measure content after iframe loads, then auto-fit
  setTimeout(() => {
    measureContent()
    updateLayout()
    fitZoom()
  }, 150)

  // Re-measure on resize
  const resizeObs = new ResizeObserver(() => {
    measureContent()
    updateLayout()
    updatePanHint()
  })
  resizeObs.observe(container)
}
