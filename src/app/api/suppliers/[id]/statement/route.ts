import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 30

interface StatementTransaction {
  date: string
  type: 'invoice' | 'payment' | 'credit_note'
  reference: string
  label: string
  debit: number
  credit: number
  balance: number
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

    // ─── Fetch transactions IN the date range ───

    const [supplierInvoices, supplierCreditNotes, payments] = await Promise.all([
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

      // Payments to suppliers (supplier_payment type) → CREDIT
      // Note: Payment model doesn't have supplierId FK, so we fetch all supplier_payment
      db.payment.findMany({
        where: {
          type: 'supplier_payment',
          ...(Object.keys(rangeDateFilter).length > 0 ? { date: rangeDateFilter } : {}),
        },
        select: { date: true, reference: true, amount: true, notes: true },
        orderBy: { date: 'asc' },
      }),
    ])

    // ─── Calculate previous balance (all transactions BEFORE from date) ───
    let previousBalance = 0

    if (fromDate) {
      const [prevInvoices, prevCreditNotes, prevPayments] = await Promise.all([
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
        db.payment.aggregate({
          where: {
            type: 'supplier_payment',
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

    // ─── Sort: date ascending, then type priority (invoice=0, credit_note=1, payment=2) ───
    const typePriority: Record<string, number> = { invoice: 0, credit_note: 1, payment: 2 }

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

    return NextResponse.json({
      supplier,
      from: fromParam || null,
      to: toParam || null,
      previousBalance: Math.round(previousBalance * 100) / 100,
      transactions,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      finalBalance: Math.round(runningBalance * 100) / 100,
    })
  } catch (error) {
    console.error('Supplier statement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
