import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'

// ═══════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════

const createPrepSchema = z.object({
  salesOrderId: z.string().min(1, 'ID de commande requis'),
  notes: z.string().optional(),
})

const updateLineSchema = z.object({
  id: z.string().min(1),
  action: z.literal('updateLine'),
  lineId: z.string().min(1),
  quantityPrepared: z.number().min(0),
})

const startSchema = z.object({
  id: z.string().min(1),
  action: z.literal('start'),
})

const validateSchema = z.object({
  id: z.string().min(1),
  action: z.literal('validate'),
  notes: z.string().optional(),
})

const cancelSchema = z.object({
  id: z.string().min(1),
  action: z.literal('cancel'),
})

const simpleUpdateSchema = z.object({
  id: z.string().min(1),
  notes: z.string().optional(),
})

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

const PRODUCT_NATURE_LABELS: Record<string, string> = {
  matiere_premiere: 'Matière première',
  semi_fini: 'Semi-fini',
  produit_fini: 'Produit fini',
  service: 'Service',
}

const PRODUCT_NATURE_SUGGESTIONS: Record<string, { action: string; target: string }> = {
  matiere_premiere: { action: 'Commander auprès d\'un fournisseur', target: 'purchase-orders' },
  semi_fini: { action: 'Lancer une production', target: 'work-orders' },
  produit_fini: { action: 'Lancer une production', target: 'work-orders' },
  service: { action: 'Prestation interne', target: null as any },
}

function generatePrepNumber(): Promise<string> {
  return db.preparationOrder.count().then((count) => {
    const year = new Date().getFullYear()
    return `PREP-${year}-${String(count + 1).padStart(4, '0')}`
  })
}

