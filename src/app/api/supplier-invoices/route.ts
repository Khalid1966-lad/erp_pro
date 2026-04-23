import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const supplierInvoiceLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
})

const supplierInvoiceSchema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId: z.string(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  lines: z.array(supplierInvoiceLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateSINumber(): Promise<string> {
  const count = await db.supplierInvoice.count()
  const year = new Date().getFullYear()
  return `FAC-F-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List supplier invoices
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_invoices:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' as const } },
        { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
        { supplier: { code: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    const [supplierInvoices, total] = await Promise.all([
      db.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          purchaseOrder: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplierInvoice.count({ where }),
    ])

    return NextResponse.json({ supplierInvoices, total, page, limit })
  } catch (error) {
    console.error('Supplier invoices list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create supplier invoice
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = supplierInvoiceSchema.parse(body)

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    if (data.purchaseOrderId) {
      const purchaseOrder = await db.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } })
      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Commande fournisseur introuvable' }, { status: 404 })
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
      }
    })

    const number = await generateSINumber()

    const supplierInvoice = await db.supplierInvoice.create({
      data: {
        number,
        purchaseOrderId: data.purchaseOrderId || null,
        supplierId: data.supplierId,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'SupplierInvoice', supplierInvoice.id, null, supplierInvoice)
    return NextResponse.json(supplierInvoice, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier invoice create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update supplier invoice
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierInvoice.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 })
    }

    // Validate status
    const validStatuses = ['received', 'verified', 'paid', 'partially_paid', 'overdue', 'cancelled']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Build update payload
    const data: Record<string, unknown> = {}
    if (updateData.notes !== undefined) data.notes = updateData.notes
    if (updateData.status !== undefined) data.status = updateData.status
    if (updateData.dueDate !== undefined) data.dueDate = new Date(updateData.dueDate)
    if (updateData.paymentDate !== undefined) data.paymentDate = updateData.paymentDate ? new Date(updateData.paymentDate) : null
    if (updateData.amountPaid !== undefined) data.amountPaid = updateData.amountPaid

    const supplierInvoice = await db.supplierInvoice.update({
      where: { id },
      data,
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'SupplierInvoice', id, existing, supplierInvoice)
    return NextResponse.json(supplierInvoice)
  } catch (error) {
    console.error('Supplier invoice update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete supplier invoice (only received status)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierInvoice.findUnique({
      where: { id },
      include: { supplierReturns: true, supplierCreditNotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 })
    }

    if (existing.status !== 'received') {
      return NextResponse.json({ error: 'Seule une facture avec le statut "received" peut être supprimée' }, { status: 400 })
    }

    await db.supplierInvoiceLine.deleteMany({ where: { supplierInvoiceId: id } })
    await db.supplierInvoice.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'SupplierInvoice', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier invoice delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
