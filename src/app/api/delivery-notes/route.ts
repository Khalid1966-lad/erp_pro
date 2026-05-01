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
  lines: z.array(z.object({
    salesOrderLineId: z.string().optional(),
    productId: z.string().optional(),
    quantity: z.number().min(0.01),
    unitPrice: z.number().min(0).optional(),
    tvaRate: z.number().min(0).optional(),
  })).min(1, 'Au moins une ligne est requise'),
  chantierId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  transporteur: z.string().optional(),
  vehiclePlate: z.string().optional(),
  driverName: z.string().optional(),
  transportType: z.string().optional(),
  plannedDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

const createStandaloneSchema = z.object({
  clientId: z.string().min(1),
  chantierId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  transporteur: z.string().optional(),
  vehiclePlate: z.string().optional(),
  driverName: z.string().optional(),
  transportType: z.string().optional(),
  plannedDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Au moins une ligne est requise'),
})

// Schema for editing lines: existing lines have `id`, new lines don't
const editLineSchema = z.object({
  id: z.string().optional(), // existing line id (omitted for new lines)
  salesOrderLineId: z.string().optional(),
  productId: z.string().min(1),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().min(0),
})

const editLinesSchema = z.object({
  id: z.string().min(1),
  action: z.literal('edit_lines'),
  lines: z.array(editLineSchema).min(1, 'Au moins une ligne est requise'),
  chantierId: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  transporteur: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  transportType: z.string().nullable().optional(),
  plannedDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
      client: { select: { id: true, name: true, raisonSociale: true, address: true, city: true } },
      lines: {
        include: {
          product: { select: { id: true, reference: true, designation: true } },
        },
      },
    },
  },
  client: { select: { id: true, name: true, raisonSociale: true, address: true, city: true } },
  chantier: { select: { id: true, nomProjet: true, adresse: true, ville: true, codePostal: true, provincePrefecture: true, responsableNom: true, responsableFonction: true, telephone: true, gsm: true } },
  lines: {
    include: {
      product: { select: { id: true, reference: true, designation: true } },
    },
  },
}

