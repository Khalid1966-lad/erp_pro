import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const validatePrepSchema = z.object({
  lines: z.array(z.object({
    salesOrderLineId: z.string(),
    preparedQuantity: z.number().min(0),
  })),
  notes: z.string().optional(),
})

// GET - List preparations
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [preparations, total] = await Promise.all([
      db.preparationOrder.findMany({
        where,
        include: {
          salesOrder: {
            include: {
              client: { select: { id: true, name: true } },
              lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.preparationOrder.count({ where }),
    ])

    return NextResponse.json({ preparations, total, page, limit })
  } catch (error) {
    console.error('Preparations list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create preparation
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { salesOrderId } = z.object({ salesOrderId: z.string() }).parse(body)

    const salesOrder = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { preparationOrders: true },
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
    }

    if (salesOrder.status !== 'confirmed') {
      return NextResponse.json({ error: 'Le bon de commande doit être confirmé' }, { status: 400 })
    }

    const prepCount = await db.preparationOrder.count()
    const year = new Date().getFullYear()
    const prepNumber = `PREP-${year}-${String(prepCount + 1).padStart(4, '0')}`

    const preparation = await db.preparationOrder.create({
      data: {
        number: prepNumber,
        salesOrderId: salesOrder.id,
        status: 'pending',
      },
      include: {
        salesOrder: {
          include: {
            client: { select: { id: true, name: true } },
            lines: { include: { product: true } },
          },
        },
      },
    })

    await db.salesOrder.update({
      where: { id: salesOrderId },
      data: { status: 'in_preparation' },
    })

    await auditLog(auth.userId, 'create', 'PreparationOrder', preparation.id, null, preparation)
    return NextResponse.json(preparation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Preparation create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update preparation / Validate preparation
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.preparationOrder.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: { lines: { include: { product: true } } },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de préparation introuvable' }, { status: 404 })
    }

    // Validate preparation - update stock
    if (action === 'validate') {
      const validateData = validatePrepSchema.parse(body)

      for (const line of validateData.lines) {
        const orderLine = existing.salesOrder.lines.find((l) => l.id === line.salesOrderLineId)
        if (!orderLine) {
          return NextResponse.json({ error: 'Ligne de commande introuvable' }, { status: 404 })
        }

        if (line.preparedQuantity > orderLine.quantity) {
          return NextResponse.json({ error: 'Quantité préparée supérieure à la quantité commandée' }, { status: 400 })
        }

        // Check stock availability
        if (orderLine.product.currentStock < line.preparedQuantity) {
          return NextResponse.json({
            error: `Stock insuffisant pour ${orderLine.product.designation} (stock: ${orderLine.product.currentStock})`,
          }, { status: 400 })
        }

        // Update prepared quantity on sales order line
        await db.salesOrderLine.update({
          where: { id: line.salesOrderLineId },
          data: { quantityPrepared: { increment: line.preparedQuantity } },
        })

        // Create stock movement (out)
        await db.stockMovement.create({
          data: {
            productId: orderLine.productId,
            type: 'out',
            origin: 'sale',
            quantity: line.preparedQuantity,
            unitCost: orderLine.product.averageCost,
            documentRef: existing.number,
            notes: `Préparation ${existing.number}`,
          },
        })

        // Update product stock
        await db.product.update({
          where: { id: orderLine.productId },
          data: { currentStock: { decrement: line.preparedQuantity } },
        })
      }

      // Update preparation status
      const preparation = await db.preparationOrder.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          notes: validateData.notes || existing.notes,
        },
      })

      // After the update loop, re-fetch to get fresh data
      const updatedOrder = await db.salesOrder.findUnique({
        where: { id: existing.salesOrderId },
        include: { lines: true },
      })
      if (!updatedOrder) {
        return NextResponse.json({ error: 'Commande introuvable après mise à jour' }, { status: 500 })
      }

      const allPrepared = updatedOrder.lines.every((l) => l.quantityPrepared >= l.quantity)
      const somePrepared = updatedOrder.lines.some((l) => l.quantityPrepared > 0)

      if (allPrepared) {
        await db.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: 'prepared' },
        })
      } else if (somePrepared) {
        await db.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: 'in_preparation' },
        })
      }

      await auditLog(auth.userId, 'validate', 'PreparationOrder', id, existing, preparation)
      return NextResponse.json(preparation)
    }

    // Start preparation
    if (action === 'start') {
      const preparation = await db.preparationOrder.update({
        where: { id },
        data: { status: 'in_progress' },
        include: { salesOrder: { include: { client: true } } },
      })
      await auditLog(auth.userId, 'start', 'PreparationOrder', id, existing, preparation)
      return NextResponse.json(preparation)
    }

    // Cancel preparation
    if (action === 'cancel') {
      const preparation = await db.preparationOrder.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { salesOrder: true },
      })
      await auditLog(auth.userId, 'cancel', 'PreparationOrder', id, existing, preparation)
      return NextResponse.json(preparation)
    }

    // Simple update
    const preparation = await db.preparationOrder.update({
      where: { id },
      data: updateData,
      include: {
        salesOrder: {
          include: {
            client: { select: { id: true, name: true } },
            lines: { include: { product: true } },
          },
        },
      },
    })

    await auditLog(auth.userId, 'update', 'PreparationOrder', id, existing, preparation)
    return NextResponse.json(preparation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Preparation update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete preparation
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.preparationOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de préparation introuvable' }, { status: 404 })
    }

    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Impossible de supprimer une préparation complétée' }, { status: 400 })
    }

    await db.preparationOrder.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'PreparationOrder', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Preparation delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
