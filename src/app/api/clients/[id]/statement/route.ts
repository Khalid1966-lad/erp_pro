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
  /** Montant des factures impayées (non cancelées et non payées) */
  unpaidInvoices: number
  /** Montant des livraisons non encore facturées */
  uninvoicedDeliveries: number
  /** Montant des règlements de la période */
  periodPayments: number
  /** Montant des chèques/effets non remis à la banque (en_attente) */
  portfolioAmount: number
  /** Montant des avoirs non consolidés (validés mais non appliqués) */
  unconsolidatedCreditNotes: number
  /** Solde de la période (créditeur ou débiteur) */
  periodBalance: number
}

// GET /api/clients/[id]/statement?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:read') && !hasPermission(auth, 'clients:read')) {
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

    // Fetch client
    const client = await db.client.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        name: true,
        ice: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        postalCode: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Build date filters for Prisma queries
    const rangeDateFilter: Record<string, unknown> = {}
    if (fromDate) {
      rangeDateFilter.gte = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    }
    if (toDate) {
      // Include the entire "to" day (up to 23:59:59.999)
      rangeDateFilter.lte = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
    }

    const previousDateFilter: Record<string, unknown> = {}
    if (fromDate) {
      // Everything strictly before the "from" date
      previousDateFilter.lt = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    }

    // ─── Fetch transactions IN the date range ───

    const [invoices, creditNotes, payments, rejetEffets] = await Promise.all([
      // Invoices (not cancelled) → DEBIT
      db.invoice.findMany({
        where: {
          clientId: id,
          status: { not: 'cancelled' },
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, number: true, totalTTC: true },
      }),

      // Credit notes (not cancelled) → CREDIT
      db.creditNote.findMany({
        where: {
          clientId: id,
          status: { not: 'cancelled' },
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, number: true, totalTTC: true },
      }),

      // Payments (client_payment) linked to this client's invoices → CREDIT
      db.payment.findMany({
        where: {
          type: 'client_payment',
          invoiceId: { not: null },
          invoice: {
            clientId: id,
          },
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, reference: true, amount: true, invoice: { select: { number: true } } },
      }),

      // Rejet effets/cheques → DEBIT (reversal of payment)
      db.effetCheque.findMany({
        where: {
          statut: 'rejete',
          dateRejet: Object.keys(rangeDateFilter).length > 0 ? rangeDateFilter : undefined,
          payment: {
            type: 'client_payment',
            invoice: {
              clientId: id,
            },
          },
        },
        select: {
          dateRejet: true,
          type: true,
          numero: true,
          montant: true,
          causeRejet: true,
        },
      }),
    ])

    // ─── Calculate previous balance (all transactions BEFORE from date) ───
    let previousBalance = 0

    if (fromDate) {
      const [prevInvoices, prevCreditNotes, prevPayments] = await Promise.all([
        db.invoice.aggregate({
          where: {
            clientId: id,
            status: { not: 'cancelled' },
            date: previousDateFilter,
          },
          _sum: { totalTTC: true },
        }),
        db.creditNote.aggregate({
          where: {
            clientId: id,
            status: { not: 'cancelled' },
            date: previousDateFilter,
          },
          _sum: { totalTTC: true },
        }),
        db.payment.aggregate({
          where: {
            type: 'client_payment',
            invoiceId: { not: null },
            invoice: { clientId: id },
            date: previousDateFilter,
          },
          _sum: { amount: true },
        }),
      ])

      previousBalance =
        (prevInvoices._sum.totalTTC || 0) -
        (prevCreditNotes._sum.totalTTC || 0) -
        (prevPayments._sum.amount || 0)
    }

    // ─── Build transaction list ───
    const transactions: StatementTransaction[] = []

    for (const inv of invoices) {
      transactions.push({
        date: inv.date.toISOString(),
        type: 'invoice',
        reference: inv.number,
        label: `Facture ${inv.number}`,
        debit: inv.totalTTC,
        credit: 0,
        balance: 0, // computed below
      })
    }

    for (const cn of creditNotes) {
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
        label: pay.invoice
          ? `Paiement ${pay.reference ? `${pay.reference} - ` : ''}Facture ${pay.invoice.number}`
          : `Paiement ${pay.reference || ''}`,
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
        debit: rej.montant,
        credit: 0,
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
    // SUMMARY TABLE — Récapitulatif financier
    // ═══════════════════════════════════════════════════════════════

    const [
      // Factures impayées : non cancelées et non payées
      unpaidInvoicesAgg,
      // Livraisons non facturées : BL livrés qui n'ont PAS de liaison InvoiceDeliveryNote
      uninvoicedDeliveries,
      // Avoirs non consolidés : status validated (ni applied ni cancelled)
      unconsolidatedCreditNotesAgg,
      // Effets/Chèques en portefeuille (en_attente) pour ce client
      portfolioAgg,
    ] = await Promise.all([
      // 1) Unpaid invoices (validated/sent/overdue/draft — not paid, not cancelled)
      db.invoice.aggregate({
        where: {
          clientId: id,
          status: { notIn: ['paid', 'cancelled'] },
        },
        _sum: { totalTTC: true },
      }),

      // 2) Delivered delivery notes that are NOT linked to any invoice
      //    We find delivery notes for this client that have no InvoiceDeliveryNote records
      db.deliveryNote.findMany({
        where: {
          clientId: id,
          status: { notIn: ['cancelled', 'draft'] },
          invoices: { none: {} },
        },
        select: { totalTTC: true },
      }),

      // 3) Unconsolidated credit notes (validated but not applied/cancelled)
      db.creditNote.aggregate({
        where: {
          clientId: id,
          status: 'validated',
        },
        _sum: { totalTTC: true },
      }),

      // 4) Portfolio: chèques/effets en_attente linked to this client's payments
      db.effetCheque.aggregate({
        where: {
          statut: 'en_attente',
          payment: {
            type: 'client_payment',
            invoice: {
              clientId: id,
            },
          },
        },
        _sum: { montant: true },
      }),
    ])

    const unpaidInvoices = Math.round((unpaidInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const uninvoicedDeliveriesTotal = Math.round(
      uninvoicedDeliveries.reduce((sum, dn) => sum + dn.totalTTC, 0) * 100
    ) / 100
    const periodPayments = Math.round(totalCredit * 100) / 100
    const portfolioAmount = Math.round((portfolioAgg._sum.montant || 0) * 100) / 100
    const unconsolidatedCreditNotes = Math.round((unconsolidatedCreditNotesAgg._sum.totalTTC || 0) * 100) / 100
    const periodBalance = Math.round(runningBalance * 100) / 100

    const summary: StatementSummary = {
      unpaidInvoices,
      uninvoicedDeliveries: uninvoicedDeliveriesTotal,
      periodPayments,
      portfolioAmount,
      unconsolidatedCreditNotes,
      periodBalance,
    }

    return NextResponse.json({
      client,
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
    console.error('Client statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
