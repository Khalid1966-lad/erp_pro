import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET - Fetch agenda data for the connected user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')))

    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    // Fetch user's audit logs to find entities they interacted with
    const recentActions = await db.auditLog.findMany({
      where: {
        userId: auth.userId,
        createdAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }
      },
      select: { entity: true, entityId: true, action: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    const quoteIds = recentActions.filter(a => a.entity === 'Quote').map(a => a.entityId).filter(Boolean)
    const orderIds = recentActions.filter(a => a.entity === 'SalesOrder').map(a => a.entityId).filter(Boolean)
    const preparationIds = recentActions.filter(a => a.entity === 'PreparationOrder').map(a => a.entityId).filter(Boolean)
    const deliveryNoteIds = recentActions.filter(a => a.entity === 'DeliveryNote').map(a => a.entityId).filter(Boolean)
    const invoiceIds = recentActions.filter(a => a.entity === 'Invoice').map(a => a.entityId).filter(Boolean)
    const workOrderIds = recentActions.filter(a => a.entity === 'WorkOrder').map(a => a.entityId).filter(Boolean)
    const purchaseOrderIds = recentActions.filter(a => a.entity === 'PurchaseOrder').map(a => a.entityId).filter(Boolean)

    const [
      myQuotes,
      myOrders,
      myPreparations,
      myDeliveryNotes,
      myInvoices,
      myWorkOrders,
      myPurchaseOrders,
      stockAlerts,
      upcomingInvoices,
    ] = await Promise.all([
      quoteIds.length > 0
        ? db.quote.findMany({
            where: { id: { in: quoteIds }, status: { in: ['draft', 'sent', 'accepted'] } },
            include: { client: { select: { name: true, nomCommercial: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 20
          })
        : Promise.resolve([]),

      orderIds.length > 0
        ? db.salesOrder.findMany({
            where: { id: { in: orderIds }, status: { notIn: ['cancelled', 'delivered'] } },
            include: { client: { select: { name: true, nomCommercial: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 20
          })
        : Promise.resolve([]),

      preparationIds.length > 0
        ? db.preparationOrder.findMany({
            where: { id: { in: preparationIds }, status: { in: ['pending', 'in_progress'] } },
            include: { salesOrder: { select: { number: true, client: { select: { name: true, nomCommercial: true } } } } },
            orderBy: { updatedAt: 'desc' },
            take: 20
          })
        : Promise.resolve([]),

      deliveryNoteIds.length > 0
        ? db.deliveryNote.findMany({
            where: { id: { in: deliveryNoteIds }, status: { notIn: ['cancelled', 'delivered'] }, plannedDate: { lte: futureDate } },
            include: { client: { select: { name: true, nomCommercial: true } } },
            orderBy: { plannedDate: 'asc' },
            take: 15
          })
        : Promise.resolve([]),

      invoiceIds.length > 0
        ? db.invoice.findMany({
            where: { id: { in: invoiceIds }, status: { in: ['draft', 'validated', 'sent', 'partially_paid'] } },
            include: { client: { select: { name: true, nomCommercial: true } } },
            orderBy: { dueDate: 'asc' },
            take: 20
          })
        : Promise.resolve([]),

      workOrderIds.length > 0
        ? db.workOrder.findMany({
            where: { id: { in: workOrderIds }, status: { in: ['draft', 'planned', 'in_progress'] } },
            include: { product: { select: { reference: true, designation: true } } },
            orderBy: { plannedDate: { sort: 'asc', nulls: 'first' } },
            take: 15
          })
        : Promise.resolve([]),

      purchaseOrderIds.length > 0
        ? db.purchaseOrder.findMany({
            where: { id: { in: purchaseOrderIds }, status: { notIn: ['cancelled', 'received'] }, expectedDate: { lte: futureDate } },
            include: { supplier: { select: { name: true } } },
            orderBy: { expectedDate: 'asc' },
            take: 15
          })
        : Promise.resolve([]),

      db.product.findMany({
        where: { isStockable: true, isActive: true, currentStock: { lte: db.product.fields.minStock } },
        select: { id: true, reference: true, designation: true, currentStock: true, minStock: true },
        orderBy: { currentStock: 'asc' },
        take: 10
      }),

      db.invoice.findMany({
        where: { status: { in: ['validated', 'sent', 'partially_paid', 'overdue'] }, dueDate: { lte: futureDate } },
        include: { client: { select: { name: true, nomCommercial: true } } },
        orderBy: { dueDate: 'asc' },
        take: 15
      })
    ])

    const stats = {
      activeQuotes: myQuotes.length,
      pendingOrders: myOrders.length,
      pendingPreparations: myPreparations.length,
      upcomingDeliveries: myDeliveryNotes.length,
      pendingInvoices: myInvoices.length,
      activeWorkOrders: myWorkOrders.length,
      pendingPurchaseOrders: myPurchaseOrders.length,
      stockAlerts: stockAlerts.length,
      overdueInvoices: upcomingInvoices.filter(i => i.dueDate <= now && i.status !== 'paid').length,
    }

    return NextResponse.json({
      stats,
      quotes: myQuotes.map(q => ({
        id: q.id, number: q.number, status: q.status,
        clientName: q.client.nomCommercial || q.client.name || '—',
        totalTTC: q.totalTTC, validUntil: q.validUntil, date: q.date
      })),
      orders: myOrders.map(o => ({
        id: o.id, number: o.number, status: o.status,
        clientName: o.client.nomCommercial || o.client.name || '—',
        totalTTC: o.totalTTC, deliveryDate: o.deliveryDate, date: o.date
      })),
      preparations: myPreparations.map(p => ({
        id: p.id, number: p.number, status: p.status,
        orderNumber: p.salesOrder?.number || '—',
        clientName: p.salesOrder?.client?.nomCommercial || p.salesOrder?.client?.name || '—',
        createdAt: p.createdAt
      })),
      deliveryNotes: myDeliveryNotes.map(d => ({
        id: d.id, number: d.number, status: d.status,
        clientName: d.client.nomCommercial || d.client.name || '—',
        plannedDate: d.plannedDate, totalTTC: d.totalTTC
      })),
      invoices: myInvoices.map(i => ({
        id: i.id, number: i.number, status: i.status,
        clientName: i.client.nomCommercial || i.client.name || '—',
        totalTTC: i.totalTTC, amountPaid: i.amountPaid, dueDate: i.dueDate
      })),
      workOrders: myWorkOrders.map(w => ({
        id: w.id, number: w.number, status: w.status,
        productRef: w.product.reference, productDesignation: w.product.designation,
        quantity: w.quantity, plannedDate: w.plannedDate
      })),
      purchaseOrders: myPurchaseOrders.map(po => ({
        id: po.id, number: po.number, status: po.status,
        supplierName: po.supplier.name,
        totalTTC: po.totalTTC, expectedDate: po.expectedDate
      })),
      stockAlerts,
      upcomingInvoices: upcomingInvoices.map(i => ({
        id: i.id, number: i.number, status: i.status,
        clientName: i.client.nomCommercial || i.client.name || '—',
        totalTTC: i.totalTTC, amountPaid: i.amountPaid, dueDate: i.dueDate
      }))
    })
  } catch (error) {
    console.error('Agenda fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
