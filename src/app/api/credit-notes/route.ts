import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const creditNoteLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
})

const creditNoteSchema = z.object({
  invoiceId: z.string(),
  reason: z.string().optional(),
  lines: z.array(creditNoteLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateCreditNoteNumber(): Promise<string> {
  const count = await db.creditNote.count()
  const year = new Date().getFullYear()
  return `AV-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List credit notes
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const invoiceId = searchParams.get('invoiceId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (invoiceId) where.invoiceId = invoiceId

    const [creditNotes, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.creditNote.count({ where }),
    ])

    return NextResponse.json({ creditNotes, total, page, limit })
  } catch (error) {
    console.error('Credit notes list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create credit note
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = creditNoteSchema.parse(body)

    const invoice = await db.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { client: true },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
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

    const number = await generateCreditNoteNumber()

    const creditNote = await db.creditNote.create({
      data: {
        number,
        invoiceId: data.invoiceId,
        clientId: invoice.clientId,
        status: 'draft',
        reason: data.reason,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        client: true,
        invoice: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'CreditNote', creditNote.id, null, creditNote)
    return NextResponse.json(creditNote, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Credit note create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update credit note
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.creditNote.findUnique({
      where: { id },
      include: { client: true, invoice: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Avoir introuvable' }, { status: 404 })
    }

    // Validate credit note
    if (action === 'validate') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Seul un avoir en brouillon peut être validé' }, { status: 400 })
      }

      // Update client balance (reduce)
      await db.client.update({
        where: { id: existing.clientId },
        data: { balance: { decrement: existing.totalTTC } },
      })

      const creditNote = await db.creditNote.update({
        where: { id },
        data: { status: 'validated' },
        include: {
          client: true,
          invoice: true,
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'validate', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // Apply credit note
    if (action === 'apply') {
      if (existing.status !== 'validated') {
        return NextResponse.json({ error: 'L\'avoir doit être validé' }, { status: 400 })
      }

      const creditNote = await db.creditNote.update({
        where: { id },
        data: { status: 'applied' },
        include: {
          client: true,
          invoice: true,
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'apply', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // Cancel credit note
    if (action === 'cancel') {
      if (existing.status === 'applied') {
        return NextResponse.json({ error: 'Impossible d\'annuler un avoir appliqué' }, { status: 400 })
      }

      // Reverse client balance if validated
      if (existing.status === 'validated') {
        await db.client.update({
          where: { id: existing.clientId },
          data: { balance: { increment: existing.totalTTC } },
        })
      }

      const creditNote = await db.creditNote.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          client: true,
          invoice: true,
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'cancel', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // Data editing (reason, lines)
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seul un avoir en brouillon peut être modifié' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (updateData.reason !== undefined) data.reason = updateData.reason

    // If lines are provided, replace them and recalculate totals
    if (updateData.lines && Array.isArray(updateData.lines) && updateData.lines.length > 0) {
      const parsedLines = z.array(creditNoteLineSchema).parse(updateData.lines)

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

      await db.creditNoteLine.deleteMany({ where: { creditNoteId: id } })
      data.lines = { create: linesData }
      data.totalHT = totalHT
      data.totalTVA = totalTVA
      data.totalTTC = totalHT + totalTVA
    }

    const creditNote = await db.creditNote.update({
      where: { id },
      data,
      include: {
        client: true,
        invoice: true,
        lines: { include: { product: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'CreditNote', id, existing, creditNote)
    return NextResponse.json(creditNote)
  } catch (error) {
    console.error('Credit note update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete credit note
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.creditNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Avoir introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seul un avoir en brouillon peut être supprimé' }, { status: 400 })
    }

    await db.creditNoteLine.deleteMany({ where: { creditNoteId: id } })
    await db.creditNote.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'CreditNote', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Credit note delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