// ─── Helper: create stock movement ───
async function createStockMovement(
  tx: any,
  productId: string,
  type: 'in' | 'out',
  quantity: number,
  origin: string,
  documentRef: string,
  notes?: string
) {
  // Update product stock
  await tx.product.update({
    where: { id: productId },
    data: {
      currentStock: type === 'out'
        ? { decrement: quantity }
        : { increment: quantity },
    },
  })
  // Create stock movement record
  await tx.stockMovement.create({
    data: {
      productId,
      type,
      origin: origin as any,
      quantity,
      documentRef,
      notes: notes || null,
    },
  })
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
    const chantierId = searchParams.get('chantierId') || ''
    const salesOrderId = searchParams.get('salesOrderId') || ''
    const standalone = searchParams.get('standalone') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (chantierId) where.chantierId = chantierId
    if (salesOrderId) where.salesOrderId = salesOrderId
    if (standalone === 'true') where.salesOrderId = null
    if (standalone === 'false') where.salesOrderId = { not: null }
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { raisonSociale: { contains: search, mode: 'insensitive' } } },
        { salesOrder: { number: { contains: search, mode: 'insensitive' } } },
        { transporteur: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [deliveryNotes, total] = await Promise.all([
      db.deliveryNote.findMany({
        where,
        include: deliveryNoteInclude,
        orderBy: { createdAt: 'asc' },
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
// POST - Create delivery note (from order with per-line qty OR standalone)
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ─── Mode 1: BL from existing sales order (with per-line quantities) ───
    if (body.salesOrderId && !body.clientId) {
      const data = createFromOrderSchema.parse(body)

      const salesOrder = await db.salesOrder.findUnique({
        where: { id: data.salesOrderId },
        include: {
          lines: { include: { product: true } },
          deliveryNotes: true,
          client: true,
        },
      })

      if (!salesOrder) {
        return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
      }

      if (salesOrder.status !== 'prepared' && salesOrder.status !== 'partially_delivered' && salesOrder.status !== 'delivered') {
        return NextResponse.json(
          { error: 'Le bon de commande doit être en statut "préparé", "partiellement livré" ou "livré"' },
          { status: 400 }
        )
      }

      // Validate each order line's quantity against remaining (ordered - already delivered)
      for (const line of data.lines) {
        if (!line.salesOrderLineId) continue // supplementary line, skip validation
        const soLine = salesOrder.lines.find((l) => l.id === line.salesOrderLineId)
        if (!soLine) {
          return NextResponse.json({ error: `Ligne de commande introuvable: ${line.salesOrderLineId}` }, { status: 400 })
        }
        const remaining = soLine.quantity - soLine.quantityDelivered
        if (line.quantity > remaining + 0.001) {
          return NextResponse.json({
            error: `Quantité ${line.quantity} dépasse le restant (${remaining}) pour ${soLine.product?.designation || 'produit'}`
          }, { status: 400 })
        }
      }

      // Validate supplementary lines have productId, unitPrice, tvaRate
      for (const line of data.lines) {
        if (line.salesOrderLineId) continue // order line, already validated
        if (!line.productId || line.unitPrice === undefined || line.tvaRate === undefined) {
          return NextResponse.json({ error: 'Les lignes supplémentaires doivent avoir productId, unitPrice et tvaRate' }, { status: 400 })
        }
      }

      const blNumber = await generateBLNumber()
      let totalHT = 0
      let totalTVA = 0

      const deliveryNote = await db.$transaction(async (tx) => {
        // Create delivery note
        const note = await tx.deliveryNote.create({
          data: {
            number: blNumber,
            salesOrderId: salesOrder.id,
            clientId: salesOrder.clientId,
            chantierId: data.chantierId || null,
            deliveryAddress: data.deliveryAddress || null,
            status: 'draft',
            transporteur: data.transporteur || null,
            vehiclePlate: data.vehiclePlate || null,
            driverName: data.driverName || null,
            transportType: data.transportType || null,
            plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            createdByName: auth.name || null,
            notes: data.notes || null,
            totalHT: 0,
            totalTVA: 0,
            totalTTC: 0,
            lines: {
              create: data.lines.map((line) => {
                if (line.salesOrderLineId) {
                  // Order line: get info from sales order line
                  const soLine = salesOrder.lines.find((l) => l.id === line.salesOrderLineId)!
                  const lineHT = line.quantity * soLine.unitPrice
                  const lineTVA = lineHT * (soLine.tvaRate / 100)
                  totalHT += lineHT
                  totalTVA += lineTVA

                  return {
                    salesOrderLineId: line.salesOrderLineId,
                    productId: soLine.productId,
                    quantity: line.quantity,
                    unitPrice: soLine.unitPrice,
                    tvaRate: soLine.tvaRate,
                    totalHT: lineHT,
                  }
                } else {
                  // Supplementary (free) line
                  const unitPrice = line.unitPrice!
                  const tvaRate = line.tvaRate!
                  const lineHT = line.quantity * unitPrice
                  const lineTVA = lineHT * (tvaRate / 100)
                  totalHT += lineHT
                  totalTVA += lineTVA

                  return {
                    salesOrderLineId: null,
                    productId: line.productId,
                    quantity: line.quantity,
                    unitPrice,
                    tvaRate,
                    totalHT: lineHT,
                  }
                }
              }),
            },
          },
          include: deliveryNoteInclude,
        })

        // Update totals
        const totalTTC = totalHT + totalTVA
        await tx.deliveryNote.update({
          where: { id: note.id },
          data: { totalHT, totalTVA, totalTTC },
        })

        // Update SO status to partially_delivered if needed
        if (salesOrder.status === 'prepared') {
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
            chantierId: data.chantierId || null,
            deliveryAddress: data.deliveryAddress || null,
            status: 'draft',
            transporteur: data.transporteur || null,
            vehiclePlate: data.vehiclePlate || null,
            driverName: data.driverName || null,
            transportType: data.transportType || null,
            plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            createdByName: auth.name || null,
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
// PUT - Actions: confirm, deliver, cancel, edit_lines + simple update
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
        lines: { include: { product: true } },
        salesOrder: {
          include: { lines: true, deliveryNotes: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bon de livraison introuvable' }, { status: 404 })
    }

    // ═════════════════════════════════════════════════════════
    // Action: edit_lines — Edit BL lines + header with cascading
    // ═════════════════════════════════════════════════════════
    if (action === 'edit_lines') {
      const data = editLinesSchema.parse(body)

      // Only draft, confirmed, or delivered can be edited
      if (existing.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Impossible de modifier un BL annulé' },
          { status: 400 }
        )
      }

      const isDelivered = existing.status === 'delivered'
      const blNumber = existing.number

      const result = await db.$transaction(async (tx) => {
        // Build a map of old lines for delta calculation
        const oldLinesMap = new Map(existing.lines.map(l => [l.id, l]))

        // Track deltas for SO delivered qty and stock
        const soLineDeltas = new Map<string, number>() // salesOrderLineId -> delta
        const stockDeltas = new Map<string, number>() // productId -> delta

        // Process new lines: identify updates, creates, and deletes
        const existingLineIds = new Set(data.lines.filter(l => l.id).map(l => l.id!))
        const linesToDelete = existing.lines.filter(l => !existingLineIds.has(l.id))

        let totalHT = 0
        let totalTVA = 0

        // 1. Update existing lines
        for (const newLine of data.lines) {
          if (!newLine.id) continue // will be created below

          const oldLine = oldLinesMap.get(newLine.id)
          if (!oldLine) continue

          const lineHT = newLine.quantity * newLine.unitPrice
          const lineTVA = lineHT * (newLine.tvaRate / 100)
          totalHT += lineHT
          totalTVA += lineTVA

          await tx.deliveryNoteLine.update({
            where: { id: newLine.id },
            data: {
              quantity: newLine.quantity,
              unitPrice: newLine.unitPrice,
              tvaRate: newLine.tvaRate,
              totalHT: lineHT,
            },
          })

          // Calculate delta for cascading
          const qtyDelta = newLine.quantity - oldLine.quantity
          if (isDelivered && Math.abs(qtyDelta) > 0.001) {
            // Track SO line delta
            if (oldLine.salesOrderLineId) {
              const prev = soLineDeltas.get(oldLine.salesOrderLineId) || 0
              soLineDeltas.set(oldLine.salesOrderLineId, prev + qtyDelta)
            }
            // Track stock delta
            const prevStock = stockDeltas.get(oldLine.productId) || 0
            stockDeltas.set(oldLine.productId, prevStock + qtyDelta)
          }
        }

        // 2. Create new lines (no id = new line)
        for (const newLine of data.lines) {
          if (newLine.id) continue // already processed above

          const lineHT = newLine.quantity * newLine.unitPrice
          const lineTVA = lineHT * (newLine.tvaRate / 100)
          totalHT += lineHT
          totalTVA += lineTVA

          await tx.deliveryNoteLine.create({
            data: {
              deliveryNoteId: id,
              salesOrderLineId: newLine.salesOrderLineId || null,
              productId: newLine.productId,
              quantity: newLine.quantity,
              unitPrice: newLine.unitPrice,
              tvaRate: newLine.tvaRate,
              totalHT: lineHT,
            },
          })

          // For delivered BL: new lines need stock out + SO delivered qty increment
          if (isDelivered) {
            if (newLine.salesOrderLineId) {
              const prev = soLineDeltas.get(newLine.salesOrderLineId) || 0
              soLineDeltas.set(newLine.salesOrderLineId, prev + newLine.quantity)
            }
            const prevStock = stockDeltas.get(newLine.productId) || 0
            stockDeltas.set(newLine.productId, prevStock + newLine.quantity)
          }
        }

        // 3. Delete removed lines
        for (const removedLine of linesToDelete) {
          await tx.deliveryNoteLine.delete({ where: { id: removedLine.id } })

          // For delivered BL: reverse the delivery for removed lines
          if (isDelivered) {
            if (removedLine.salesOrderLineId) {
              const prev = soLineDeltas.get(removedLine.salesOrderLineId) || 0
              soLineDeltas.set(removedLine.salesOrderLineId, prev - removedLine.quantity)
            }
            const prevStock = stockDeltas.get(removedLine.productId) || 0
            stockDeltas.set(removedLine.productId, prevStock - removedLine.quantity)
          }
        }

        // 4. Apply cascading: SO quantityDelivered deltas
        if (isDelivered && soLineDeltas.size > 0 && existing.salesOrderId) {
          for (const [soLineId, delta] of soLineDeltas) {
            if (Math.abs(delta) < 0.001) continue
            const soLine = existing.salesOrder?.lines.find(l => l.id === soLineId)
            if (!soLine) continue

            const newDelivered = Math.max(0, soLine.quantityDelivered + delta)
            await tx.salesOrderLine.update({
              where: { id: soLineId },
              data: { quantityDelivered: newDelivered },
            })
          }

          // Update SO status based on delivery progress
          const updatedSoLines = await tx.salesOrderLine.findMany({
            where: { orderId: existing.salesOrderId },
          })
          const allDelivered = updatedSoLines.every(
            (l) => l.quantityDelivered >= l.quantity
          )
          const anyDelivered = updatedSoLines.some(
            (l) => l.quantityDelivered > 0
          )

          if (allDelivered) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'delivered' },
            })
          } else if (anyDelivered) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'partially_delivered' },
            })
          } else {
            // All deliveries reversed
            const remainingNotes = await tx.deliveryNote.findMany({
              where: {
                salesOrderId: existing.salesOrderId,
                status: { notIn: ['cancelled'] },
                id: { not: id }, // exclude current BL
              },
            })
            const hasOtherBLs = remainingNotes.some(n => n.status === 'delivered')
            if (!hasOtherBLs) {
              const allPrepared = updatedSoLines.every((l) => l.quantityPrepared >= l.quantity)
              await tx.salesOrder.update({
                where: { id: existing.salesOrderId },
                data: { status: allPrepared ? 'prepared' : 'in_preparation' },
              })
            }
          }
        }

        // 5. Apply cascading: Stock deltas
        if (isDelivered && stockDeltas.size > 0) {
          for (const [productId, delta] of stockDeltas) {
            if (Math.abs(delta) < 0.001) continue

            if (delta > 0) {
              // More delivered → stock goes out
              await createStockMovement(
                tx, productId, 'out', delta, 'sale',
                blNumber,
                `Ajustement livraison - ${blNumber}`
              )
            } else {
              // Less delivered → stock comes back
              await createStockMovement(
                tx, productId, 'in', Math.abs(delta), 'return',
                blNumber,
                `Réajustement stock - ${blNumber}`
              )
            }
          }
        }

        const totalTTC = totalHT + totalTVA

        // 6. Update header fields + totals
        const { lines: _lines, action: _action, ...headerData } = data
        const updated = await tx.deliveryNote.update({
          where: { id },
          data: {
            totalHT,
            totalTVA,
            totalTTC,
            ...headerData,
            // Handle nullable fields
            chantierId: headerData.chantierId ?? undefined,
            deliveryAddress: headerData.deliveryAddress ?? undefined,
            transporteur: headerData.transporteur ?? undefined,
            vehiclePlate: headerData.vehiclePlate ?? undefined,
            driverName: headerData.driverName ?? undefined,
            transportType: headerData.transportType ?? undefined,
            plannedDate: headerData.plannedDate ? new Date(headerData.plannedDate) : undefined,
            dueDate: headerData.dueDate ? new Date(headerData.dueDate) : undefined,
            notes: headerData.notes ?? undefined,
          },
          include: deliveryNoteInclude,
        })

        return updated
      })

      await auditLog(auth.userId, 'edit_lines', 'DeliveryNote', id, existing, result)
      return NextResponse.json(result)
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

    // Action: deliver (with quantityDelivered tracking + stock movements)
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

        // Update quantityDelivered on SalesOrderLines + create stock movements
        if (existing.salesOrderId && existing.lines.length > 0) {
          for (const blLine of existing.lines) {
            if (blLine.salesOrderLineId) {
              await tx.salesOrderLine.update({
                where: { id: blLine.salesOrderLineId },
                data: {
                  quantityDelivered: {
                    increment: blLine.quantity,
                  },
                },
              })
            }

            // Create stock movement (stock OUT for sale)
            await createStockMovement(
              tx, blLine.productId, 'out', blLine.quantity, 'sale',
              existing.number,
              `Livraison ${existing.number}`
            )
          }

          // Re-fetch all SO lines to check delivery status
          const updatedSoLines = await tx.salesOrderLine.findMany({
            where: { orderId: existing.salesOrderId },
          })
          const allDelivered = updatedSoLines.every(
            (l) => l.quantityDelivered >= l.quantity
          )
          const anyDelivered = updatedSoLines.some(
            (l) => l.quantityDelivered > 0
          )

          if (allDelivered) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'delivered' },
            })
          } else if (anyDelivered) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'partially_delivered' },
            })
          }
        } else if (existing.lines.length > 0) {
          // Standalone BL: just create stock movements
          for (const blLine of existing.lines) {
            await createStockMovement(
              tx, blLine.productId, 'out', blLine.quantity, 'sale',
              existing.number,
              `Livraison ${existing.number}`
            )
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

    // Action: undeliver (reverse delivery - set back to confirmed)
    if (action === 'undeliver') {
      if (existing.status !== 'delivered') {
        return NextResponse.json(
          { error: 'Seul un BL livré peut être remis en confirmation' },
          { status: 400 }
        )
      }

      const deliveryNote = await db.$transaction(async (tx) => {
        const undelivered = await tx.deliveryNote.update({
          where: { id },
          data: { status: 'confirmed', deliveryDate: null },
          include: deliveryNoteInclude,
        })

        // Reverse SO quantityDelivered
        if (existing.salesOrderId && existing.lines.length > 0) {
          for (const blLine of existing.lines) {
            if (blLine.salesOrderLineId) {
              const soLine = existing.salesOrder?.lines.find(l => l.id === blLine.salesOrderLineId)
              if (soLine) {
                const newDelivered = Math.max(0, soLine.quantityDelivered - blLine.quantity)
                await tx.salesOrderLine.update({
                  where: { id: blLine.salesOrderLineId },
                  data: { quantityDelivered: newDelivered },
                })
              }
            }
          }

          // Update SO status
          const updatedSoLines = await tx.salesOrderLine.findMany({
            where: { orderId: existing.salesOrderId },
          })
          const allDelivered = updatedSoLines.every(l => l.quantityDelivered >= l.quantity)
          const anyDelivered = updatedSoLines.some(l => l.quantityDelivered > 0)

          // Check if other delivered BLs exist
          const otherDeliveredBLs = await tx.deliveryNote.count({
            where: {
              salesOrderId: existing.salesOrderId,
              status: 'delivered',
              id: { not: id },
            },
          })

          if (allDelivered && otherDeliveredBLs > 0) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'delivered' },
            })
          } else if (anyDelivered || otherDeliveredBLs > 0) {
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: 'partially_delivered' },
            })
          } else {
            const allPrepared = updatedSoLines.every(l => l.quantityPrepared >= l.quantity)
            await tx.salesOrder.update({
              where: { id: existing.salesOrderId },
              data: { status: allPrepared ? 'prepared' : 'in_preparation' },
            })
          }
        }

        // Reverse stock movements
        for (const blLine of existing.lines) {
          await createStockMovement(
            tx, blLine.productId, 'in', blLine.quantity, 'return',
            existing.number,
            `Annulation livraison ${existing.number}`
          )
        }

        return undelivered
      })

      await auditLog(auth.userId, 'undeliver', 'DeliveryNote', id, existing, deliveryNote)
      return NextResponse.json(deliveryNote)
    }

    // Simple update (notes, transporteur, vehiclePlate, plannedDate)
    // Allow for draft, confirmed, and delivered status
    if (existing.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Impossible de modifier un BL annulé' },
        { status: 400 }
      )
    }

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