// ═══════════════════════════════════════════════════════
// GET - List preparations / Stock check
// ═══════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const salesOrderId = searchParams.get('salesOrderId') || ''
    const search = searchParams.get('search') || ''
    const stockCheckId = searchParams.get('stockCheck') === 'true' ? searchParams.get('id') : null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // ── Stock check endpoint ──
    if (stockCheckId) {
      const preparation = await db.preparationOrder.findUnique({
        where: { id: stockCheckId },
        include: {
          lines: {
            include: {
              product: {
                select: {
                  id: true,
                  reference: true,
                  designation: true,
                  currentStock: true,
                  productNature: true,
                  unit: true,
                },
              },
            },
          },
        },
      })

      if (!preparation) {
        return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
      }

      const stockCheckLines = preparation.lines.map((line) => {
        const deficit = Math.max(0, line.quantityRequested - line.product.currentStock)
        return {
          id: line.id,
          productId: line.productId,
          productReference: line.product.reference,
          productDesignation: line.product.designation,
          productNature: line.product.productNature,
          productTypeLabel: PRODUCT_NATURE_LABELS[line.product.productNature] || line.product.productNature,
          unit: line.product.unit,
          stockAvailable: line.product.currentStock,
          stockAvailableAtCreation: line.stockAvailable,
          quantityRequested: line.quantityRequested,
          quantityPrepared: line.quantityPrepared,
          deficit,
          hasDeficit: deficit > 0,
          suggestion: deficit > 0
            ? PRODUCT_NATURE_SUGGESTIONS[line.product.productNature] || null
            : null,
        }
      })

      return NextResponse.json({
        preparationId: preparation.id,
        preparationNumber: preparation.number,
        status: preparation.status,
        totalLines: stockCheckLines.length,
        deficitLines: stockCheckLines.filter((l) => l.hasDeficit).length,
        lines: stockCheckLines,
      })
    }

    // ── List preparations ──
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (salesOrderId) where.salesOrderId = salesOrderId
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { salesOrder: { clientOrderNumber: { contains: search, mode: 'insensitive' } } },
        { salesOrder: { client: { name: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const [preparations, total] = await Promise.all([
      db.preparationOrder.findMany({
        where,
        include: {
          lines: {
            include: {
              product: {
                select: {
                  id: true,
                  reference: true,
                  designation: true,
                  currentStock: true,
                  productNature: true,
                  unit: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          salesOrder: {
            include: {
              client: { select: { id: true, name: true } },
              lines: {
                include: {
                  product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.preparationOrder.count({ where }),
    ])

    // Enrich with progress calculations
    const enrichedPreparations = preparations.map((prep) => {
      const totalLines = prep.lines.length
      const preparedLines = prep.lines.filter((l) => l.quantityPrepared > 0).length
      const fullyPreparedLines = prep.lines.filter((l) => l.quantityPrepared >= l.quantityRequested).length
      const progressPercent = totalLines > 0
        ? Math.round((fullyPreparedLines / totalLines) * 100)
        : 0

      const linesWithStock = prep.lines.map((line) => {
        const deficit = Math.max(0, line.quantityRequested - line.product.currentStock)
        return {
          ...line,
          currentStock: line.product.currentStock,
          deficit,
          hasDeficit: deficit > 0,
          suggestion: deficit > 0
            ? PRODUCT_NATURE_SUGGESTIONS[line.product.productNature] || null
            : null,
        }
      })

      return {
        ...prep,
        totalLines,
        preparedLines,
        fullyPreparedLines,
        progressPercent,
        lines: linesWithStock,
      }
    })

    return NextResponse.json({ preparations: enrichedPreparations, total, page, limit })
  } catch (error) {
    console.error('Preparations list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════
// POST - Create preparation
// ═══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { salesOrderId, notes } = createPrepSchema.parse(body)

    // Fetch SO with lines and products
    const salesOrder = await db.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        lines: {
          include: {
            product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
          },
        },
      },
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
    }

    if (!['confirmed', 'in_preparation'].includes(salesOrder.status)) {
      return NextResponse.json(
        { error: 'Le bon de commande doit être confirmé ou en cours de préparation' },
        { status: 400 },
      )
    }

    // Check if there's already a non-cancelled preparation for this order
    const existingActivePrep = await db.preparationOrder.findFirst({
      where: {
        salesOrderId,
        status: { in: ['pending', 'in_progress'] },
      },
    })

    if (existingActivePrep) {
      return NextResponse.json(
        { error: 'Une préparation active existe déjà pour cette commande' },
        { status: 400 },
      )
    }

    // Build preparation lines: skip fully prepared lines
    const linesToPrepare = salesOrder.lines
      .map((line) => {
        const quantityRequested = line.quantity - (line.quantityPrepared || 0)
        return {
          salesOrderLineId: line.id,
          productId: line.productId,
          product: line.product,
          quantityRequested,
          stockAvailable: line.product.currentStock,
        }
      })
      .filter((l) => l.quantityRequested > 0)

    if (linesToPrepare.length === 0) {
      return NextResponse.json(
        { error: 'Toutes les lignes de cette commande sont déjà entièrement préparées' },
        { status: 400 },
      )
    }

    const prepNumber = await generatePrepNumber()

    const preparation = await db.$transaction(async (tx) => {
      // Create preparation order
      const prep = await tx.preparationOrder.create({
        data: {
          number: prepNumber,
          salesOrderId: salesOrder.id,
          status: 'pending',
          notes: notes || null,
        },
        include: {
          lines: true,
          salesOrder: {
            include: {
              client: { select: { id: true, name: true } },
              lines: {
                include: {
                  product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
                },
              },
            },
          },
        },
      })

      // Create preparation lines
      for (const lineData of linesToPrepare) {
        await tx.preparationLine.create({
          data: {
            preparationOrderId: prep.id,
            salesOrderLineId: lineData.salesOrderLineId,
            productId: lineData.productId,
            quantityRequested: lineData.quantityRequested,
            stockAvailable: lineData.stockAvailable,
          },
        })
      }

      // Update SO status to in_preparation if confirmed
      if (salesOrder.status === 'confirmed') {
        await tx.salesOrder.update({
          where: { id: salesOrderId },
          data: { status: 'in_preparation' },
        })
      }

      // Re-fetch with lines
      return tx.preparationOrder.findUnique({
        where: { id: prep.id },
        include: {
          lines: {
            include: {
              product: {
                select: {
                  id: true,
                  reference: true,
                  designation: true,
                  currentStock: true,
                  productNature: true,
                  unit: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          salesOrder: {
            include: {
              client: { select: { id: true, name: true } },
              lines: {
                include: {
                  product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
                },
              },
            },
          },
        },
      })
    })

    await auditLog(auth.userId, 'create', 'PreparationOrder', preparation!.id, null, preparation)
    notifyAll({ title: 'Nouveau bon de préparation', message: `Préparation ${preparation!.number}`, type: 'success', category: 'delivery', entityType: 'PreparationOrder', entityId: preparation!.id }).catch(() => {})
    return NextResponse.json(preparation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Preparation create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════
// PUT - Actions (start, validate, cancel, updateLine, simple)
// ═══════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { action } = body

    if (!action || !body.id) {
      return NextResponse.json({ error: 'ID et action requis' }, { status: 400 })
    }

    // ── Update line quantity ──
    if (action === 'updateLine') {
      const { lineId, quantityPrepared } = updateLineSchema.parse(body)

      const prep = await db.preparationOrder.findUnique({
        where: { id: body.id },
        include: {
          lines: {
            include: {
              product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
            },
          },
        },
      })

      if (!prep) {
        return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
      }

      if (prep.status !== 'in_progress') {
        return NextResponse.json(
          { error: 'Seules les préparations en cours peuvent être modifiées' },
          { status: 400 },
        )
      }

      const line = prep.lines.find((l) => l.id === lineId)
      if (!line) {
        return NextResponse.json({ error: 'Ligne de préparation introuvable' }, { status: 404 })
      }

      if (quantityPrepared > line.quantityRequested) {
        return NextResponse.json(
          { error: `Quantité préparée (${quantityPrepared}) supérieure à la quantité demandée (${line.quantityRequested})` },
          { status: 400 },
        )
      }

      const updatedLine = await db.preparationLine.update({
        where: { id: lineId },
        data: { quantityPrepared },
        include: {
          product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
        },
      })

      await auditLog(auth.userId, 'update_line', 'PreparationLine', lineId, line, updatedLine)
      return NextResponse.json(updatedLine)
    }

    // ── Start preparation ──
    if (action === 'start') {
      startSchema.parse(body)

      const existing = await db.preparationOrder.findUnique({ where: { id: body.id } })
      if (!existing) {
        return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
      }

      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Seule une préparation en attente peut être démarrée' }, { status: 400 })
      }

      const preparation = await db.preparationOrder.update({
        where: { id: body.id },
        data: { status: 'in_progress' },
        include: {
          salesOrder: {
            include: { client: { select: { id: true, name: true } } },
          },
        },
      })

      await auditLog(auth.userId, 'start', 'PreparationOrder', body.id, existing, preparation)
      return NextResponse.json(preparation)
    }

    // ── Validate preparation ──
    if (action === 'validate') {
      const { notes: validateNotes } = validateSchema.parse(body)

      const prep = await db.preparationOrder.findUnique({
        where: { id: body.id },
        include: {
          lines: {
            include: {
              product: {
                select: {
                  id: true,
                  reference: true,
                  designation: true,
                  currentStock: true,
                  productNature: true,
                  unit: true,
                  averageCost: true,
                },
              },
              salesOrderLine: { select: { id: true, quantity: true, quantityPrepared: true } },
            },
          },
          salesOrder: {
            include: { lines: { include: { product: true } } },
          },
        },
      })

      if (!prep) {
        return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
      }

      if (prep.status !== 'in_progress') {
        return NextResponse.json(
          { error: 'Seule une préparation en cours peut être validée' },
          { status: 400 },
        )
      }

      // Check all lines have at least quantityPrepared > 0
      const linesWithZero = prep.lines.filter((l) => l.quantityPrepared <= 0)
      if (linesWithZero.length === prep.lines.length) {
        return NextResponse.json(
          { error: 'Au moins une ligne doit avoir une quantité préparée' },
          { status: 400 },
        )
      }

      // Validate and check stock for each line
      const warnings: Array<{
        lineId: string
        productReference: string
        productDesignation: string
        quantityPrepared: number
        stockAvailable: number
        deficit: number
        productNature: string
        productTypeLabel: string
        suggestion: { action: string; target: string } | null
      }> = []

      const stockErrors: Array<{
        lineId: string
        productReference: string
        productDesignation: string
        quantityPrepared: number
        stockAvailable: number
        deficit: number
      }> = []

      for (const line of prep.lines) {
        if (line.quantityPrepared <= 0) continue

        if (line.quantityPrepared > line.quantityRequested) {
          return NextResponse.json(
            {
              error: `Quantité préparée (${line.quantityPrepared}) supérieure à la quantité demandée (${line.quantityRequested}) pour ${line.product.designation}`,
            },
            { status: 400 },
          )
        }

        if (line.quantityPrepared > line.product.currentStock) {
          const deficit = line.quantityPrepared - line.product.currentStock
          stockErrors.push({
            lineId: line.id,
            productReference: line.product.reference,
            productDesignation: line.product.designation,
            quantityPrepared: line.quantityPrepared,
            stockAvailable: line.product.currentStock,
            deficit,
          })

          warnings.push({
            lineId: line.id,
            productReference: line.product.reference,
            productDesignation: line.product.designation,
            quantityPrepared: line.quantityPrepared,
            stockAvailable: line.product.currentStock,
            deficit,
            productNature: line.product.productNature,
            productTypeLabel: PRODUCT_NATURE_LABELS[line.product.productNature] || line.product.productNature,
            suggestion: PRODUCT_NATURE_SUGGESTIONS[line.product.productNature] || null,
          })
        }

        // Check deficit even for lines with enough stock (for warnings)
        if (line.quantityRequested > line.product.currentStock && line.quantityPrepared <= line.product.currentStock) {
          warnings.push({
            lineId: line.id,
            productReference: line.product.reference,
            productDesignation: line.product.designation,
            quantityPrepared: line.quantityPrepared,
            stockAvailable: line.product.currentStock,
            deficit: line.quantityRequested - line.product.currentStock,
            productNature: line.product.productNature,
            productTypeLabel: PRODUCT_NATURE_LABELS[line.product.productNature] || line.product.productNature,
            suggestion: PRODUCT_NATURE_SUGGESTIONS[line.product.productNature] || null,
          })
        }
      }

      // If there are stock errors (prepared > available), block validation
      if (stockErrors.length > 0) {
        return NextResponse.json(
          {
            error: `Stock insuffisant pour ${stockErrors.length} ligne(s). Veuillez ajuster les quantités ou approvisionner le stock.`,
            stockErrors,
            warnings,
          },
          { status: 400 },
        )
      }

      // Execute validation in transaction
      const updatedPrep = await db.$transaction(async (tx) => {
        // Process each line with quantityPrepared > 0
        for (const line of prep.lines) {
          if (line.quantityPrepared <= 0) continue

          // Update SalesOrderLine.quantityPrepared (increment)
          await tx.salesOrderLine.update({
            where: { id: line.salesOrderLineId },
            data: { quantityPrepared: { increment: line.quantityPrepared } },
          })

          // Create StockMovement (out)
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              type: 'out',
              origin: 'sale',
              quantity: line.quantityPrepared,
              unitCost: line.product.averageCost || 0,
              documentRef: prep.number,
              notes: `Préparation ${prep.number} — ${line.product.reference}`,
            },
          })

          // Update Product.currentStock (decrement)
          await tx.product.update({
            where: { id: line.productId },
            data: { currentStock: { decrement: line.quantityPrepared } },
          })
        }

        // Update preparation status
        const updated = await tx.preparationOrder.update({
          where: { id: body.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            notes: validateNotes || prep.notes,
          },
          include: {
            lines: {
              include: {
                product: {
                  select: {
                    id: true,
                    reference: true,
                    designation: true,
                    currentStock: true,
                    productNature: true,
                    unit: true,
                  },
                },
              },
            },
            salesOrder: {
              include: {
                client: { select: { id: true, name: true } },
                lines: {
                  include: {
                    product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
                  },
                },
              },
            },
          },
        })

        // Check if ALL SO lines are fully prepared → update SO to 'prepared'
        const updatedOrder = await tx.salesOrder.findUnique({
          where: { id: prep.salesOrderId },
          include: { lines: true },
        })

        if (updatedOrder) {
          const allPrepared = updatedOrder.lines.every(
            (l) => (l.quantityPrepared || 0) >= l.quantity,
          )
          const somePrepared = updatedOrder.lines.some(
            (l) => (l.quantityPrepared || 0) > 0,
          )

          if (allPrepared) {
            await tx.salesOrder.update({
              where: { id: prep.salesOrderId },
              data: { status: 'prepared' },
            })
          } else if (somePrepared) {
            await tx.salesOrder.update({
              where: { id: prep.salesOrderId },
              data: { status: 'in_preparation' },
            })
          }
        }

        return updated
      })

      await auditLog(auth.userId, 'validate', 'PreparationOrder', body.id, prep, updatedPrep)
      return NextResponse.json({
        ...updatedPrep,
        warnings: warnings.length > 0 ? warnings : undefined,
      })
    }

    // ── Cancel preparation ──
    if (action === 'cancel') {
      cancelSchema.parse(body)

      const existing = await db.preparationOrder.findUnique({
        where: { id: body.id },
        include: { salesOrder: { include: { lines: true } } },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
      }

      if (existing.status === 'completed') {
        return NextResponse.json(
          { error: 'Impossible d\'annuler une préparation terminée' },
          { status: 400 },
        )
      }

      const preparation = await db.$transaction(async (tx) => {
        const updated = await tx.preparationOrder.update({
          where: { id: body.id },
          data: { status: 'cancelled' },
          include: { salesOrder: true },
        })

        // Revert SO status if no other active preparations exist
        const activePreps = await tx.preparationOrder.count({
          where: {
            salesOrderId: existing.salesOrderId,
            status: { in: ['pending', 'in_progress'] },
          },
        })

        if (activePreps === 0) {
          const so = await tx.salesOrder.findUnique({
            where: { id: existing.salesOrderId },
            include: { lines: true },
          })

          if (so) {
            const somePrepared = so.lines.some((l) => (l.quantityPrepared || 0) > 0)
            const allPrepared = so.lines.every((l) => (l.quantityPrepared || 0) >= l.quantity)

            if (allPrepared) {
              await tx.salesOrder.update({
                where: { id: existing.salesOrderId },
                data: { status: 'prepared' },
              })
            } else if (somePrepared) {
              await tx.salesOrder.update({
                where: { id: existing.salesOrderId },
                data: { status: 'in_preparation' },
              })
            } else {
              await tx.salesOrder.update({
                where: { id: existing.salesOrderId },
                data: { status: 'confirmed' },
              })
            }
          }
        }

        return updated
      })

      await auditLog(auth.userId, 'cancel', 'PreparationOrder', body.id, existing, preparation)
      return NextResponse.json(preparation)
    }

    // ── Simple update (notes) ──
    const { id, notes: updateNotes } = simpleUpdateSchema.parse(body)

    const existing = await db.preparationOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Préparation introuvable' }, { status: 404 })
    }

    const preparation = await db.preparationOrder.update({
      where: { id },
      data: { notes: updateNotes !== undefined ? updateNotes : existing.notes },
      include: {
        lines: {
          include: {
            product: {
              select: {
                id: true,
                reference: true,
                designation: true,
                currentStock: true,
                productNature: true,
                unit: true,
              },
            },
          },
        },
        salesOrder: {
          include: {
            client: { select: { id: true, name: true } },
            lines: {
              include: {
                product: { select: { id: true, reference: true, designation: true, currentStock: true, productNature: true, unit: true } },
              },
            },
          },
        },
      },
    })

    await auditLog(auth.userId, 'update', 'PreparationOrder', id, existing, preparation)
    return NextResponse.json(preparation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Preparation update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════
// DELETE - Delete preparation
// ═══════════════════════════════════════════════════════

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'preparations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.preparationOrder.findUnique({
      where: { id },
      include: { salesOrder: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bon de préparation introuvable' }, { status: 404 })
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Impossible de supprimer une préparation terminée' },
        { status: 400 },
      )
    }

    // Delete preparation (cascade deletes preparation lines)
    await db.preparationOrder.delete({ where: { id } })

    // Revert SO status if no active preparations remain
    const activePreps = await db.preparationOrder.count({
      where: {
        salesOrderId: existing.salesOrderId,
        status: { in: ['pending', 'in_progress'] },
      },
    })

    if (activePreps === 0) {
      const so = await db.salesOrder.findUnique({
        where: { id: existing.salesOrderId },
        include: { lines: true },
      })

      if (so) {
        const somePrepared = so.lines.some((l) => (l.quantityPrepared || 0) > 0)
        const allPrepared = so.lines.every((l) => (l.quantityPrepared || 0) >= l.quantity)

        if (allPrepared) {
          await db.salesOrder.update({
            where: { id: existing.salesOrderId },
            data: { status: 'prepared' },
          })
        } else if (somePrepared) {
          await db.salesOrder.update({
            where: { id: existing.salesOrderId },
            data: { status: 'in_preparation' },
          })
        } else {
          await db.salesOrder.update({
            where: { id: existing.salesOrderId },
            data: { status: 'confirmed' },
          })
        }
      }
    }

    await auditLog(auth.userId, 'delete', 'PreparationOrder', id, existing, null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Preparation delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
