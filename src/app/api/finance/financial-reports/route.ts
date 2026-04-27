import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 60

interface ClientBreakdown {
  clientId: string
  clientName: string
  clientICE: string
  totalInvoicesTTC: number
  totalPaid: number
  totalUnpaid: number
  totalUninvoicedDeliveries: number
  balance: number
  unpaidInvoiceCount: number
  portfolioAmount: number
}

interface UninvoicedBL {
  id: string
  number: string
  date: string
  clientName: string
  clientId: string
  salesOrderNumber: string | null
  totalTTC: number
}

// GET /api/finance/financial-reports?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (
    !hasPermission(auth, 'payments:read') &&
    !hasPermission(auth, 'invoices:read') &&
    !hasPermission(auth, 'accounting:read')
  ) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
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

    // Build date filters
    const rangeDateFilter: Record<string, unknown> = {}
    if (fromDate) {
      rangeDateFilter.gte = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
    }
    if (toDate) {
      rangeDateFilter.lte = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
    }

    const hasDateFilter = Object.keys(rangeDateFilter).length > 0

    // ═══════════════════════════════════════════════════════════════
    // 1. GLOBAL SUMMARY
    // ═══════════════════════════════════════════════════════════════

    const [
      // All non-cancelled invoices (total emitted)
      totalInvoicesAgg,
      // Paid invoices (status = paid)
      paidInvoicesAgg,
      // Unpaid invoices (not paid, not cancelled)
      unpaidInvoicesAgg,
      // Client payments (encaissements)
      encaissementsAgg,
      // Supplier payments + cash_out (decaissements)
      decaissementsAgg,
      // Chèques/effets en_attente
      portfolioAgg,
    ] = await Promise.all([
      // Total invoices TTC (not cancelled, optionally filtered by period)
      db.invoice.aggregate({
        where: {
          status: { not: 'cancelled' },
          ...(hasDateFilter ? { date: rangeDateFilter } : {}),
        },
        _sum: { totalTTC: true },
      }),

      // Total paid invoices TTC
      db.invoice.aggregate({
        where: {
          status: 'paid',
          ...(hasDateFilter ? { paymentDate: rangeDateFilter } : {}),
        },
        _sum: { totalTTC: true },
      }),

      // Total unpaid invoices TTC (not paid, not cancelled)
      db.invoice.aggregate({
        where: {
          status: { notIn: ['paid', 'cancelled'] },
        },
        _sum: { totalTTC: true, amountPaid: true },
      }),

      // Total encaissements (client payments)
      db.payment.aggregate({
        where: {
          type: 'client_payment',
          ...(hasDateFilter ? { date: rangeDateFilter } : {}),
        },
        _sum: { amount: true },
      }),

      // Total decaissements (supplier payments + cash_out)
      db.payment.aggregate({
        where: {
          type: { in: ['supplier_payment', 'cash_out'] },
          ...(hasDateFilter ? { date: rangeDateFilter } : {}),
        },
        _sum: { amount: true },
      }),

      // Portfolio: chèques/effets en_attente
      db.effetCheque.aggregate({
        where: {
          statut: 'en_attente',
        },
        _sum: { montant: true },
      }),
    ])

    // Uninvoiced deliveries: delivered BLs with no invoice link
    const uninvoicedBLs = await db.deliveryNote.findMany({
      where: {
        status: { notIn: ['cancelled', 'draft'] },
        invoices: { none: {} },
      },
      include: {
        client: { select: { id: true, name: true, ice: true } },
        salesOrder: { select: { number: true } },
      },
      orderBy: { date: 'desc' },
    })

    const totalUninvoicedDeliveries = Math.round(
      uninvoicedBLs.reduce((sum, bl) => sum + bl.totalTTC, 0) * 100
    ) / 100

    // Calculate net balance
    const totalInvoicesTTC = Math.round((totalInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const totalPaid = Math.round((paidInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const totalUnpaid = Math.round((unpaidInvoicesAgg._sum.totalTTC || 0) * 100) / 100
    const totalEncaissements = Math.round((encaissementsAgg._sum.amount || 0) * 100) / 100
    const totalDecaissements = Math.round((decaissementsAgg._sum.amount || 0) * 100) / 100
    const totalPortfolio = Math.round((portfolioAgg._sum.montant || 0) * 100) / 100
    const netBalance = totalEncaissements - totalDecaissements

    // ═══════════════════════════════════════════════════════════════
    // 2. PER-CLIENT BREAKDOWN
    // ═══════════════════════════════════════════════════════════════

    // Get all clients that have non-cancelled invoices
    const clientsWithInvoices = await db.invoice.groupBy({
      by: ['clientId'],
      where: { status: { not: 'cancelled' } },
      _sum: { totalTTC: true, amountPaid: true },
      _count: true,
    })

    // Get unpaid invoices per client (status not in paid, cancelled)
    const unpaidPerClient = await db.invoice.groupBy({
      by: ['clientId'],
      where: { status: { notIn: ['paid', 'cancelled'] } },
      _sum: { totalTTC: true },
      _count: true,
    })

    // Get uninvoiced deliveries per client
    const uninvoicedBLIds = uninvoicedBLs.map(bl => bl.id)

    // Group uninvoiced BLs by client
    const uninvoicedByClient = new Map<string, number>()
    for (const bl of uninvoicedBLs) {
      uninvoicedByClient.set(
        bl.clientId,
        Math.round(((uninvoicedByClient.get(bl.clientId) || 0) + bl.totalTTC) * 100) / 100
      )
    }

    // Get portfolio (en_attente effets) per client
    const portfolioByClient = await db.effetCheque.findMany({
      where: {
        statut: 'en_attente',
        payment: {
          type: 'client_payment',
          invoiceId: { not: null },
        },
      },
      include: {
        payment: {
          include: {
            invoice: {
              select: { clientId: true },
            },
          },
        },
      },
    })

    const portfolioMap = new Map<string, number>()
    for (const ec of portfolioByClient) {
      const clientId = ec.payment.invoice?.clientId
      if (clientId) {
        portfolioMap.set(
          clientId,
          Math.round(((portfolioMap.get(clientId) || 0) + ec.montant) * 100) / 100
        )
      }
    }

    // Get all clients with their info
    const clientIds = [
      ...new Set([
        ...clientsWithInvoices.map(c => c.clientId),
        ...unpaidPerClient.map(c => c.clientId),
        ...uninvoicedByClient.keys(),
        ...portfolioMap.keys(),
      ]),
    ]

    const clients = await db.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, ice: true },
    })

    const clientMap = new Map(clients.map(c => [c.id, c]))

    // Build per-client breakdown
    const clientBreakdown: ClientBreakdown[] = []

    for (const clientId of clientIds) {
      const client = clientMap.get(clientId)
      if (!client) continue

      // Total invoices TTC (not cancelled)
      const invoiceTotal = clientsWithInvoices.find(c => c.clientId === clientId)
      const totalInv = Math.round((invoiceTotal?._sum.totalTTC || 0) * 100) / 100
      const totalPaidAmt = Math.round((invoiceTotal?._sum.amountPaid || 0) * 100) / 100

      // Unpaid invoices
      const unpaid = unpaidPerClient.find(c => c.clientId === clientId)
      const totalUnpaidAmt = Math.round((unpaid?._sum.totalTTC || 0) * 100) / 100
      const unpaidCount = unpaid?._count || 0

      // Uninvoiced deliveries
      const uninvDeliveries = uninvoicedByClient.get(clientId) || 0

      // Portfolio
      const portfolio = portfolioMap.get(clientId) || 0

      // Balance = total invoices - total paid
      const balance = Math.round((totalInv - totalPaidAmt) * 100) / 100

      // Only include clients with non-zero activity
      if (totalInv > 0 || uninvDeliveries > 0 || portfolio > 0) {
        clientBreakdown.push({
          clientId,
          clientName: client.name || client.ice || 'Client inconnu',
          clientICE: client.ice,
          totalInvoicesTTC: totalInv,
          totalPaid: totalPaidAmt,
          totalUnpaid: totalUnpaidAmt,
          totalUninvoicedDeliveries: uninvDeliveries,
          balance,
          unpaidInvoiceCount: unpaidCount,
          portfolioAmount: portfolio,
        })
      }
    }

    // Sort by balance descending (highest unpaid first)
    clientBreakdown.sort((a, b) => b.balance - a.balance)

    // ═══════════════════════════════════════════════════════════════
    // 3. UNINVOICED DELIVERY NOTES (formatted for UI)
    // ═══════════════════════════════════════════════════════════════

    const formattedBLs: UninvoicedBL[] = uninvoicedBLs.map(bl => ({
      id: bl.id,
      number: bl.number,
      date: bl.date.toISOString(),
      clientName: bl.client?.name || bl.client?.ice || '—',
      clientId: bl.clientId,
      salesOrderNumber: bl.salesOrder?.number || null,
      totalTTC: Math.round(bl.totalTTC * 100) / 100,
    }))

    return NextResponse.json({
      globalSummary: {
        totalInvoicesTTC,
        totalPaid,
        totalUnpaid,
        totalUninvoicedDeliveries,
        totalEncaissements,
        totalDecaissements,
        totalPortfolio,
        netBalance: Math.round(netBalance * 100) / 100,
      },
      clientBreakdown,
      uninvoicedBLs: formattedBLs,
    })
  } catch (error) {
    console.error('Financial reports error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
