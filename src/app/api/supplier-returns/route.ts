import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const supplierReturnLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  reason: z.string().optional(),
})

const supplierReturnSchema = z.object({
  receptionId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  supplierInvoiceId: z.string().optional(),
  supplierId: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(supplierReturnLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateSRNumber(): Promise<string> {
  const count = await db.supplierReturn.count()
  const year = new Date().getFullYear()
  return `BRF-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List supplier returns
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_returns:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const receptionId = searchParams.get('receptionId') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (receptionId) where.receptionId = receptionId
    if (supplierId) where.supplierId = supplierId

    const [supplierReturns, total] = await Promise.all([
      db.supplierReturn.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          reception: { select: { id: true, number: true } },
          purchaseOrder: { select: { id: true, number: true } },
          supplierInvoice: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplierReturn.count({ where }),
    ])

    return NextResponse.json({ supplierReturns, total, page, limit })
  } catch (error) {
    console.error('Supplier returns list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create supplier return
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_returns:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = supplierReturnSchema.parse(body)

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    if (data.receptionId) {
      const reception = await db.reception.findUnique({ where: { id: data.receptionId } })
      if (!reception) {
        return NextResponse.json({ error: 'Réception introuvable' }, { status: 404 })
      }
    }

    if (data.purchaseOrderId) {
      const purchaseOrder = await db.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } })
      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
      }
    }

    if (data.supplierInvoiceId) {
      const supplierInvoice = await db.supplierInvoice.findUnique({ where: { id: data.supplierInvoiceId } })
      if (!supplierInvoice) {
        return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 })
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
        reason: line.reason,
      }
    })

    const number = await generateSRNumber()

    const supplierReturn = await db.supplierReturn.create({
      data: {
        number,
        receptionId: data.receptionId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        supplierInvoiceId: data.supplierInvoiceId || null,
        supplierId: data.supplierId,
        reason: data.reason,
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        reception: true,
        purchaseOrder: true,
        supplierInvoice: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'SupplierReturn', supplierReturn.id, null, supplierReturn)
    return NextResponse.json(supplierReturn, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier return create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update supplier return
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_returns:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierReturn.findUnique({
      where: { id },
      include: { lines: true, supplierCreditNotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de retour fournisseur introuvable' }, { status: 404 })
    }

    // Validate status
    const validStatuses = ['draft', 'sent', 'received_by_supplier', 'credited', 'cancelled']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Build update payload
    const data: Record<string, unknown> = {}
    if (updateData.reason !== undefined) data.reason = updateData.reason
    if (updateData.notes !== undefined) data.notes = updateData.notes
    if (updateData.status !== undefined) data.status = updateData.status

    // When status becomes received_by_supplier, create stock movements OUT in a transaction
    if (updateData.status === 'received_by_supplier' && existing.status !== 'received_by_supplier') {
      const supplierReturn = await db.$transaction(async (tx) => {
        // Create stock movement OUT for each line
        for (const line of existing.lines) {
          const product = await tx.product.findUnique({ where: { id: line.productId } })
          if (!product) {
            throw new Error('Produit introuvable')
          }

          const newStock = product.currentStock - line.quantity
          if (newStock < 0) {
            throw new Error(`Stock insuffisant pour ${product.designation} (stock: ${product.currentStock}, retour: ${line.quantity})`)
          }

          // Create stock movement (out)
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              type: 'out',
              origin: 'return',
              quantity: line.quantity,
              unitCost: line.unitPrice,
              documentRef: existing.number,
              notes: `Retour fournisseur ${existing.number} - ${product.designation}`,
            },
          })

          // Update product stock
          await tx.product.update({
            where: { id: line.productId },
            data: { currentStock: newStock },
          })
        }

        return tx.supplierReturn.update({
          where: { id },
          data,
          include: {
            supplier: true,
            reception: true,
            purchaseOrder: true,
            supplierInvoice: true,
            lines: { include: { product: true } },
          },
        })
      })

      await auditLog(auth.userId, 'update', 'SupplierReturn', id, existing, supplierReturn)
      return NextResponse.json(supplierReturn)
    }

    const supplierReturn = await db.supplierReturn.update({
      where: { id },
      data,
      include: {
        supplier: true,
        reception: true,
        purchaseOrder: true,
        supplierInvoice: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'SupplierReturn', id, existing, supplierReturn)
    return NextResponse.json(supplierReturn)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Stock insuffisant')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Supplier return update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete supplier return (only draft)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_returns:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierReturn.findUnique({
      where: { id },
      include: { supplierCreditNotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de retour fournisseur introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seul un bon de retour en brouillon peut être supprimé' }, { status: 400 })
    }

    await db.supplierReturnLine.deleteMany({ where: { supplierReturnId: id } })
    await db.supplierReturn.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'SupplierReturn', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier return delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
