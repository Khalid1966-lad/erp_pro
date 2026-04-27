import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 30

interface StatementTransaction {
  date: string
  type: 'invoice' | 'payment' | 'credit_note' | 'rejet_effet'
  reference: string
  label: string
  debit: number
  credit: number
  balance: number
}

interface StatementSummary {
  /** Montant des factures fournisseurs impayées (non cancelées et non payées) */
  unpaidInvoices: number
  /** Montant des réceptions non encore facturées */
  uninvoicedReceptions: number
  /** Montant des règlements de la période */
  periodPayments: number
  /** Montant des chèques/effets non remis à la banque (en_attente) */
  portfolioAmount: number
  /** Montant des avoirs non consolidés (reçus mais non appliqués) */
  unconsolidatedCreditNotes: number
  /** Solde de la période (créditeur ou débiteur) */
  periodBalance: number
}

/**
 * Helper: fetch all supplier invoice numbers for a given supplier.
 * Used to filter Payment records (which lack a direct supplierId FK).
 */
async function getSupplierInvoiceNumbers(supplierId: string): Promise<string[]> {
  const invoices = await db.supplierInvoice.findMany({
    where: { supplierId },
    select: { number: true },
  })
  return invoices.map((inv) => inv.number)
}

/**
 * Helper: filter an array of payments by checking if reference or notes
 * contains any of the given supplier invoice numbers.
 */
function filterPaymentsBySupplier(
  payments: { id: string; reference: string | null; notes: string | null; date: Date; amount: number }[],
  invoiceNumbers: string[]
): typeof payments {
  if (invoiceNumbers.length === 0) return []
  return payments.filter((pay) => {
    const ref = (pay.reference || '').toUpperCase()
    const note = (pay.notes || '').toUpperCase()
    return invoiceNumbers.some((num) => ref.includes(num.toUpperCase()) || note.includes(num.toUpperCase()))
  })
}

