import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'
import { syncClientBalance } from '@/lib/client-balance'

// ── Schemas ──────────────────────────────────────────────

const creditNoteLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
  customerReturnLineId: z.string().optional(),
})

const createFromReturnsSchema = z.object({
  customerReturnIds: z.array(z.string()).min(1, 'Sélectionnez au moins un retour'),
  reason: z.string().optional(),
})

// ── Number generation ───────────────────────────────────

async function generateCreditNoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `AV-${year}-`
  const last = await db.creditNote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let next = 1
  if (last) {
    const numPart = last.number.replace(prefix, '')
    const parsed = parseInt(numPart, 10)
    if (!isNaN(parsed)) next = parsed + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

// ── GET - List credit notes ──────────────────────────────

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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const availableOnly = searchParams.get('available') === 'true' // avoirs with remaining balance

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    if (availableOnly) {
      // Credit notes that have been validated and still have remaining balance
      where.status = { in: ['validated', 'partially_applied'] }
    }

    const [creditNotes, total] = await Promise.all([
      db.creditNote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, raisonSociale: true } },
          customerReturns: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
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

// ── POST - Create credit note (from customer returns) ───

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // Support both creation modes
    const isFromReturns = Array.isArray(body.customerReturnIds) && body.customerReturnIds.length > 0

    if (isFromReturns) {
      const data = createFromReturnsSchema.parse(body)

      // Fetch all selected returns — they must be restocked
      const returns = await db.customerReturn.findMany({
        where: { id: { in: data.customerReturnIds } },
        include: {
          client: true,
          deliveryNote: { select: { id: true, number: true } },
          lines: { include: { product: true } },
        },
      })

      if (returns.length !== data.customerReturnIds.length) {
        return NextResponse.json({ error: 'Un ou plusieurs retours introuvables' }, { status: 404 })
      }

      // All must belong to the same client
      const clientIds = [...new Set(returns.map((r) => r.clientId))]
      if (clientIds.length > 1) {
        return NextResponse.json({ error: 'Les retours doivent appartenir au même client' }, { status: 400 })
      }

      // All must be restocked
      const nonRestocked = returns.filter((r) => r.status !== 'restocked')
      if (nonRestocked.length > 0) {
        return NextResponse.json({ error: 'Seuls les retours remis en stock peuvent être utilisés' }, { status: 400 })
      }

      // Build lines from return lines (only conforme/partiel)
      let totalHT = 0
      let totalTVA = 0
      const linesData: Array<{
        productId: string
        quantity: number
        unitPrice: number
        tvaRate: number
        totalHT: number
        customerReturnLineId: string
      }> = []

      for (const ret of returns) {
        for (const line of ret.lines) {
          if (line.qualityCheck === 'conforme' || line.qualityCheck === 'partiel') {
            const qty = line.qualityCheck === 'partiel' ? Math.floor(line.quantity / 2) : line.quantity
            const lineHT = qty * (line.unitPrice || 0)
            const lineTVA = lineHT * ((line.tvaRate || 20) / 100)
            totalHT += lineHT
            totalTVA += lineTVA
            linesData.push({
              productId: line.productId,
              quantity: qty,
              unitPrice: line.unitPrice || 0,
              tvaRate: line.tvaRate || 20,
              totalHT: lineHT,
              customerReturnLineId: line.id,
            })
          }
        }
      }

      if (linesData.length === 0) {
        return NextResponse.json({ error: 'Aucun article conforme ou partiel dans les retours sélectionnés' }, { status: 400 })
      }

      const number = await generateCreditNoteNumber()

      const creditNote = await db.creditNote.create({
        data: {
          number,
          clientId: returns[0].clientId,
          status: 'draft',
          reason: data.reason || `Avoir sur retours ${returns.map((r) => r.number).join(', ')}`,
          totalHT,
          totalTVA,
          totalTTC: totalHT + totalTVA,
          lines: { create: linesData },
          customerReturns: { connect: returns.map((r) => ({ id: r.id })) },
        },
        include: {
          client: true,
          customerReturns: { select: { id: true, number: true } },
          lines: { include: { product: true } },
        },
      })

      await auditLog(auth.userId, 'create', 'CreditNote', creditNote.id, null, creditNote)
      notifyAll({ title: 'Nouvel avoir client', message: `Avoir ${creditNote.number}`, type: 'success', category: 'payment', entityType: 'CreditNote', entityId: creditNote.id }).catch(() => {})
      return NextResponse.json(creditNote, { status: 201 })
    }

    // Legacy: create from invoice (backward compat)
    return NextResponse.json({ error: 'Utilisez customerReturnIds pour créer un avoir depuis des retours' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Credit note create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── PUT - Update credit note / Status actions ──────────────

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
      include: { client: true, lines: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Avoir introuvable' }, { status: 404 })
    }

    // ── VALIDATE ──
    if (action === 'validate') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Seul un avoir en brouillon peut être validé' }, { status: 400 })
      }

      const creditNote = await db.creditNote.update({
        where: { id },
        data: { status: 'validated' },
        include: {
          client: true,
          customerReturns: { select: { id: true, number: true } },
          lines: { include: { product: true } },
        },
      })

      // Sync client balance
      await syncClientBalance(existing.clientId)

      await auditLog(auth.userId, 'validate', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // ── REFUND ──
    if (action === 'refund') {
      if (existing.status !== 'validated' && existing.status !== 'partially_applied') {
        return NextResponse.json({ error: 'L\'avoir doit être validé pour être remboursé' }, { status: 400 })
      }

      const refundAmount = body.refundAmount || (existing.totalTTC - existing.amountUsed - existing.amountRefunded)
      if (refundAmount <= 0) {
        return NextResponse.json({ error: 'Montant de remboursement invalide' }, { status: 400 })
      }

      const creditNote = await db.$transaction(async (tx) => {
        const updated = await tx.creditNote.update({
          where: { id },
          data: {
            amountRefunded: { increment: refundAmount },
            status: (existing.totalTTC - existing.amountUsed) <= (existing.amountRefunded + refundAmount) ? 'refunded' : existing.status,
          },
          include: {
            client: true,
            customerReturns: { select: { id: true, number: true } },
            lines: { include: { product: true } },
          },
        })

        // If fully refunded, sync balance
        if (updated.status === 'refunded') {
          await syncClientBalance(existing.clientId)
        }

        return updated
      })

      await auditLog(auth.userId, 'refund', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // ── APPLY TO INVOICE ──
    if (action === 'apply_to_invoice') {
      if (existing.status !== 'validated' && existing.status !== 'partially_applied') {
        return NextResponse.json({ error: 'L\'avoir doit être validé' }, { status: 400 })
      }

      const { invoiceId, amount } = body
      if (!invoiceId || !amount || amount <= 0) {
        return NextResponse.json({ error: 'Facture et montant requis' }, { status: 400 })
      }

      const available = existing.totalTTC - existing.amountUsed - existing.amountRefunded
      if (amount > available) {
        return NextResponse.json({ error: `Montant disponible: ${available.toFixed(2)} MAD` }, { status: 400 })
      }

      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
      }
      if (invoice.clientId !== existing.clientId) {
        return NextResponse.json({ error: 'La facture n\'appartient pas au même client' }, { status: 400 })
      }

      const creditNote = await db.$transaction(async (tx) => {
        const newAmountUsed = existing.amountUsed + amount
        const totalUsedRefunded = newAmountUsed + existing.amountRefunded
        const newStatus = totalUsedRefunded >= existing.totalTTC ? 'applied' : 'partially_applied'

        const updated = await tx.creditNote.update({
          where: { id },
          data: {
            amountUsed: newAmountUsed,
            status: newStatus,
            invoiceId: invoice.id,
          },
          include: {
            client: true,
            customerReturns: { select: { id: true, number: true } },
            lines: { include: { product: true } },
          },
        })

        // Update invoice amountPaid
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: { increment: amount },
            status: ((invoice.amountPaid || 0) + amount) >= invoice.totalTTC ? 'paid' : 'partially_paid',
          },
        })

        await syncClientBalance(existing.clientId)

        return updated
      })

      await auditLog(auth.userId, 'apply_to_invoice', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // ── CANCEL ──
    if (action === 'cancel') {
      if (['applied', 'refunded'].includes(existing.status)) {
        return NextResponse.json({ error: 'Impossible d\'annuler un avoir appliqué ou remboursé' }, { status: 400 })
      }

      const creditNote = await db.creditNote.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          client: true,
          customerReturns: { select: { id: true, number: true } },
          lines: { include: { product: true } },
        },
      })

      await syncClientBalance(existing.clientId)
      await auditLog(auth.userId, 'cancel', 'CreditNote', id, existing, creditNote)
      return NextResponse.json(creditNote)
    }

    // ── EDIT (draft only) ──
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seul un avoir en brouillon peut être modifié' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (updateData.reason !== undefined) data.reason = updateData.reason

    // Replace lines
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
          customerReturnLineId: line.customerReturnLineId || null,
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
        customerReturns: { select: { id: true, number: true } },
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

// ── DELETE - Delete credit note (draft only) ───────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
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
