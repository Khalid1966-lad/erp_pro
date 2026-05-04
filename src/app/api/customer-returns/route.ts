import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'

const customerReturnLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  qualityCheck: z.string().default('pending'),
  qualityNotes: z.string().optional(),
})

const customerReturnSchema = z.object({
  clientId: z.string(),
  deliveryNoteId: z.string().optional(),
  invoiceId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(customerReturnLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateCRNumber(): Promise<string> {
  const count = await db.customerReturn.count()
  const year = new Date().getFullYear()
  return `RET-CLT-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List customer returns
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId') || ''
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status

    const customerReturns = await db.customerReturn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, raisonSociale: true } },
        deliveryNote: { select: { id: true, number: true } },
        invoice: { select: { id: true, number: true } },
        lines: {
          include: { product: { select: { id: true, reference: true, designation: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json({ customerReturns, total: customerReturns.length })
  } catch (error) {
    console.error('Customer returns list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create customer return
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = customerReturnSchema.parse(body)

    const client = await db.client.findUnique({ where: { id: data.clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    if (data.deliveryNoteId) {
      const dn = await db.deliveryNote.findUnique({ where: { id: data.deliveryNoteId } })
      if (!dn) {
        return NextResponse.json({ error: 'Bon de livraison introuvable' }, { status: 404 })
      }
    }

    if (data.invoiceId) {
      const inv = await db.invoice.findUnique({ where: { id: data.invoiceId } })
      if (!inv) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
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
        qualityCheck: line.qualityCheck || 'pending',
        qualityNotes: line.qualityNotes,
      }
    })

    const number = await generateCRNumber()

    const customerReturn = await db.customerReturn.create({
      data: {
        number,
        clientId: data.clientId,
        deliveryNoteId: data.deliveryNoteId || null,
        invoiceId: data.invoiceId || null,
        reason: data.reason,
        notes: data.notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        client: true,
        deliveryNote: { select: { number: true } },
        invoice: { select: { number: true } },
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'CustomerReturn', customerReturn.id, null, customerReturn)
    notifyAll({ title: 'Nouveau retour client', message: `Retour ${customerReturn.number}`, type: 'success', category: 'order', entityType: 'CustomerReturn', entityId: customerReturn.id }).catch(() => {})
    return NextResponse.json({ customerReturn }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Customer return create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update customer return
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, status, reason, notes, lines, qualityLines } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.customerReturn.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de retour introuvable' }, { status: 404 })
    }

    const validStatuses = ['draft', 'validated', 'restocked', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (reason !== undefined) data.reason = reason
    if (notes !== undefined) data.notes = notes

    // Update quality check on individual lines
    if (qualityLines && Array.isArray(qualityLines)) {
      for (const ql of qualityLines) {
        if (ql.id && ql.qualityCheck) {
          await db.customerReturnLine.update({
            where: { id: ql.id },
            data: { qualityCheck: ql.qualityCheck, qualityNotes: ql.qualityNotes || null },
          })
        }
      }
    }

    // Replace lines and recalculate totals (draft only)
    if (lines && Array.isArray(lines) && lines.length > 0) {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Seul un brouillon peut avoir ses lignes modifiées' }, { status: 400 })
      }

      const parsedLines = z.array(customerReturnLineSchema).parse(lines)

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
          qualityCheck: line.qualityCheck || 'pending',
          qualityNotes: line.qualityNotes,
        }
      })

      await db.customerReturnLine.deleteMany({ where: { customerReturnId: id } })
      data.lines = { create: linesData }
      data.totalHT = totalHT
      data.totalTVA = totalTVA
      data.totalTTC = totalHT + totalTVA
    }

    // Status transition to restocked: update stock for conformant items
    if (status === 'restocked') {
      // First validate status must be validated
      if (existing.status !== 'validated') {
        return NextResponse.json({ error: 'Le retour doit être validé avant remise en stock' }, { status: 400 })
      }

      const returnLines = await db.customerReturnLine.findMany({
        where: { customerReturnId: id },
        include: { product: true },
      })

      const conformLines = returnLines.filter(
        (l) => l.qualityCheck === 'conforme' || l.qualityCheck === 'partiel'
      )

      if (conformLines.length === 0) {
        return NextResponse.json({ error: 'Aucune ligne conforme ou partielle à remettre en stock' }, { status: 400 })
      }

      const customerReturn = await db.$transaction(async (tx) => {
        for (const l of conformLines) {
          const qty = l.qualityCheck === 'partiel' ? Math.floor(l.quantity / 2) : l.quantity

          // Update product stock
          await tx.product.update({
            where: { id: l.productId },
            data: { currentStock: { increment: qty } },
          })

          // Create stock movement (in)
          await tx.stockMovement.create({
            data: {
              productId: l.productId,
              type: 'in',
              origin: 'return',
              quantity: qty,
              unitCost: l.unitPrice,
              documentRef: existing.number,
              notes: `Retour client ${existing.number} - contrôle: ${l.qualityCheck}`,
            },
          })
        }

        data.status = status
        return tx.customerReturn.update({
          where: { id },
          data,
          include: {
            client: true,
            deliveryNote: { select: { number: true } },
            invoice: { select: { number: true } },
            lines: { include: { product: true } },
          },
        })
      })

      await auditLog(auth.userId, 'update', 'CustomerReturn', id, existing, customerReturn)
      return NextResponse.json({ customerReturn })
    }

    if (status) {
      data.status = status
    }

    const customerReturn = await db.customerReturn.update({
      where: { id },
      data,
      include: {
        client: true,
        deliveryNote: { select: { number: true } },
        invoice: { select: { number: true } },
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'CustomerReturn', id, existing, customerReturn)
    return NextResponse.json({ customerReturn })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Customer return update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete customer return (only draft)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.customerReturn.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bon de retour introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seul un brouillon peut être supprimé' }, { status: 400 })
    }

    await db.customerReturn.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'CustomerReturn', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Customer return delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
