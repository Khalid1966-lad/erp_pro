import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'
import { syncSupplierBalance } from '@/lib/supplier-balance'

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
  unpaidInvoices: number
  uninvoicedReceptions: number
  periodPayments: number
  portfolioAmount: number
  unconsolidatedCreditNotes: number
  periodBalance: number
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

    if (fromParam && isNaN(fromDate!.getTime())) {
      return NextResponse.json({ error: 'Format de date "from" invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }
    if (toParam && isNaN(toDate!.getTime())) {
      return NextResponse.json({ error: 'Format de date "to" invalide (YYYY-MM-DD attendu)' }, { status: 400 })
    }

    const supplier = await db.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, siret: true, phone: true, email: true, address: true, city: true, postalCode: true },
    })
    if (!supplier) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

    // Auto-sync supplier balance from real transaction data
    syncSupplierBalance(id).catch((err) => {
      console.warn(`[SupplierStatement] Background balance sync failed for supplier ${id}:`, err)
    })

    // Build date filters
    const rangeDateFilter: Record<string, unknown> = {}
    if (fromDate) rangeDateFilter.gte = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    if (toDate) rangeDateFilter.lte = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)

    const previousDateFilter: Record<string, unknown> = {}
    if (fromDate) previousDateFilter.lt = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())

    // ─── Fetch transactions IN the date range ───
    const [supplierInvoices, supplierCreditNotes, paymentLineGroups, allRejetEffets] = await Promise.all([
      // Supplier Invoices (not cancelled) → DEBIT
      db.supplierInvoice.findMany({
        where: { supplierId: id, status: { not: 'cancelled' }, ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}) },
        select: { date: true, number: true, totalTTC: true },
      }),

      // Supplier Credit Notes (not cancelled) → CREDIT
      db.supplierCreditNote.findMany({
        where: { supplierId: id, status: { not: 'cancelled' }, ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}) },
        select: { date: true, number: true, totalTTC: true },
      }),

      // Payments linked to this supplier's invoices via PaymentLines → CREDIT
      db.paymentLine.groupBy({
        by: ['paymentId'],
        where: { supplierInvoice: { supplierId: id } },
        _sum: { amount: true },
      }),

      // Rejet effets/cheques for this supplier's payments
      db.effetCheque.findMany({
        where: {
          statut: 'rejete',
          dateRejet: Object.keys(rangeDateFilter).length > 0 ? rangeDateFilter : undefined,
          payment: {
            paymentLines: { some: { supplierInvoice: { supplierId: id } } },
          },
        },
        select: { dateRejet: true, type: true, numero: true, montant: true, causeRejet: true },
      }),
    ])

    // Fetch full payment details for the matched payment IDs
    const paymentIds = paymentLineGroups.map((g) => g.paymentId)
    let payments: Array<{ id: string; date: Date; reference: string | null; amount: number; notes: string | null }> = []
    if (paymentIds.length > 0) {
      const dateWhere: Record<string, unknown> = {
        id: { in: paymentIds },
        type: 'supplier_payment',
      }
      if (Object.keys(rangeDateFilter).length > 0) dateWhere.date = rangeDateFilter

      payments = await db.payment.findMany({
        where: dateWhere,
        select: { id: true, date: true, reference: true, amount: true, notes: true },
        orderBy: { date: 'asc' },
      })
    }

    const rejetEffets = allRejetEffets

    // ─── Calculate previous balance ───
    let previousBalance = 0

    if (fromDate) {
      const [prevInvoices, prevCreditNotes, prevPaymentLineGroups] = await Promise.all([
        db.supplierInvoice.aggregate({
          where: { supplierId: id, status: { not: 'cancelled' }, date: previousDateFilter },
          _sum: { totalTTC: true },
        }),
        db.supplierCreditNote.aggregate({
          where: { supplierId: id, status: { not: 'cancelled' }, date: previousDateFilter },
          _sum: { totalTTC: true },
        }),
        db.paymentLine.groupBy({
          by: ['paymentId'],
          where: { supplierInvoice: { supplierId: id } },
          _sum: { amount: true },
        }),
      ])

      let prevPaymentsTotal = 0
      if (prevPaymentLineGroups.length > 0) {
        const prevPaymentIds = prevPaymentLineGroups.map((g) => g.paymentId)
        const prevPaymentSums = await db.payment.aggregate({
          where: { id: { in: prevPaymentIds }, type: 'supplier_payment', date: previousDateFilter },
          _sum: { amount: true },
        })
        prevPaymentsTotal = prevPaymentSums._sum.amount || 0
      }

      previousBalance =
        (prevInvoices._sum.totalTTC || 0) -
        (prevCreditNotes._sum.totalTTC || 0) -
        prevPaymentsTotal
    }

    // ─── Build transaction list ───
    const transactions: StatementTransaction[] = []

    for (const inv of supplierInvoices) {
      transactions.push({
        date: inv.date.toISOString(), type: 'invoice', reference: inv.number,
        label: `Facture ${inv.number}`, debit: inv.totalTTC, credit: 0, balance: 0,
      })
    }

    for (const cn of supplierCreditNotes) {
      transactions.push({
        date: cn.date.toISOString(), type: 'credit_note', reference: cn.number,
        label: `Avoir ${cn.number}`, debit: 0, credit: cn.totalTTC, balance: 0,
      })
    }

    for (const pay of payments) {
      transactions.push({
        date: pay.date.toISOString(), type: 'payment', reference: pay.reference || '',
        label: pay.reference
          ? `Paiement ${pay.reference}${pay.notes ? ` — ${pay.notes}` : ''}`
          : `Paiement${pay.notes ? ` — ${pay.notes}` : ''}`,
        debit: 0, credit: pay.amount, balance: 0,
      })
    }

    for (const rej of rejetEffets) {
      const typeLabel = rej.type === 'cheque' ? 'chèque' : 'effet'
      transactions.push({
        date: rej.dateRejet!.toISOString(), type: 'rejet_effet', reference: rej.numero,
        label: `Rejet ${typeLabel} n°${rej.numero}${rej.causeRejet ? ` - ${rej.causeRejet}` : ''}`,
        debit: 0, credit: rej.montant, balance: 0,
      })
    }

    // Sort + compute running balance
    const typePriority: Record<string, number> = { invoice: 0, credit_note: 1, payment: 2, rejet_effet: 3 }
    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      if (dateA !== dateB) return dateA - dateB
      return typePriority[a.type] - typePriority[b.type]
    })

    let runningBalance = previousBalance
    let totalDebit = 0
    let totalCredit = 0
    for (const tx of transactions) {
      runningBalance += tx.debit - tx.credit
      tx.balance = Math.round(runningBalance * 100) / 100
      totalDebit += tx.debit
      totalCredit += tx.credit
    }

    // ─── Récapitulatif financier ───
    const [
      unpaidInvoicesAgg,
      uninvoicedReceptionsData,
      unconsolidatedCreditNotesAgg,
      allPortfolioEffets,
    ] = await Promise.all([
      db.supplierInvoice.aggregate({
        where: { supplierId: id, status: { notIn: ['paid', 'cancelled'] } },
        _sum: { totalTTC: true },
      }),
      db.purchaseOrder.findMany({
        where: { supplierId: id, receptions: { some: {} }, supplierInvoices: { none: {} } },
        select: { totalTTC: true },
      }),
      db.supplierCreditNote.aggregate({
        where: { supplierId: id, status: 'received' },
        _sum: { totalTTC: true },
      }),
      db.effetCheque.findMany({
        where: {
          statut: 'en_attente',
          payment: {
            paymentLines: { some: { supplierInvoice: { supplierId: id } } },
          },
        },
        select: { montant: true },
      }),
    ])

    const unpaidInvoices = Math.round((unpaidInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const uninvoicedReceptionsTotal = Math.round(uninvoicedReceptionsData.reduce((s, po) => s + po.totalTTC, 0) * 100) / 100
    const periodPayments = Math.round(totalCredit * 100) / 100
    const portfolioAmount = Math.round(allPortfolioEffets.reduce((s, e) => s + e.montant, 0) * 100) / 100
    const unconsolidatedCreditNotes = Math.round((unconsolidatedCreditNotesAgg._sum.totalTTC || 0) * 100) / 100
    const periodBalance = Math.round(runningBalance * 100) / 100

    const summary: StatementSummary = {
      unpaidInvoices, uninvoicedReceptions: uninvoicedReceptionsTotal,
      periodPayments, portfolioAmount, unconsolidatedCreditNotes, periodBalance,
    }

    return NextResponse.json({
      supplier, from: fromParam || null, to: toParam || null,
      previousBalance: Math.round(previousBalance * 100) / 100,
      transactions, totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      finalBalance: periodBalance, summary,
    })
  } catch (error) {
    console.error('Supplier statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
