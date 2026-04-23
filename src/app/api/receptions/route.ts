import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const receptionLineSchema = z.object({
  purchaseOrderLineId: z.string(),
  receivedQuantity: z.number().min(0.01),
  unitCost: z.number().min(0).optional(),
})

const receptionSchema = z.object({
  purchaseOrderId: z.string(),
  qualityCheck: z.string().default('conforme'),
  notes: z.string().optional(),
  lines: z.array(receptionLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateReceptionNumber(): Promise<string> {
  const count = await db.reception.count()
  const year = new Date().getFullYear()
  return `REC-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List receptions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'receptions:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const purchaseOrderId = searchParams.get('purchaseOrderId') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId
    if (supplierId) {
      where.purchaseOrder = { ...(where.purchaseOrder as Record<string, unknown> || {}), supplierId }
    }

    const [receptions, total] = await Promise.all([
      db.reception.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.reception.count({ where }),
    ])

    return NextResponse.json({ receptions, total, page, limit })
  } catch (error) {
    console.error('Receptions list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create reception (updates stock)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'receptions:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = receptionSchema.parse(body)

    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        lines: { include: { product: true } },
        supplier: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
    }

    if (purchaseOrder.status === 'cancelled') {
      return NextResponse.json({ error: 'Impossible de réceptionner une commande annulée' }, { status: 400 })
    }

    const number = await generateReceptionNumber()

    // Process entire reception in a single transaction to prevent race conditions
    const reception = await db.$transaction(async (tx) => {
      // Process each received line
      for (const line of data.lines) {
        const poLine = purchaseOrder.lines.find((l) => l.id === line.purchaseOrderLineId)
        if (!poLine) {
          throw new Error('Ligne de commande introuvable')
        }

        const remainingQty = poLine.quantity - poLine.quantityReceived
        if (line.receivedQuantity > remainingQty) {
          throw new Error(`Quantité reçue (${line.receivedQuantity}) supérieure à la quantité restante (${remainingQty})`)
        }

        // Update received quantity on PO line
        await tx.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: { quantityReceived: { increment: line.receivedQuantity } },
        })

        const unitCost = line.unitCost || poLine.unitPrice

        // Create stock movement (in)
        await tx.stockMovement.create({
          data: {
            productId: poLine.productId,
            type: 'in',
            origin: 'purchase_reception',
            quantity: line.receivedQuantity,
            unitCost,
            documentRef: number,
            notes: `Réception ${number} - ${purchaseOrder.number}`,
          },
        })

        // Update product stock and average cost
        const product = poLine.product
        const oldStock = product.currentStock
        const newStock = oldStock + line.receivedQuantity
        const newAvgCost = newStock > 0
          ? (product.averageCost * oldStock + unitCost * line.receivedQuantity) / newStock
          : unitCost

        await tx.product.update({
          where: { id: poLine.productId },
          data: {
            currentStock: newStock,
            averageCost: newAvgCost,
          },
        })
      }

      // Determine PO status
      const updatedPOLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
      })
      const allReceived = updatedPOLines.every((l) => l.quantityReceived >= l.quantity)
      const someReceived = updatedPOLines.some((l) => l.quantityReceived > 0)

      const newStatus = allReceived ? 'received' : someReceived ? 'partially_received' : purchaseOrder.status

      await tx.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: newStatus },
      })

      // Create reception record
      return tx.reception.create({
        data: {
          number,
          purchaseOrderId: data.purchaseOrderId,
          qualityCheck: data.qualityCheck,
          notes: data.notes,
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      })
    })

    await auditLog(auth.userId, 'create', 'Reception', reception.id, null, {
      ...reception,
      lines: data.lines,
    })

    return NextResponse.json(reception, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Reception create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete reception
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'receptions:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.reception.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Réception introuvable' }, { status: 404 })
    }

    await db.reception.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Reception', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reception delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
