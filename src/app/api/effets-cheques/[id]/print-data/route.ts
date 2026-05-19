import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { fmtMoney, fmtDate } from '@/lib/print-utils'
import { numberToFrenchWords } from '@/lib/number-to-words'

// GET - Get all data needed to print a cheque
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    const effet = await db.effetCheque.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            invoice: true,
            supplierInvoice: true,
            bankAccount: true,
            paymentLines: {
              include: {
                invoice: true,
                supplierInvoice: true,
              },
            },
          },
        },
        bankAccount: true,
        template: {
          include: {
            fields: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    if (!effet) {
      return NextResponse.json({ error: 'Effet non trouvé' }, { status: 404 })
    }

    // Get default template if none assigned
    let template = effet.template
    if (!template) {
      template = await db.chequeTemplate.findFirst({
        where: { isDefault: true },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      })
    }

    // Determine beneficiary (from payment context)
    let beneficiaire = effet.beneficiaire || ''
    let lieu = ''
    let motif = effet.notes || ''

    const payment = effet.payment
    if (!beneficiaire && payment) {
      if (payment.supplierInvoice) {
        const si = await db.supplierInvoice.findUnique({
          where: { id: payment.supplierInvoiceId || '' },
          include: { supplier: true },
        })
        if (si?.supplier) beneficiaire = si.supplier.name
      }
    }

    // Get company info for lieu
    try {
      const { getCompanyInfo } = await import('@/lib/print-utils')
      const info = await getCompanyInfo()
      lieu = info.city || 'Casablanca'
    } catch {
      lieu = 'Casablanca'
    }

    // Amount in words
    const montantLettres = numberToFrenchWords(effet.montant)

    // Build field values map
    const fieldValues: Record<string, string> = {
      montant_chiffres: fmtMoney(effet.montant),
      montant_lettres: montantLettres,
      beneficiaire: beneficiaire,
      lieu_date: `${lieu}, le ${fmtDate(effet.dateEmission)}`,
      date_emission: fmtDate(effet.dateEmission),
      date_echeance: effet.dateEcheance ? fmtDate(effet.dateEcheance) : '',
      numero_cheque: effet.numero,
      banque_emettrice: effet.banqueEmettrice || '',
      compte_emetteur: effet.bankAccount?.iban || '',
      bic: effet.bankAccount?.bic || '',
      libelle: motif,
      type_document: effet.type === 'cheque' ? 'CHÈQUE' : 'EFFET DE COMMERCE',
    }

    // If there are supplier invoices, add references
    if (payment?.paymentLines?.length) {
      const refs = payment.paymentLines
        .map((pl) => {
          if (pl.supplierInvoice) return `Fact. FRS ${pl.supplierInvoice.number}`
          if (pl.invoice) return `Fact. ${pl.invoice.number}`
          return ''
        })
        .filter(Boolean)
      if (refs.length) {
        fieldValues.libelle = fieldValues.libelle ? `${fieldValues.libelle} — ${refs.join(', ')}` : refs.join(', ')
      }
    }

    return NextResponse.json({
      effet: {
        id: effet.id,
        type: effet.type,
        numero: effet.numero,
        montant: effet.montant,
        beneficiaire: effet.beneficiaire,
        banqueEmettrice: effet.banqueEmettrice,
        dateEmission: effet.dateEmission,
        dateEcheance: effet.dateEcheance,
        notes: effet.notes,
      },
      template: template
        ? {
            id: template.id,
            name: template.name,
            bankName: template.bankName,
            chequeModel: template.chequeModel,
            chequeWidth: template.chequeWidth,
            chequeHeight: template.chequeHeight,
            scanOffsetX: template.scanOffsetX,
            scanOffsetY: template.scanOffsetY,
            backgroundImage: template.backgroundImage,
            fields: template.fields,
          }
        : null,
      fieldValues,
    })
  } catch (error) {
    console.error('Error fetching cheque print data:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
