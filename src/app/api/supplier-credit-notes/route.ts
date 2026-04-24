import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const supplierCreditNoteLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
})

const supplierCreditNoteSchema = z.object({
  supplierInvoiceId: z.string().optional(),
  supplierReturnId: z.string().optional(),
  supplierId: z.string(),
  reason: z.string().optional(),
  lines: z.array(supplierCreditNoteLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateSCNNumber(): Promise<string> {
  const count = await db.supplierCreditNote.count()
  const year = new Date().getFullYear()
  return `AVF-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List supplier credit notes
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_credit_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const supplierInvoiceId = searchParams.get('supplierInvoiceId') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (supplierInvoiceId) where.supplierInvoiceId = supplierInvoiceId
    if (supplierId) where.supplierId = supplierId

    const [supplierCreditNotes, total] = await Promise.all([
      db.supplierCreditNote.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          supplierInvoice: { select: { id: true, number: true } },
          supplierReturn: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplierCreditNote.count({ where }),
    ])

    return NextResponse.json({ supplierCreditNotes, total, page, limit })
  } catch (error) {
    console.error('Supplier credit notes list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create supplier credit note
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = supplierCreditNoteSchema.parse(body)

    const supplier = await db.supplier.findUnique({ where: { id: data.supplierId } })
    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    if (data.supplierInvoiceId) {
      const supplierInvoice = await db.supplierInvoice.findUnique({ where: { id: data.supplierInvoiceId } })
      if (!supplierInvoice) {
        return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 })
      }
    }

    if (data.supplierReturnId) {
      const supplierReturn = await db.supplierReturn.findUnique({ where: { id: data.supplierReturnId } })
      if (!supplierReturn) {
        return NextResponse.json({ error: 'Bon de retour fournisseur introuvable' }, { status: 404 })
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

    const number = await generateSCNNumber()

    const supplierCreditNote = await db.supplierCreditNote.create({
      data: {
        number,
        supplierInvoiceId: data.supplierInvoiceId || null,
        supplierReturnId: data.supplierReturnId || null,
        supplierId: data.supplierId,
        reason: data.reason,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        supplierInvoice: true,
        supplierReturn: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'SupplierCreditNote', supplierCreditNote.id, null, supplierCreditNote)
    return NextResponse.json(supplierCreditNote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier credit note create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update supplier credit note
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierCreditNote.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Avoir fournisseur introuvable' }, { status: 404 })
    }

    // Validate status
    const validStatuses = ['received', 'applied', 'partially_applied', 'cancelled']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Validate amountApplied
    if (updateData.amountApplied !== undefined) {
      if (updateData.amountApplied < 0) {
        return NextResponse.json({ error: 'Le montant appliqué ne peut pas être négatif' }, { status: 400 })
      }
      if (updateData.amountApplied > existing.totalTTC) {
        return NextResponse.json({ error: 'Le montant appliqué ne peut pas dépasser le total TTC' }, { status: 400 })
      }
    }

    // Build update payload
    const data: Record<string, unknown> = {}
    if (updateData.reason !== undefined) data.reason = updateData.reason
    if (updateData.status !== undefined) data.status = updateData.status
    if (updateData.amountApplied !== undefined) data.amountApplied = updateData.amountApplied

    // If lines are provided, replace them and recalculate totals (only for received)
    if (updateData.lines && Array.isArray(updateData.lines) && updateData.lines.length > 0) {
      if (existing.status !== 'received') {
        return NextResponse.json({ error: 'Seul un avoir en statut "reçu" peut avoir ses lignes modifiées' }, { status: 400 })
      }

      const parsedLines = z.array(supplierCreditNoteLineSchema).parse(updateData.lines)

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

      await db.supplierCreditNoteLine.deleteMany({ where: { supplierCreditNoteId: id } })
      data.lines = { create: linesData }
      data.totalHT = totalHT
      data.totalTVA = totalTVA
      data.totalTTC = totalHT + totalTVA
    }

    // Auto-determine status based on amountApplied if not explicitly set
    if (updateData.amountApplied !== undefined && !updateData.status) {
      if (updateData.amountApplied >= existing.totalTTC) {
        data.status = 'applied'
      } else if (updateData.amountApplied > 0) {
        data.status = 'partially_applied'
      }
    }

    const supplierCreditNote = await db.supplierCreditNote.update({
      where: { id },
      data,
      include: {
        supplier: true,
        supplierInvoice: true,
        supplierReturn: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'SupplierCreditNote', id, existing, supplierCreditNote)
    return NextResponse.json(supplierCreditNote)
  } catch (error) {
    console.error('Supplier credit note update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete supplier credit note (only received status)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'supplier_credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplierCreditNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Avoir fournisseur introuvable' }, { status: 404 })
    }

    if (existing.status !== 'received') {
      return NextResponse.json({ error: 'Seul un avoir avec le statut "received" peut être supprimé' }, { status: 400 })
    }

    await db.supplierCreditNoteLine.deleteMany({ where: { supplierCreditNoteId: id } })
    await db.supplierCreditNote.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'SupplierCreditNote', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier credit note delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
