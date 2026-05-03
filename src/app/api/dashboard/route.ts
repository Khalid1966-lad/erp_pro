import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET - Dashboard KPIs (aggregated data from all modules)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    // Revenue by month (last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const validatedInvoices = await db.invoice.findMany({
      where: {
        status: { in: ['validated', 'sent', 'paid'] },
        date: { gte: twelveMonthsAgo },
      },
      select: {
        date: true,
        totalHT: true,
        totalTTC: true,
      },
    })

    const revenueByMonth: Array<{ month: string; amount: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthLabel = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })

      const monthRevenue = validatedInvoices
        .filter((inv) => {
          const invDate = new Date(inv.date)
          return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth()
        })
        .reduce((sum, inv) => sum + inv.totalHT, 0)

      revenueByMonth.push({ month: monthLabel, amount: Math.round(monthRevenue * 100) / 100 })
    }

    // Total revenue and expenses
    const totalRevenueResult = await db.invoice.aggregate({
      where: { status: { in: ['validated', 'sent', 'paid'] } },
      _sum: { totalHT: true, totalTVA: true, totalTTC: true },
    })

    const totalExpensesResult = await db.purchaseOrder.aggregate({
      where: { status: { in: ['sent', 'partially_received', 'received'] } },
      _sum: { totalHT: true, totalTTC: true },
    })

    const totalRevenue = totalRevenueResult._sum.totalHT || 0
    const totalExpenses = totalExpensesResult._sum.totalHT || 0
    const grossMargin = totalRevenue - totalExpenses
    const marginRate = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0

    // Orders by status
    const ordersByStatusRaw = await db.salesOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const ordersByStatus = {
      pending: 0,
      confirmed: 0,
      in_preparation: 0,
      delivered: 0,
      cancelled: 0,
    }
    ordersByStatusRaw.forEach((item) => {
      const key = item.status as keyof typeof ordersByStatus
      if (key in ordersByStatus) ordersByStatus[key] = item._count.id
    })

    // Quotes by status
    const quotesByStatusRaw = await db.quote.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const quotesByStatus = {
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
    }
    quotesByStatusRaw.forEach((item) => {
      const key = item.status as keyof typeof quotesByStatus
      if (key in quotesByStatus) quotesByStatus[key] = item._count.id
    })

    // Low stock products — fetch all active products and filter in JS
    // (avoids cross-column comparison issues with PgBouncer)
    const lowStockProductsRaw = await db.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        reference: true,
        designation: true,
        currentStock: true,
        minStock: true,
      },
      orderBy: { currentStock: 'asc' },
    })
    const lowStockProducts = lowStockProductsRaw
      .filter((p) => p.currentStock <= p.minStock)
      .slice(0, 20)

    // Work orders by status
    const workOrdersByStatusRaw = await db.workOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    })
    const workOrdersByStatus = {
      draft: 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
      closed: 0,
    }
    workOrdersByStatusRaw.forEach((item) => {
      const key = item.status as keyof typeof workOrdersByStatus
      if (key in workOrdersByStatus) workOrdersByStatus[key] = item._count.id
    })

    // Overdue invoices
    const now = new Date()
    const overdueInvoices = await db.invoice.count({
      where: {
        status: { in: ['validated', 'sent'] },
        dueDate: { lt: now },
      },
    })

    // Total stock value
    const allProducts = await db.product.findMany({
      where: { isActive: true },
      select: { currentStock: true, averageCost: true },
    })
    const totalStockValue = allProducts.reduce(
      (sum, p) => sum + (p.currentStock * p.averageCost),
      0
    )

    // Cash balance
    const cashBalanceResult = await db.cashRegister.aggregate({
      where: { isActive: true },
      _sum: { balance: true },
    })

    // Bank balance
    const bankBalanceResult = await db.bankAccount.aggregate({
      where: { isActive: true },
      _sum: { balance: true },
    })

    // ── Client Invoices (Factures clients) ──────────────────────────────────
    const unpaidClientInvoices = await db.invoice.findMany({
      where: { status: { in: ['validated', 'sent', 'overdue', 'partially_paid'] } },
      select: { number: true, totalTTC: true, amountPaid: true, dueDate: true, status: true, client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    })
    const unpaidClientTotal = await db.invoice.aggregate({
      where: { status: { in: ['validated', 'sent', 'overdue', 'partially_paid'] } },
      _sum: { totalTTC: true, amountPaid: true },
    })
    const overdueClientCount = await db.invoice.count({
      where: { status: { in: ['overdue'] } },
    })
    const overdueClientTotal = await db.invoice.aggregate({
      where: { status: { in: ['overdue'] } },
      _sum: { totalTTC: true, amountPaid: true },
    })

    // ── Supplier Invoices (Factures fournisseurs) ──────────────────────────
    const unpaidSupplierInvoices = await db.supplierInvoice.findMany({
      where: { status: { in: ['received', 'verified', 'overdue', 'partially_paid'] } },
      select: { number: true, totalTTC: true, amountPaid: true, dueDate: true, status: true, supplier: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    })
    const unpaidSupplierTotal = await db.supplierInvoice.aggregate({
      where: { status: { in: ['received', 'verified', 'overdue', 'partially_paid'] } },
      _sum: { totalTTC: true, amountPaid: true },
    })

    // ── Open Price Requests ────────────────────────────────────────────────
    const openPriceRequests = await db.priceRequest.findMany({
      where: { status: { in: ['draft', 'sent', 'answered', 'partially_answered'] } },
      select: { id: true, number: true, title: true, createdAt: true, status: true, _count: { select: { supplierQuotes: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const openPriceRequestsCount = await db.priceRequest.count({
      where: { status: { in: ['draft', 'sent', 'answered', 'partially_answered'] } },
    })

    // ── Pending Purchase Orders ────────────────────────────────────────────
    const pendingPurchaseOrders = await db.purchaseOrder.findMany({
      where: { status: { in: ['draft', 'sent', 'partially_received'] } },
      select: { number: true, totalTTC: true, status: true, createdAt: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const pendingPurchaseOrdersCount = await db.purchaseOrder.count({
      where: { status: { in: ['draft', 'sent', 'partially_received'] } },
    })
    const pendingPurchaseOrdersTotal = await db.purchaseOrder.aggregate({
      where: { status: { in: ['draft', 'sent', 'partially_received'] } },
      _sum: { totalTTC: true },
    })

    // ── Pending Deliveries ─────────────────────────────────────────────────
    const pendingDeliveries = await db.deliveryNote.count({
      where: { status: { in: ['draft', 'confirmed'] } },
    })

    // ── Unreconciled Bank Transactions ─────────────────────────────────────
    const unreconciledTransactions = await db.bankTransaction.count({
      where: { isReconciled: false },
    })

    // Recent activity (last 20 audit logs)
    const recentActivity = await db.auditLog.findMany({
      take: 20,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      revenueByMonth,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      marginRate: Math.round(marginRate * 10) / 10,
      ordersByStatus,
      quotesByStatus,
      lowStockProducts,
      workOrdersByStatus,
      overdueInvoices,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      cashBalance: cashBalanceResult._sum.balance || 0,
      bankBalance: bankBalanceResult._sum.balance || 0,
      recentActivity,
      // NEW: Client invoices
      unpaidClientInvoices,
      unpaidClientTotal: (unpaidClientTotal._sum.totalTTC || 0) - (unpaidClientTotal._sum.amountPaid || 0),
      overdueClientCount,
      overdueClientTotal: (overdueClientTotal._sum.totalTTC || 0) - (overdueClientTotal._sum.amountPaid || 0),
      // NEW: Supplier invoices
      unpaidSupplierInvoices,
      unpaidSupplierTotal: (unpaidSupplierTotal._sum.totalTTC || 0) - (unpaidSupplierTotal._sum.amountPaid || 0),
      // NEW: Price requests
      openPriceRequests,
      openPriceRequestsCount,
      // NEW: Purchase orders
      pendingPurchaseOrders,
      pendingPurchaseOrdersCount,
      pendingPurchaseOrdersTotal: pendingPurchaseOrdersTotal._sum.totalTTC || 0,
      // NEW: Pending deliveries
      pendingDeliveries,
      // NEW: Unreconciled
      unreconciledTransactions,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
