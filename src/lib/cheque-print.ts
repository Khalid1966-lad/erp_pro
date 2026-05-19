// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Cheque Print Engine
// ═══════════════════════════════════════════════════════════════

import type { ChequeTemplateField } from '@/components/erp/finance/cheque-template-editor'

// ─── Constants ───
const MM_TO_PX = 3.7795275591 // 1mm = 3.78px at 96 DPI
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

interface ChequePrintData {
  template: {
    id: string
    name: string
    bankName?: string | null
    chequeModel?: string | null
    chequeWidth: number
    chequeHeight: number
    scanOffsetX?: number | null
    scanOffsetY?: number | null
    backgroundImage?: string | null
    fields: ChequeTemplateField[]
  }
  fieldValues: Record<string, string>
}

/**
 * Build the HTML for printing a cheque on A4 paper
 * - Positions fields absolutely based on template coordinates
 * - Only text is printed (no background image)
 * - Centred on A4 page
 */
export function buildChequePrintHtml(data: ChequePrintData): string {
  const { template, fieldValues } = data
  const { chequeWidth, chequeHeight, scanOffsetX, scanOffsetY, fields } = template

  // Calculate margins to centre cheque on A4
  const marginLeft = (A4_WIDTH_MM - chequeWidth) / 2
  const marginTop = (A4_HEIGHT_MM - chequeHeight) / 2

  // Build field HTML
  const fieldsHtml = fields
    .map((field) => {
      const value = fieldValues[field.fieldKey] || ''
      if (!value) return ''

      // Adjust position relative to A4 page
      const posX = marginLeft + (scanOffsetX || 0) + field.x
      const posY = marginTop + (scanOffsetY || 0) + field.y

      return `<div style="
        position: absolute;
        left: ${posX}mm;
        top: ${posY}mm;
        width: ${field.width ? `${field.width}mm` : 'auto'};
        max-width: ${Math.min(field.width || chequeWidth - field.x, chequeWidth - field.x)}mm;
        height: ${field.height ? `${field.height}mm` : 'auto'};
        font-size: ${field.fontSize}pt;
        font-weight: ${field.fontWeight};
        text-align: ${field.textAlign};
        font-family: ${field.fontFamily};
        line-height: 1.3;
        overflow: hidden;
        word-wrap: break-word;
      ">${escapeHtml(value)}</div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Chèque - Impression</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${A4_WIDTH_MM}mm;
      height: ${A4_HEIGHT_MM}mm;
      position: relative;
      overflow: hidden;
    }
    @media print {
      body {
        width: ${A4_WIDTH_MM}mm;
        height: ${A4_HEIGHT_MM}mm;
      }
    }
  </style>
</head>
<body>
  ${fieldsHtml}
</body>
</html>`
}

/**
 * Build HTML with background image (for preview/testing only)
 */
export function buildChequePreviewHtml(data: ChequePrintData, showBackground: boolean): string {
  const { template, fieldValues } = data
  const { chequeWidth, chequeHeight, scanOffsetX, scanOffsetY, fields, backgroundImage } = template

  const marginLeft = (A4_WIDTH_MM - chequeWidth) / 2
  const marginTop = (A4_HEIGHT_MM - chequeHeight) / 2

  const fieldsHtml = fields
    .map((field) => {
      const value = fieldValues[field.fieldKey] || ''
      if (!value) return ''

      const posX = marginLeft + (scanOffsetX || 0) + field.x
      const posY = marginTop + (scanOffsetY || 0) + field.y

      return `<div style="
        position: absolute;
        left: ${posX}mm;
        top: ${posY}mm;
        width: ${field.width ? `${field.width}mm` : 'auto'};
        max-width: ${Math.min(field.width || chequeWidth - field.x, chequeWidth - field.x)}mm;
        height: ${field.height ? `${field.height}mm` : 'auto'};
        font-size: ${field.fontSize}pt;
        font-weight: ${field.fontWeight};
        text-align: ${field.textAlign};
        font-family: ${field.fontFamily};
        line-height: 1.3;
        overflow: hidden;
        word-wrap: break-word;
      ">${escapeHtml(value)}</div>`
    })
    .join('')

  const bgHtml = showBackground && backgroundImage
    ? `<img src="${backgroundImage}" style="
        position: absolute;
        left: ${marginLeft}mm;
        top: ${marginTop}mm;
        width: ${chequeWidth}mm;
        height: ${chequeHeight}mm;
        object-fit: contain;
        pointer-events: none;
        z-index: -1;
      " alt="" />`
    : ''

  // Cheque boundary for preview
  const borderHtml = `<div style="
    position: absolute;
    left: ${marginLeft}mm;
    top: ${marginTop}mm;
    width: ${chequeWidth}mm;
    height: ${chequeHeight}mm;
    border: 1px dashed #ccc;
    pointer-events: none;
    z-index: -1;
  "></div>`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Chèque - Aperçu</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${A4_WIDTH_MM}mm;
      height: ${A4_HEIGHT_MM}mm;
      position: relative;
      overflow: hidden;
    }
    @media print {
      .preview-only { display: none !important; }
    }
  </style>
</head>
<body>
  ${bgHtml}
  ${borderHtml}
  ${fieldsHtml}
</body>
</html>`
}

/**
 * Build test print HTML with alignment markers
 */
export function buildChequeTestHtml(data: ChequePrintData): string {
  const { template } = data
  const { chequeWidth, chequeHeight } = template

  const marginLeft = (A4_WIDTH_MM - chequeWidth) / 2
  const marginTop = (A4_HEIGHT_MM - chequeHeight) / 2

  // Main print content
  const printHtml = buildChequePrintHtml(data)

  // Test markers: corner crosses
  const markerSize = 5 // mm
  const markersHtml = [
    // Top-left
    { x: marginLeft, y: marginTop },
    // Top-right
    { x: marginLeft + chequeWidth, y: marginTop },
    // Bottom-left
    { x: marginLeft, y: marginTop + chequeHeight },
    // Bottom-right
    { x: marginLeft + chequeWidth, y: marginTop + chequeHeight },
  ]
    .map(
      (pos) => `
    <div style="
      position: absolute;
      left: ${pos.x}mm;
      top: ${pos.y}mm;
      width: ${markerSize}mm;
      height: ${markerSize}mm;
      pointer-events: none;
    ">
      <svg width="${markerSize * MM_TO_PX}" height="${markerSize * MM_TO_PX}" viewBox="0 0 ${markerSize * MM_TO_PX} ${markerSize * MM_TO_PX}">
        <line x1="0" y1="${markerSize * MM_TO_PX / 2}" x2="${markerSize * MM_TO_PX}" y2="${markerSize * MM_TO_PX / 2}" stroke="red" stroke-width="0.5" />
        <line x1="${markerSize * MM_TO_PX / 2}" y1="0" x2="${markerSize * MM_TO_PX / 2}" y2="${markerSize * MM_TO_PX}" stroke="red" stroke-width="0.5" />
      </svg>
    </div>`
    )
    .join('')

  // Cheque outline
  const outlineHtml = `<div style="
    position: absolute;
    left: ${marginLeft}mm;
    top: ${marginTop}mm;
    width: ${chequeWidth}mm;
    height: ${chequeHeight}mm;
    border: 0.5pt solid red;
    pointer-events: none;
  "></div>`

  // Insert markers and outline into the print HTML
  const bodyContent = markersHtml + outlineHtml

  return printHtml.replace('<body>', `<body>${bodyContent}`)
}

/**
 * Print a cheque: shows preview dialog with print/test options
 */
export async function printCheque(effetId: string): Promise<void> {
  try {
    const res = await fetch(`/api/effets-cheques/${effetId}/print-data`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Erreur lors du chargement des données')
    }

    const data = await res.json()

    if (!data.template) {
      throw new Error(
        'Aucun modèle de chèque configuré. Veuillez créer un modèle dans Paramètres > Modèles de Chèques.'
      )
    }

    // Show print dialog
    showChequePrintDialog(data)
  } catch (err: any) {
    const { toast } = await import('sonner')
    toast.error(err.message || 'Erreur lors de la préparation de l\'impression')
  }
}

/**
 * Show the cheque print preview dialog
 */
function showChequePrintDialog(data: any) {
  // Create modal overlay
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `

  const modal = document.createElement('div')
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
    max-width: 900px;
    width: 100%;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `

  // Header
  const header = document.createElement('div')
  header.style.cssText = 'padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between;'
  header.innerHTML = `
    <div>
      <div style="font-weight: 600; font-size: 16px;">🖨 Impression du chèque</div>
      <div style="font-size: 12px; color: #6b7280;">Modèle: ${escapeHtml(data.template.name)} | N°: ${escapeHtml(data.effet.numero)}</div>
    </div>
  `

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.style.cssText = 'padding: 12px 20px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;'
  toolbar.innerHTML = `
    <button id="cheque-print-btn" style="padding: 6px 16px; background: #1e40af; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
      🖨 Imprimer
    </button>
    <button id="cheque-test-btn" style="padding: 6px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
      📐 Imprimer test (repères)
    </button>
    <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; margin-left: auto;">
      <input type="checkbox" id="cheque-show-bg" />
      Afficher fond
    </label>
    <button id="cheque-close-btn" style="padding: 6px 12px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 13px;">
      ✕ Fermer
    </button>
  `

  // Preview iframe
  const previewContainer = document.createElement('div')
  previewContainer.style.cssText = 'flex: 1; overflow: hidden; padding: 16px; display: flex; justify-content: center; align-items: flex-start;'

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 4px; width: 100%; height: 100%; min-height: 500px;'
  previewContainer.appendChild(iframe)

  // Assemble modal
  modal.appendChild(header)
  modal.appendChild(toolbar)
  modal.appendChild(previewContainer)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)

  // Close on background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup()
  })

  function cleanup() {
    document.body.removeChild(overlay)
  }

  function renderPreview(showBackground: boolean) {
    const html = buildChequePreviewHtml(data, showBackground)
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }
  }

  // Initial render
  setTimeout(() => renderPreview(false), 100)

  // Event listeners
  document.getElementById('cheque-close-btn')?.addEventListener('click', cleanup)
  document.getElementById('cheque-show-bg')?.addEventListener('change', (e: any) => {
    renderPreview(e.target.checked)
  })

  document.getElementById('cheque-print-btn')?.addEventListener('click', () => {
    const printHtml = buildChequePrintHtml(data)
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(printHtml)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
        // Update print count
        fetch(`/api/effets-cheques/${data.effet.id}/print`, { method: 'POST' }).catch(() => {})
      }, 300)
    }
  })

  document.getElementById('cheque-test-btn')?.addEventListener('click', () => {
    const testHtml = buildChequeTestHtml(data)
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(testHtml)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 300)
    }
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
