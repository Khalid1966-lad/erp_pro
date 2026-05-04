import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'

const salesOrderLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  discount: z.number().default(0),
})

const salesOrderSchema = z.object({
  clientId: z.string(),
  quoteId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'in_preparation', 'prepared', 'partially_delivered', 'delivered', 'cancelled']).optional(),
  deliveryDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  lines: z.array(salesOrderLineSchema).optional(),
})

async function generateSONumber(): Promise<string> {
  const count = await db.salesOrder.count()
  const year = new Date().getFullYear()
  return `BC-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List sales orders
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'sales_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (id) where.id = id
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { client: { name: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.salesOrder.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
          preparationOrders: true,
          quote: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.salesOrder.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (error) {
    console.error('Sales orders list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create sales order
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'sales_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = salesOrderSchema.parse(body)

    const client = await db.client.findUnique({ where: { id: data.clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    if (!data.lines || data.lines.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })
    }

    // If creating from a quote, verify quote exists and is accepted
    if (data.quoteId) {
      const quote = await db.quote.findUnique({ where: { id: data.quoteId } })
      if (!quote) {
        return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
      }
      if (quote.status !== 'accepted') {
        return NextResponse.json({ error: 'Le devis doit être accepté pour créer une commande' }, { status: 400 })
      }
      if (quote.clientId !== data.clientId) {
        return NextResponse.json({ error: 'Le devis ne correspond pas au client sélectionné' }, { status: 400 })
      }
    }

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    let totalHT = 0
    let totalTVA = 0

    const linesData = data.lines.map((line) => {
      const discountMultiplier = 1 - ((line.discount || 0) / 100)
      const lineHT = line.quantity * line.unitPrice * discountMultiplier
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

    const number = await generateSONumber()

    const order = await db.salesOrder.create({
      data: {
        number,
        clientId: data.clientId,
        quoteId: data.quoteId || null,
        status: data.status || 'pending',
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        client: true,
        lines: { include: { product: true } },
        quote: { select: { id: true, number: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'SalesOrder', order.id, null, order)
    notifyAll({ title: 'Nouvelle commande', message: `Commande ${order.number}`, type: 'success', category: 'order', entityType: 'SalesOrder', entityId: order.id }).catch(() => {})
    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Sales order create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update sales order / Create preparation / Create invoice
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'sales_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.salesOrder.findUnique({
      where: { id },
      include: { lines: { include: { product: true } }, client: true, quote: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
    }

    // Create preparation order
    if (action === 'create_preparation') {
      if (existing.status !== 'confirmed') {
        return NextResponse.json({ error: 'Le bon de commande doit être confirmé' }, { status: 400 })
      }

      const prepCount = await db.preparationOrder.count()
      const year = new Date().getFullYear()
      const prepNumber = `PREP-${year}-${String(prepCount + 1).padStart(4, '0')}`

      const preparation = await db.preparationOrder.create({
        data: {
          number: prepNumber,
          salesOrderId: existing.id,
          status: 'pending',
        },
      })

      await db.salesOrder.update({
        where: { id },
        data: { status: 'in_preparation' },
      })

      await auditLog(auth.userId, 'create_preparation', 'SalesOrder', id, existing, preparation)
      return NextResponse.json(preparation, { status: 201 })
    }

    // Create invoice from sales order
    if (action === 'create_invoice') {
      if (existing.status !== 'delivered' && existing.status !== 'partially_delivered') {
        return NextResponse.json({ error: 'Le bon de commande doit être livré' }, { status: 400 })
      }

      const invCount = await db.invoice.count()
      const year = new Date().getFullYear()
      const invNumber = `FAC-${year}-${String(invCount + 1).padStart(4, '0')}`

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)

      let totalHT = 0
      let totalTVA = 0

      const invoiceLinesData = existing.lines.map((line) => {
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

      const invoice = await db.invoice.create({
        data: {
          number: invNumber,
          salesOrderId: existing.id,
          clientId: existing.clientId,
          status: 'draft',
          dueDate,
          totalHT,
          totalTVA,
          totalTTC: totalHT + totalTVA,
          lines: { create: invoiceLinesData },
        },
        include: {
          client: true,
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'create_invoice', 'SalesOrder', id, existing, invoice)
      return NextResponse.json(invoice, { status: 201 })
    }

    // Recalculate if lines changed
    if (updateData.lines && Array.isArray(updateData.lines)) {
      // Only allow editing when status is 'pending'
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Seule une commande en attente peut être modifiée' }, { status: 400 })
      }

      let totalHT = 0
      let totalTVA = 0
      const linesData = updateData.lines.map((line: z.infer<typeof salesOrderLineSchema>) => {
        const discountMultiplier = 1 - ((line.discount || 0) / 100)
        const lineHT = line.quantity * line.unitPrice * discountMultiplier
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

      // Delete existing lines and recreate
      await db.salesOrderLine.deleteMany({ where: { orderId: id } })

      const { lines: _lines, ...fieldsToUpdate } = updateData

      const order = await db.salesOrder.update({
        where: { id },
        data: {
          ...fieldsToUpdate,
          totalHT,
          totalTVA,
          totalTTC: totalHT + totalTVA,
          lines: { create: linesData },
        },
        include: {
          client: true,
          lines: { include: { product: true } },
          preparationOrders: true,
          quote: { select: { id: true, number: true } },
        },
      })

      await auditLog(auth.userId, 'update', 'SalesOrder', id, existing, order)
      return NextResponse.json(order)
    }

    // Update sales order (simple fields)
    const order = await db.salesOrder.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        lines: { include: { product: true } },
        preparationOrders: true,
        quote: { select: { id: true, number: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'SalesOrder', id, existing, order)
    return NextResponse.json(order)
  } catch (error) {
    console.error('Sales order update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete sales order
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'sales_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.salesOrder.findUnique({
      where: { id },
      include: { invoices: true, preparationOrders: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
    }

    if (existing.invoices.length > 0 || existing.preparationOrders.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un bon de commande avec des documents associés' }, { status: 400 })
    }

    await db.salesOrderLine.deleteMany({ where: { orderId: id } })
    await db.salesOrder.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'SalesOrder', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sales order delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
