import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

// ─── Validation Schemas ───

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  tvaRate: z.number().min(0),
  salesOrderLineId: z.string().optional(),
})

const createFromOrderSchema = z.object({
  salesOrderId: z.string().min(1),
  transporteur: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
})

const createStandaloneSchema = z.object({
  clientId: z.string().min(1),
  transporteur: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Au moins une ligne est requise'),
})

// ─── Helper: generate BL number ───

async function generateBLNumber() {
  const blCount = await db.deliveryNote.count()
  const year = new Date().getFullYear()
  return `BL-${year}-${String(blCount + 1).padStart(4, '0')}`
}

// ─── Helper: common include for delivery note ───

const deliveryNoteInclude = {
  salesOrder: {
    include: {
      client: { select: { id: true, name: true, raisonSociale: true } },
      lines: {
        include: {
          product: { select: { id: true, reference: true, designation: true } },
        },
      },
    },
  },
  client: { select: { id: true, name: true, raisonSociale: true } },
  lines: {
    include: {
      product: { select: { id: true, reference: true, designation: true } },
    },
  },
}

// ═══════════════════════════════════════════════════════════
// GET - List / detail delivery notes
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const salesOrderId = searchParams.get('salesOrderId') || ''
    const standalone = searchParams.get('standalone') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (salesOrderId) where.salesOrderId = salesOrderId
    if (standalone === 'true') where.salesOrderId = null
    if (standalone === 'false') where.salesOrderId = { not: null }

    const [deliveryNotes, total] = await Promise.all([
      db.deliveryNote.findMany({
        where,
        include: deliveryNoteInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.deliveryNote.count({ where }),
    ])

    return NextResponse.json({ deliveryNotes, total, page, limit })
  } catch (error) {
    console.error('Delivery notes list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// POST - Create delivery note (from order OR standalone)
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ─── Mode 1: BL from existing sales order ───
    if (body.salesOrderId && !body.clientId) {
      const data = createFromOrderSchema.parse(body)

      const salesOrder = await db.salesOrder.findUnique({
        where: { id: data.salesOrderId },
        include: {
          lines: { include: { product: true } },
        },
      })

      if (!salesOrder) {
        return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
      }

      if (salesOrder.status !== 'prepared' && salesOrder.status !== 'partially_delivered') {
        return NextResponse.json(
          { error: 'Le bon de commande doit être en statut "préparé" ou "partiellement livré"' },
          { status: 400 }
        )
      }

      const blNumber = await generateBLNumber()
      let totalHT = 0
      let totalTVA = 0

      const deliveryNote = await db.$transaction(async (tx) => {
        const note = await tx.deliveryNote.create({
          data: {
            number: blNumber,
            salesOrderId: salesOrder.id,
            clientId: salesOrder.clientId,
            status: 'draft',
            transporteur: data.transporteur || null,
            vehiclePlate: data.vehiclePlate || null,
            notes: data.notes || null,
            totalHT: 0,
            totalTVA: 0,
            totalTTC: 0,
            lines: {
              create: salesOrder.lines.map((line) => {
                const lineHT = line.quantity * line.unitPrice
                const lineTVA = lineHT * (line.tvaRate / 100)
                totalHT += lineHT
                totalTVA += lineTVA

                return {
                  salesOrderLineId: line.id,
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  tvaRate: line.tvaRate,
                  totalHT: lineHT,
                }
              }),
            },
          },
          include: deliveryNoteInclude,
        })

        const totalTTC = totalHT + totalTVA
        await tx.deliveryNote.update({
          where: { id: note.id },
          data: { totalHT, totalTVA, totalTTC },
        })

        await tx.salesOrder.update({
          where: { id: salesOrder.id },
          data: { status: 'partially_delivered' },
        })

        return { ...note, totalHT, totalTVA, totalTTC }
      })

      await auditLog(auth.userId, 'create', 'DeliveryNote', deliveryNote.id, null, deliveryNote)
      return NextResponse.json(deliveryNote, { status: 201 })
    }

    // ─── Mode 2: Standalone BL (no sales order) ───
    if (body.clientId && !body.salesOrderId) {
      const data = createStandaloneSchema.parse(body)

      // Verify client exists
      const client = await db.client.findUnique({ where: { id: data.clientId } })
      if (!client) {
        return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
      }

      const blNumber = await generateBLNumber()
      let totalHT = 0
      let totalTVA = 0

      const deliveryNote = await db.$transaction(async (tx) => {
        const note = await tx.deliveryNote.create({
          data: {
            number: blNumber,
            clientId: data.clientId,
            status: 'draft',
            transporteur: data.transporteur || null,
            vehiclePlate: data.vehiclePlate || null,
            notes: data.notes || null,
            totalHT: 0,
            totalTVA: 0,
            totalTTC: 0,
            lines: {
              create: data.lines.map((line) => {
                const lineHT = line.quantity * line.unitPrice
                const lineTVA = lineHT * (line.tvaRate / 100)
                totalHT += lineHT
                totalTVA += lineTVA

                return {
                  salesOrderLineId: line.salesOrderLineId || null,
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  tvaRate: line.tvaRate,
                  totalHT: lineHT,
                }
              }),
            },
          },
          include: deliveryNoteInclude,
        })

        const totalTTC = totalHT + totalTVA
        await tx.deliveryNote.update({
          where: { id: note.id },
          data: { totalHT, totalTVA, totalTTC },
        })

        return { ...note, totalHT, totalTVA, totalTTC }
      })

      await auditLog(auth.userId, 'create', 'DeliveryNote', deliveryNote.id, null, deliveryNote)
      return NextResponse.json(deliveryNote, { status: 201 })
    }

    return NextResponse.json(
      { error: 'Fournissez soit salesOrderId soit clientId avec des lignes' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Delivery note create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT - Actions: confirm, deliver, cancel + simple update
// ═══════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: { lines: true, deliveryNotes: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bon de livraison introuvable' }, { status: 404 })
    }

    // Action: confirm
    if (action === 'confirm') {
      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Seul un brouillon peut être confirmé' },
          { status: 400 }
        )
      }

      const deliveryNote = await db.deliveryNote.update({
        where: { id },
        data: { status: 'confirmed', ...updateData },
        include: deliveryNoteInclude,
      })

      await auditLog(auth.userId, 'confirm', 'DeliveryNote', id, existing, deliveryNote)
      return NextResponse.json(deliveryNote)
    }

    // Action: deliver
    if (action === 'deliver') {
      if (existing.status !== 'confirmed' && existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Le bon de livraison doit être confirmé ou en brouillon pour être livré' },
          { status: 400 }
        )
      }

      const deliveryNote = await db.$transaction(async (tx) => {
        const now = new Date()
        const delivered = await tx.deliveryNote.update({
          where: { id },
          data: {
            status: 'delivered',
            deliveryDate: now,
            ...updateData,
          },
          include: deliveryNoteInclude,
        })

        // If linked to a sales order, check if all delivery notes are delivered
        if (existing.salesOrderId) {
          const allDeliveryNotes = await tx.deliveryNote.findMany({
            where: { salesOrderId: existing.salesOrderId },
          })

          const nonCancelledNotes = allDeliveryNotes.filter((dn) => dn.status !== 'cancelled')
          const allDelivered = nonCancelledNotes.every((dn) => dn.status === 'delivered')

          if (allDelivered) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'delivered' },
            })
          }
        }

        return delivered
      })

      await auditLog(auth.userId, 'deliver', 'DeliveryNote', id, existing, deliveryNote)
      return NextResponse.json(deliveryNote)
    }

    // Action: cancel
    if (action === 'cancel') {
      if (existing.status === 'delivered') {
        return NextResponse.json(
          { error: 'Impossible d\'annuler un bon de livraison déjà livré' },
          { status: 400 }
        )
      }

      const deliveryNote = await db.$transaction(async (tx) => {
        const cancelled = await tx.deliveryNote.update({
          where: { id },
          data: { status: 'cancelled' },
          include: deliveryNoteInclude,
        })

        // If linked to a sales order, revert SO status if needed
        if (existing.salesOrderId) {
          const remainingNotes = await tx.deliveryNote.findMany({
            where: {
              salesOrderId: existing.salesOrderId,
              status: { notIn: ['cancelled'] },
            },
          })

          if (remainingNotes.length === 0) {
            const salesOrderLines = await tx.salesOrderLine.findMany({
              where: { orderId: existing.salesOrderId },
            })
            const allPrepared = salesOrderLines.every((l) => l.quantityPrepared >= l.quantity)
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: allPrepared ? 'prepared' : 'in_preparation' },
            })
          }
        }

        return cancelled
      })

      await auditLog(auth.userId, 'cancel', 'DeliveryNote', id, existing, deliveryNote)
      return NextResponse.json(deliveryNote)
    }

    // Simple update (notes, transporteur, vehiclePlate)
    const deliveryNote = await db.deliveryNote.update({
      where: { id },
      data: updateData,
      include: deliveryNoteInclude,
    })

    await auditLog(auth.userId, 'update', 'DeliveryNote', id, existing, deliveryNote)
    return NextResponse.json(deliveryNote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Delivery note update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE - Delete draft/cancelled delivery notes
// ═══════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.deliveryNote.findUnique({
      where: { id },
      include: { salesOrder: { include: { deliveryNotes: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bon de livraison introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft' && existing.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Seuls les brouillons ou bons annulés peuvent être supprimés' },
        { status: 400 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryNote.delete({ where: { id } })

      // If linked to a sales order, revert SO status if needed
      if (existing.salesOrderId) {
        const remainingNotes = await tx.deliveryNote.findMany({
          where: { salesOrderId: existing.salesOrderId },
        })

        if (remainingNotes.length === 0) {
          const salesOrderLines = await tx.salesOrderLine.findMany({
            where: { orderId: existing.salesOrderId },
          })
          const allPrepared = salesOrderLines.every((l) => l.quantityPrepared >= l.quantity)
          await tx.salesOrder.update({
            where: { id: existing.salesOrderId },
            data: { status: allPrepared ? 'prepared' : 'in_preparation' },
          })
        }
      }
    })

    await auditLog(auth.userId, 'delete', 'DeliveryNote', id, existing, null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delivery note delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