// GET /api/suppliers/[id]/statement?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier:read') && !hasPermission(auth, 'suppliers:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const fromDate = fromParam ? new Date(fromParam) : null
    const toDate = toParam ? new Date(toParam) : null

    // Validate date formats
    if (fromParam && isNaN(fromDate!.getTime())) {
      return NextResponse.json(
        { error: 'Format de date "from" invalide (YYYY-MM-DD attendu)' },
        { status: 400 }
      )
    }
    if (toParam && isNaN(toDate!.getTime())) {
      return NextResponse.json(
        { error: 'Format de date "to" invalide (YYYY-MM-DD attendu)' },
        { status: 400 }
      )
    }

    // Fetch supplier
    const supplier = await db.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        siret: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        postalCode: true,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    // Build date filters for Prisma queries
    const rangeDateFilter: Record<string, unknown> = {}
    if (fromDate) {
      rangeDateFilter.gte = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    }
    if (toDate) {
      rangeDateFilter.lte = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
    }

    const previousDateFilter: Record<string, unknown> = {}
    if (fromDate) {
      previousDateFilter.lt = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    }

    // Get all supplier invoice numbers for payment filtering
    const supplierInvoiceNumbers = await getSupplierInvoiceNumbers(id)

    // ─── Fetch transactions IN the date range ───

    const [supplierInvoices, supplierCreditNotes, allPayments, allRejetEffets] = await Promise.all([
      // Supplier Invoices (not cancelled) → DEBIT (what we owe)
      db.supplierInvoice.findMany({
        where: {
          supplierId: id,
          status: { not: 'cancelled' },
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, number: true, totalTTC: true },
      }),

      // Supplier Credit Notes (not cancelled) → CREDIT (reduces what we owe)
      db.supplierCreditNote.findMany({
        where: {
          supplierId: id,
          status: { not: 'cancelled' },
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, number: true, totalTTC: true },
      }),

      // All supplier_payment payments in the date range (will be filtered by supplier)
      db.payment.findMany({
        where: {
          type: 'supplier_payment',
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { id: true, date: true, reference: true, amount: true, notes: true },
        orderBy: { date: 'asc' },
      }),

      // All rejet effets/cheques for supplier payments (will be filtered)
      db.effetCheque.findMany({
        where: {
          statut: 'rejete',
          dateRejet: Object.keys(rangeDateFilter).length > 0 ? rangeDateFilter : undefined,
          payment: {
            type: 'supplier_payment',
          },
        },
        select: {
          id: true,
          paymentId: true,
          dateRejet: true,
          type: true,
          numero: true,
          montant: true,
          causeRejet: true,
          payment: {
            select: { reference: true, notes: true },
          },
        },
      }),
    ])

    // Filter payments to only include those linked to this supplier
    const payments = filterPaymentsBySupplier(allPayments, supplierInvoiceNumbers)

    // Filter rejetEffets to only include those linked to this supplier's payments
    const rejetEffets = allRejetEffets.filter((rej) => {
      const ref = (rej.payment?.reference || '').toUpperCase()
      const note = (rej.payment?.notes || '').toUpperCase()
      return supplierInvoiceNumbers.some(
        (num) => ref.includes(num.toUpperCase()) || note.includes(num.toUpperCase())
      )
    })

    // ─── Calculate previous balance (all transactions BEFORE from date) ───
    let previousBalance = 0

    if (fromDate) {
      const [prevInvoices, prevCreditNotes, allPrevPayments] = await Promise.all([
        db.supplierInvoice.aggregate({
          where: {
            supplierId: id,
            status: { not: 'cancelled' },
            date: previousDateFilter,
          },
          _sum: { totalTTC: true },
        }),
        db.supplierCreditNote.aggregate({
          where: {
            supplierId: id,
            status: { not: 'cancelled' },
            date: previousDateFilter,
          },
          _sum: { totalTTC: true },
        }),
        db.payment.findMany({
          where: {
            type: 'supplier_payment',
            date: previousDateFilter,
          },
          select: { id: true, reference: true, notes: true, amount: true },
        }),
      ])

      const prevPayments = filterPaymentsBySupplier(allPrevPayments, supplierInvoiceNumbers)
      const prevPaymentsTotal = prevPayments.reduce((sum, p) => sum + p.amount, 0)

      previousBalance =
        (prevInvoices._sum.totalTTC || 0) -
        (prevCreditNotes._sum.totalTTC || 0) -
        prevPaymentsTotal
    }

    // ─── Build transaction list ───
    const transactions: StatementTransaction[] = []

    for (const inv of supplierInvoices) {
      transactions.push({
        date: inv.date.toISOString(),
        type: 'invoice',
        reference: inv.number,
        label: `Facture ${inv.number}`,
        debit: inv.totalTTC,
        credit: 0,
        balance: 0,
      })
    }

    for (const cn of supplierCreditNotes) {
      transactions.push({
        date: cn.date.toISOString(),
        type: 'credit_note',
        reference: cn.number,
        label: `Avoir ${cn.number}`,
        debit: 0,
        credit: cn.totalTTC,
        balance: 0,
      })
    }

    for (const pay of payments) {
      transactions.push({
        date: pay.date.toISOString(),
        type: 'payment',
        reference: pay.reference || '',
        label: pay.reference
          ? `Paiement ${pay.reference}${pay.notes ? ` — ${pay.notes}` : ''}`
          : `Paiement${pay.notes ? ` — ${pay.notes}` : ''}`,
        debit: 0,
        credit: pay.amount,
        balance: 0,
      })
    }

    for (const rej of rejetEffets) {
      const typeLabel = rej.type === 'cheque' ? 'chèque' : 'effet'
      transactions.push({
        date: rej.dateRejet!.toISOString(),
        type: 'rejet_effet',
        reference: rej.numero,
        label: `Rejet ${typeLabel} n°${rej.numero}${rej.causeRejet ? ` - ${rej.causeRejet}` : ''}`,
        debit: 0,
        credit: rej.montant,
        balance: 0,
      })
    }

    // ─── Sort: date ascending, then type priority (invoice=0, credit_note=1, payment=2, rejet_effet=3) ───
    const typePriority: Record<string, number> = { invoice: 0, credit_note: 1, payment: 2, rejet_effet: 3 }

    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      if (dateA !== dateB) return dateA - dateB
      return typePriority[a.type] - typePriority[b.type]
    })

    // ─── Compute running balance ───
    let runningBalance = previousBalance
    let totalDebit = 0
    let totalCredit = 0

    for (const tx of transactions) {
      runningBalance += tx.debit - tx.credit
      tx.balance = Math.round(runningBalance * 100) / 100
      totalDebit += tx.debit
      totalCredit += tx.credit
    }

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY TABLE — Récapitulatif financier (fournisseur)
    // ═══════════════════════════════════════════════════════════════

    const [
      // Factures impayées : non cancelées et non payées
      unpaidInvoicesAgg,
      // Réceptions non facturées : commandes d'achat réceptionnées sans facture liée
      uninvoicedReceptionsData,
      // Avoirs non consolidés : status received (ni applied ni cancelled)
      unconsolidatedCreditNotesAgg,
      // Effets/Chèques en portefeuille (en_attente) pour ce fournisseur
      allPortfolioEffets,
    ] = await Promise.all([
      // 1) Unpaid supplier invoices (not paid, not cancelled)
      db.supplierInvoice.aggregate({
        where: {
          supplierId: id,
          status: { notIn: ['paid', 'cancelled'] },
        },
        _sum: { totalTTC: true },
      }),

      // 2) Purchase orders for this supplier that have receptions but NO supplier invoices linked
      db.purchaseOrder.findMany({
        where: {
          supplierId: id,
          receptions: { some: {} },
          supplierInvoices: { none: {} },
        },
        select: { totalTTC: true },
      }),

      // 3) Unconsolidated credit notes (received but not applied/cancelled)
      db.supplierCreditNote.aggregate({
        where: {
          supplierId: id,
          status: 'received',
        },
        _sum: { totalTTC: true },
      }),

      // 4) Portfolio: chèques/effets en_attente linked to this supplier's payments
      db.effetCheque.findMany({
        where: {
          statut: 'en_attente',
          payment: {
            type: 'supplier_payment',
          },
        },
        select: {
          montant: true,
          payment: {
            select: { reference: true, notes: true },
          },
        },
      }),
    ])

    // Filter portfolio effets by supplier
    const portfolioEffets = allPortfolioEffets.filter((effet) => {
      const ref = (effet.payment?.reference || '').toUpperCase()
      const note = (effet.payment?.notes || '').toUpperCase()
      return supplierInvoiceNumbers.some(
        (num) => ref.includes(num.toUpperCase()) || note.includes(num.toUpperCase())
      )
    })

    const unpaidInvoices = Math.round((unpaidInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const uninvoicedReceptionsTotal = Math.round(
      uninvoicedReceptionsData.reduce((sum, po) => sum + po.totalTTC, 0) * 100
    ) / 100
    const periodPayments = Math.round(totalCredit * 100) / 100
    const portfolioAmount = Math.round(
      portfolioEffets.reduce((sum, e) => sum + e.montant, 0) * 100
    ) / 100
    const unconsolidatedCreditNotes = Math.round((unconsolidatedCreditNotesAgg._sum.totalTTC || 0) * 100) / 100
    const periodBalance = Math.round(runningBalance * 100) / 100

    const summary: StatementSummary = {
      unpaidInvoices,
      uninvoicedReceptions: uninvoicedReceptionsTotal,
      periodPayments,
      portfolioAmount,
      unconsolidatedCreditNotes,
      periodBalance,
    }

    return NextResponse.json({
      supplier,
      from: fromParam || null,
      to: toParam || null,
      previousBalance: Math.round(previousBalance * 100) / 100,
      transactions,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      finalBalance: periodBalance,
      summary,
    })
  } catch (error) {
    console.error('Supplier statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
