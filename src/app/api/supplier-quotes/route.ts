import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const supplierQuoteLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  availability: z.string().optional(),
  deliveryDelay: z.number().optional(),
  discount: z.number().min(0).optional(),
})

const supplierQuoteSchema = z.object({
  priceRequestId: z.string().optional(),
  supplierId: z.string(),
  validUntil: z.string().datetime().optional(),
  deliveryDelay: z.number().default(7),
  deliveryFrequency: z.string().optional(),
  paymentTerms: z.string().default('30 jours'),
  notes: z.string().optional(),
  selectedForPO: z.boolean().optional(),
  lines: z.array(supplierQuoteLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateSQNumber(): Promise<string> {
  const count = await db.supplierQuote.count()
  const year = new Date().getFullYear()
  return `DFR-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List supplier quotes
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_quotes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const priceRequestId = searchParams.get('priceRequestId') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (priceRequestId) where.priceRequestId = priceRequestId
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status

    const [supplierQuotes, total] = await Promise.all([
      db.supplierQuote.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          priceRequest: { select: { id: true, number: true, title: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplierQuote.count({ where }),
    ])

    return NextResponse.json({ supplierQuotes, total, page, limit })
  } catch (error) {
    console.error('Supplier quotes list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create supplier quote
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = supplierQuoteSchema.parse(body)

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    if (data.priceRequestId) {
      const priceRequest = await db.priceRequest.findUnique({ where: { id: data.priceRequestId } })
      if (!priceRequest) {
        return NextResponse.json({ error: 'Demande de prix introuvable' }, { status: 404 })
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
        availability: line.availability || null,
        deliveryDelay: line.deliveryDelay ?? null,
        discount: line.discount ?? null,
      }
    })

    const number = await generateSQNumber()

    const supplierQuote = await db.supplierQuote.create({
      data: {
        number,
        priceRequestId: data.priceRequestId || null,
        supplierId: data.supplierId,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        deliveryDelay: data.deliveryDelay,
        deliveryFrequency: data.deliveryFrequency || null,
        paymentTerms: data.paymentTerms,
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        priceRequest: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'SupplierQuote', supplierQuote.id, null, supplierQuote)
    return NextResponse.json(supplierQuote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier quote create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update supplier quote
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, lines, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierQuote.findUnique({
      where: { id },
      include: { lines: true, purchaseOrders: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Devis fournisseur introuvable' }, { status: 404 })
    }

    // Validate status
    const validStatuses = ['received', 'accepted', 'rejected', 'expired']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Build update payload
    const data: Record<string, unknown> = {}
    if (updateData.validUntil !== undefined) data.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null
    if (updateData.deliveryDelay !== undefined) data.deliveryDelay = updateData.deliveryDelay
    if (updateData.deliveryFrequency !== undefined) data.deliveryFrequency = updateData.deliveryFrequency || null
    if (updateData.paymentTerms !== undefined) data.paymentTerms = updateData.paymentTerms
    if (updateData.notes !== undefined) data.notes = updateData.notes
    if (updateData.status !== undefined) data.status = updateData.status
    if (updateData.selectedForPO !== undefined) data.selectedForPO = updateData.selectedForPO

    // If lines are provided, replace them and recalculate totals
    if (lines && Array.isArray(lines) && lines.length > 0) {
      const parsedLines = z.array(supplierQuoteLineSchema).parse(lines)

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
          availability: line.availability || null,
          deliveryDelay: line.deliveryDelay ?? null,
          discount: line.discount ?? null,
        }
      })

      await db.supplierQuoteLine.deleteMany({ where: { supplierQuoteId: id } })
      data.lines = { create: linesData }
      data.totalHT = totalHT
      data.totalTVA = totalTVA
      data.totalTTC = totalHT + totalTVA
    }

    const supplierQuote = await db.supplierQuote.update({
      where: { id },
      data,
      include: {
        supplier: true,
        priceRequest: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'SupplierQuote', id, existing, supplierQuote)
    return NextResponse.json(supplierQuote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier quote update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete supplier quote (only received status)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_quotes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierQuote.findUnique({
      where: { id },
      include: { purchaseOrders: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Devis fournisseur introuvable' }, { status: 404 })
    }

    if (existing.status !== 'received') {
      return NextResponse.json({ error: 'Seul un devis avec le statut "received" peut être supprimé' }, { status: 400 })
    }

    await db.supplierQuoteLine.deleteMany({ where: { supplierQuoteId: id } })
    await db.supplierQuote.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'SupplierQuote', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier quote delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
