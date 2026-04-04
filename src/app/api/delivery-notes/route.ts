import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

// ─── Validation Schemas ───

const partialLineSchema = z.object({
  salesOrderLineId: z.string().min(1),
  quantity: z.number().positive(),
})

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
  plannedDate: z.string().optional(),
  lines: z.array(partialLineSchema).optional(),
})

const createStandaloneSchema = z.object({
  clientId: z.string().min(1),
  transporteur: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
  plannedDate: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Au moins une ligne est requise'),
})

// ─── Helper: generate BL number ───

async function generateBLNumber() {
  const blCount = await db.deliveryNote.count()
  const year = new Date().getFullYear()
  return `BL-${year}-${String(blCount + 1).padStart(4, '0')}`
}

// ─── Helper: compute delivery tracking for sales order lines ───

function computeDeliveryTracking(orderLines: { id: string; quantity: number; quantityDelivered: number }[]) {
  return orderLines.map((line) => {
    const remaining = Math.max(0, line.quantity - line.quantityDelivered)
    const deliveryPercentage = line.quantity > 0 ? Math.min(100, Math.round((line.quantityDelivered / line.quantity) * 100)) : 0
    return {
      ...line,
      remainingQuantity: remaining,
      deliveryPercentage,
    }
  })
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
      salesOrderLine: {
        select: {
          id: true,
          quantity: true,
          quantityDelivered: true,
          quantityPrepared: true,
          unitPrice: true,
          tvaRate: true,
        },
      },
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

    // Enrich with delivery tracking data
    const enrichedNotes = deliveryNotes.map((note) => {
      const enriched = { ...note }

      // If linked to a sales order, compute delivery tracking for order lines
      if (enriched.salesOrder) {
        const orderLinesWithTracking = computeDeliveryTracking(
          enriched.salesOrder.lines.map((l) => ({
            id: l.id,
            quantity: l.quantity,
            quantityDelivered: l.quantityDelivered,
          }))
        )
        ;(enriched as Record<string, unknown>).salesOrderLinesTracking = orderLinesWithTracking
      }

      // For each BL line linked to a sales order line, compute remaining
      ;(enriched as Record<string, unknown>).lines = enriched.lines.map((blLine) => ({
        ...blLine,
        previouslyDelivered: blLine.salesOrderLine ? blLine.salesOrderLine.quantityDelivered - blLine.quantity : 0,
        remainingAfterDelivery: blLine.salesOrderLine
          ? Math.max(0, blLine.salesOrderLine.quantity - blLine.salesOrderLine.quantityDelivered)
          : null,
      }))

      return enriched
    })

    return NextResponse.json({ deliveryNotes: enrichedNotes, total, page, limit })
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
          lines: {
            include: { product: true },
          },
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

      // Determine which lines to deliver
      let linesToDeliver: { salesOrderLineId: string; quantity: number }[] = []

      if (data.lines && data.lines.length > 0) {
        // Partial delivery: use user-specified lines
        for (const reqLine of data.lines) {
          const orderLine = salesOrder.lines.find((l) => l.id === reqLine.salesOrderLineId)
          if (!orderLine) {
            return NextResponse.json(
              { error: `Ligne de commande introuvable: ${reqLine.salesOrderLineId}` },
              { status: 400 }
            )
          }
          const remaining = orderLine.quantity - orderLine.quantityDelivered
          if (remaining <= 0) {
            return NextResponse.json(
              { error: `La ligne "${orderLine.product?.designation || orderLine.id}" est déjà entièrement livrée` },
              { status: 400 }
            )
          }
          if (reqLine.quantity > remaining) {
            return NextResponse.json(
              {
                error: `Quantité invalide pour "${orderLine.product?.designation || orderLine.id}": ` +
                  `maximum ${remaining} (restant), demandé ${reqLine.quantity}`,
              },
              { status: 400 }
            )
          }
          linesToDeliver.push({ salesOrderLineId: reqLine.salesOrderLineId, quantity: reqLine.quantity })
        }
      } else {
        // Auto-fill: all lines with remaining quantities
        for (const orderLine of salesOrder.lines) {
          const remaining = orderLine.quantity - orderLine.quantityDelivered
          if (remaining > 0) {
            linesToDeliver.push({ salesOrderLineId: orderLine.id, quantity: remaining })
          }
        }
      }

      if (linesToDeliver.length === 0) {
        return NextResponse.json(
          { error: 'Toutes les lignes de la commande sont déjà entièrement livrées' },
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
            plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
            totalHT: 0,
            totalTVA: 0,
            totalTTC: 0,
            lines: {
              create: linesToDeliver.map((dl) => {
                const orderLine = salesOrder.lines.find((l) => l.id === dl.salesOrderLineId)!
                const lineHT = dl.quantity * orderLine.unitPrice
                const lineTVA = lineHT * (orderLine.tvaRate / 100)
                totalHT += lineHT
                totalTVA += lineTVA

                return {
                  salesOrderLineId: dl.salesOrderLineId,
                  productId: orderLine.productId,
                  quantity: dl.quantity,
                  unitPrice: orderLine.unitPrice,
                  tvaRate: orderLine.tvaRate,
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

        // Update quantityDelivered on SalesOrderLine
        for (const dl of linesToDeliver) {
          await tx.salesOrderLine.update({
            where: { id: dl.salesOrderLineId },
            data: {
              quantityDelivered: {
                increment: dl.quantity,
              },
            },
          })
        }

        // Update SO status based on delivery progress
        const updatedLines = await tx.salesOrderLine.findMany({
          where: { orderId: salesOrder.id },
        })
        const allFullyDelivered = updatedLines.every(
          (l) => l.quantityDelivered >= l.quantity
        )
        if (allFullyDelivered) {
          await tx.salesOrder.update({
            where: { id: salesOrder.id },
            data: { status: 'delivered' },
          })
        } else {
          await tx.salesOrder.update({
            where: { id: salesOrder.id },
            data: { status: 'partially_delivered' },
          })
        }

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
            plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
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

        // If lines are linked to sales order lines, update quantityDelivered
        for (const line of data.lines) {
          if (line.salesOrderLineId) {
            await tx.salesOrderLine.update({
              where: { id: line.salesOrderLineId },
              data: {
                quantityDelivered: { increment: line.quantity },
              },
            })
          }
        }

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
    const { id, action, plannedDate, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        lines: { include: { salesOrderLine: true } },
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

      const updatePayload: Record<string, unknown> = { status: 'confirmed' }
      // Allow updating plannedDate on confirm
      if (plannedDate) {
        updatePayload.plannedDate = new Date(plannedDate)
      }
      if (updateData.transporteur !== undefined) updatePayload.transporteur = updateData.transporteur
      if (updateData.vehiclePlate !== undefined) updatePayload.vehiclePlate = updateData.vehiclePlate
      if (updateData.notes !== undefined) updatePayload.notes = updateData.notes

      const deliveryNote = await db.deliveryNote.update({
        where: { id },
        data: updatePayload,
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
          },
          include: deliveryNoteInclude,
        })

        // If linked to a sales order, update quantityDelivered (if not already done at creation)
        // and check if all lines are fully delivered
        if (existing.salesOrderId) {
          // Get all non-cancelled delivery notes for this SO
          const allDeliveryNotes = await tx.deliveryNote.findMany({
            where: {
              salesOrderId: existing.salesOrderId,
              status: { not: 'cancelled' },
            },
            include: { lines: true },
          })

          // Recalculate total delivered per SO line
          const deliveredQtyMap: Record<string, number> = {}
          for (const dn of allDeliveryNotes) {
            for (const line of dn.lines) {
              if (line.salesOrderLineId) {
                deliveredQtyMap[line.salesOrderLineId] = (deliveredQtyMap[line.salesOrderLineId] || 0) + line.quantity
              }
            }
          }

          // Check if all SO lines are fully delivered
          const salesOrderLines = await tx.salesOrderLine.findMany({
            where: { orderId: existing.salesOrderId },
          })

          const allFullyDelivered = salesOrderLines.every((sol) => {
            const delivered = deliveredQtyMap[sol.id] || 0
            return delivered >= sol.quantity
          })

          // Sync quantityDelivered on SalesOrderLine
          for (const sol of salesOrderLines) {
            const delivered = deliveredQtyMap[sol.id] || 0
            if (sol.quantityDelivered !== delivered) {
              await tx.salesOrderLine.update({
                where: { id: sol.id },
                data: { quantityDelivered: delivered },
              })
            }
          }

          if (allFullyDelivered) {
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

        // If linked to a sales order, revert quantityDelivered
        if (existing.salesOrderId) {
          // Decrement quantityDelivered for each BL line
          for (const line of existing.lines) {
            if (line.salesOrderLineId) {
              await tx.salesOrderLine.update({
                where: { id: line.salesOrderLineId },
                data: {
                  quantityDelivered: {
                    decrement: line.quantity,
                  },
                },
              })
            }
          }

          // Recalculate SO status
          const remainingNotes = await tx.deliveryNote.findMany({
            where: {
              salesOrderId: existing.salesOrderId,
              status: { notIn: ['cancelled'] },
            },
          })

          if (remainingNotes.length === 0) {
            // No active BLs left, revert SO
            const salesOrderLines = await tx.salesOrderLine.findMany({
              where: { orderId: existing.salesOrderId },
            })
            const allPrepared = salesOrderLines.every((l) => l.quantityPrepared >= l.quantity)
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: allPrepared ? 'prepared' : 'in_preparation' },
            })
          } else {
            // Still has active BLs, check if any line has remaining delivery
            const allDeliveryNotes = await tx.deliveryNote.findMany({
              where: {
                salesOrderId: existing.salesOrderId,
                status: { not: 'cancelled' },
              },
              include: { lines: true },
            })
            const deliveredQtyMap: Record<string, number> = {}
            for (const dn of allDeliveryNotes) {
              for (const line of dn.lines) {
                if (line.salesOrderLineId) {
                  deliveredQtyMap[line.salesOrderLineId] = (deliveredQtyMap[line.salesOrderLineId] || 0) + line.quantity
                }
              }
            }
            const salesOrderLines = await tx.salesOrderLine.findMany({
              where: { orderId: existing.salesOrderId },
            })
            const anyDelivered = salesOrderLines.some((sol) => (deliveredQtyMap[sol.id] || 0) > 0)
            if (!anyDelivered) {
              const allPrepared = salesOrderLines.every((l) => l.quantityPrepared >= l.quantity)
              await tx.salesOrder.update({
                where: { id: existing.salesOrderId },
                data: { status: allPrepared ? 'prepared' : 'in_preparation' },
              })
            }
          }
        }

        return cancelled
      })

      await auditLog(auth.userId, 'cancel', 'DeliveryNote', id, existing, deliveryNote)
      return NextResponse.json(deliveryNote)
    }

    // Simple update (notes, transporteur, vehiclePlate, plannedDate)
    const simpleUpdateData: Record<string, unknown> = {}
    if (updateData.transporteur !== undefined) simpleUpdateData.transporteur = updateData.transporteur
    if (updateData.vehiclePlate !== undefined) simpleUpdateData.vehiclePlate = updateData.vehiclePlate
    if (updateData.notes !== undefined) simpleUpdateData.notes = updateData.notes
    if (plannedDate) simpleUpdateData.plannedDate = new Date(plannedDate)

    const deliveryNote = await db.deliveryNote.update({
      where: { id },
      data: simpleUpdateData,
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
      include: {
        lines: { include: { salesOrderLine: true } },
        salesOrder: { include: { deliveryNotes: true } },
      },
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
      // Revert quantityDelivered for linked lines (only for drafts, cancelled already reverted)
      if (existing.status === 'draft') {
        for (const line of existing.lines) {
          if (line.salesOrderLineId) {
            await tx.salesOrderLine.update({
              where: { id: line.salesOrderLineId },
              data: {
                quantityDelivered: {
                  decrement: line.quantity,
                },
              },
            })
          }
        }
      }

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
