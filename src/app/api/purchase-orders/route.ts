import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'

const purchaseOrderLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
})

const purchaseOrderSchema = z.object({
  supplierId: z.string(),
  supplierQuoteId: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partially_received', 'received', 'cancelled']).optional(),
  expectedDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
  lines: z.array(purchaseOrderLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generatePONumber(): Promise<string> {
  const count = await db.purchaseOrder.count()
  const year = new Date().getFullYear()
  return `COM-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List purchase orders
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'purchase_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { supplier: { name: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
          receptions: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (error) {
    console.error('Purchase orders list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create purchase order
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'purchase_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = purchaseOrderSchema.parse(body)

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    let totalHT = 0
    let totalTVA = 0

    const linesData = data.lines.map((line) => {
      const lineHT = line.quantity * line.unitPrice
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
        totalHT: lineHT,
      }
    })

    const number = await generatePONumber()

    const order = await db.purchaseOrder.create({
      data: {
        number,
        supplierId: data.supplierId,
        supplierQuoteId: data.supplierQuoteId || null,
        status: data.status || 'draft',
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'PurchaseOrder', order.id, null, order)
    notifyAll({ title: 'Nouvelle commande fournisseur', message: `Commande ${order.number}`, type: 'success', category: 'order', entityType: 'PurchaseOrder', entityId: order.id }).catch(() => {})
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Purchase order create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update purchase order
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'purchase_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true, supplier: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    // Cancel
    if (action === 'cancel') {
      if (existing.status === 'received') {
        return NextResponse.json({ error: 'Impossible d\'annuler une commande déjà reçue' }, { status: 400 })
      }
      const order = await db.purchaseOrder.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { supplier: true, lines: { include: { product: true } } },
      })
      await auditLog(auth.userId, 'cancel', 'PurchaseOrder', id, existing, order)
      return NextResponse.json(order)
    }

    if (existing.status !== 'draft' && existing.status !== 'sent') {
      return NextResponse.json({ error: 'Seule une commande en brouillon ou envoyée peut être modifiée' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (updateData.supplierId !== undefined) data.supplierId = updateData.supplierId
    if (updateData.expectedDate !== undefined) data.expectedDate = updateData.expectedDate ? new Date(updateData.expectedDate) : null
    if (updateData.notes !== undefined) data.notes = updateData.notes

    // If lines are provided, replace them and recalculate totals
    if (updateData.lines && Array.isArray(updateData.lines) && updateData.lines.length > 0) {
      const parsedLines = z.array(purchaseOrderLineSchema).parse(updateData.lines)

      const productIds = parsedLines.map((l) => l.productId)
      const products = await db.product.findMany({ where: { id: { in: productIds } } })
      if (products.length !== productIds.length) {
        return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
      }

      let totalHT = 0
      let totalTVA = 0

      const linesData = parsedLines.map((line) => {
        const lineHT = line.quantity * line.unitPrice
        const lineTVA = lineHT * (line.tvaRate / 100)
        totalHT += lineHT
        totalTVA += lineTVA
        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          tvaRate: line.tvaRate,
          totalHT: lineHT,
        }
      })

      await db.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } })
      data.lines = { create: linesData }
      data.totalHT = totalHT
      data.totalTVA = totalTVA
      data.totalTTC = totalHT + totalTVA
    }

    const order = await db.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: true,
        lines: { include: { product: true } },
        receptions: true,
      },
    })

    await auditLog(auth.userId, 'update', 'PurchaseOrder', id, existing, order)
    return NextResponse.json(order)
  } catch (error) {
    console.error('Purchase order update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete purchase order
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'purchase_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.purchaseOrder.findUnique({
      where: { id },
      include: { receptions: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seule une commande en brouillon peut être supprimée' }, { status: 400 })
    }

    await db.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } })
    await db.purchaseOrder.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'PurchaseOrder', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Purchase order delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
