import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const quoteLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  discount: z.number().default(0),
})

const quoteSchema = z.object({
  clientId: z.string(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).default('draft'),
  validUntil: z.string().datetime(),
  discountRate: z.number().default(0),
  shippingCost: z.number().default(0),
  notes: z.string().optional(),
  lines: z.array(quoteLineSchema).min(1, 'Au moins une ligne requise'),
})

// Generate next quote number
async function generateQuoteNumber(): Promise<string> {
  const count = await db.quote.count()
  const year = new Date().getFullYear()
  return `DEV-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List quotes
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'quotes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { client: { name: { contains: search } } },
      ]
    }

    const [quotes, total] = await Promise.all([
      db.quote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.quote.count({ where }),
    ])

    return NextResponse.json({ quotes, total, page, limit })
  } catch (error) {
    console.error('Quotes list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create quote
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = quoteSchema.parse(body)

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: data.clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Verify all products exist
    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    // Calculate totals
    let totalHT = 0
    let totalTVA = 0

    const linesData = data.lines.map((line) => {
      const lineHT = line.quantity * line.unitPrice * (1 - line.discount / 100)
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
        totalHT: lineHT,
        discount: line.discount,
      }
    })

    // Apply global discount and shipping
    const discountedHT = totalHT * (1 - data.discountRate / 100)
    const finalTotalHT = discountedHT + data.shippingCost

    const number = await generateQuoteNumber()

    const quote = await db.quote.create({
      data: {
        number,
        clientId: data.clientId,
        status: data.status,
        validUntil: new Date(data.validUntil),
        discountRate: data.discountRate,
        shippingCost: data.shippingCost,
        notes: data.notes,
        totalHT: finalTotalHT,
        totalTVA: totalTVA * (1 - data.discountRate / 100),
        totalTTC: finalTotalHT + totalTVA * (1 - data.discountRate / 100),
        lines: { create: linesData },
      },
      include: {
        client: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'Quote', quote.id, null, quote)

    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Quote create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update quote / Transform to sales order
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.quote.findUnique({
      where: { id },
      include: { lines: { include: { product: true } }, client: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    // Transform to sales order
    if (action === 'transform') {
      if (existing.status !== 'accepted') {
        return NextResponse.json({ error: 'Le devis doit être accepté pour être transformé' }, { status: 400 })
      }

      const count = await db.salesOrder.count()
      const year = new Date().getFullYear()
      const orderNumber = `BC-${year}-${String(count + 1).padStart(4, '0')}`

      const salesOrder = await db.salesOrder.create({
        data: {
          number: orderNumber,
          quoteId: existing.id,
          clientId: existing.clientId,
          status: 'pending',
          totalHT: existing.totalHT,
          totalTVA: existing.totalTVA,
          totalTTC: existing.totalTTC,
          lines: {
            create: existing.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              tvaRate: line.tvaRate,
              totalHT: line.totalHT,
            })),
          },
        },
        include: { client: true, lines: { include: { product: true } } },
      })

      await db.quote.update({ where: { id }, data: { status: 'accepted' } })
      await auditLog(auth.userId, 'transform_to_sales_order', 'Quote', id, existing, salesOrder)

      return NextResponse.json(salesOrder, { status: 201 })
    }

    // Update quote status
    if (updateData.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['sent', 'cancelled'],
        sent: ['accepted', 'rejected', 'expired', 'draft'],
        accepted: [],
        rejected: ['draft'],
        expired: ['draft'],
      }
      const allowed = validTransitions[existing.status] || []
      if (!allowed.includes(updateData.status)) {
        return NextResponse.json({ error: 'Transition de statut invalide' }, { status: 400 })
      }
    }

    // Recalculate if lines changed
    if (updateData.lines) {
      let totalHT = 0
      let totalTVA = 0
      const linesData = updateData.lines.map((line: z.infer<typeof quoteLineSchema>) => {
        const lineHT = line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100)
        const lineTVA = lineHT * (line.tvaRate / 100)
        totalHT += lineHT
        totalTVA += lineTVA
        return {
          id: line.productId ? undefined : undefined,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          tvaRate: line.tvaRate,
          totalHT: lineHT,
          discount: line.discount || 0,
        }
      })

      // Delete existing lines and recreate
      await db.quoteLine.deleteMany({ where: { quoteId: id } })

      const discountedHT = totalHT * (1 - ((updateData.discountRate ?? existing.discountRate) / 100))
      const finalTotalHT = discountedHT + (updateData.shippingCost ?? existing.shippingCost)
      const finalTotalTVA = totalTVA * (1 - ((updateData.discountRate ?? existing.discountRate) / 100))

      const quote = await db.quote.update({
        where: { id },
        data: {
          ...updateData,
          totalHT: finalTotalHT,
          totalTVA: finalTotalTVA,
          totalTTC: finalTotalHT + finalTotalTVA,
          lines: { create: linesData },
        },
        include: {
          client: true,
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'update', 'Quote', id, existing, quote)
      return NextResponse.json(quote)
    }

    const quote = await db.quote.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'Quote', id, existing, quote)
    return NextResponse.json(quote)
  } catch (error) {
    console.error('Quote update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete quote
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.quote.findUnique({
      where: { id },
      include: { salesOrders: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    if (existing.salesOrders.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un devis lié à un bon de commande' }, { status: 400 })
    }

    await db.quoteLine.deleteMany({ where: { quoteId: id } })
    await db.quote.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Quote', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Quote delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
