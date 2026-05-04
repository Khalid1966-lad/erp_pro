import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const workOrderSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  plannedDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
})

const closeWorkOrderSchema = z.object({
  goodQuantity: z.number().min(0),
  scrapQuantity: z.number().min(0),
  notes: z.string().optional(),
})

const stepSchema = z.object({
  stepOrder: z.number().int().min(1),
  description: z.string().optional(),
  workStationId: z.string().optional().nullable(),
  duration: z.number().int().default(0),
  goodQuantity: z.number().default(0),
  scrapQuantity: z.number().default(0),
  notes: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
})

async function generateWONumber(): Promise<string> {
  const count = await db.workOrder.count()
  const year = new Date().getFullYear()
  return `OF-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List work orders
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const productId = searchParams.get('productId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (productId) where.productId = productId

    const [workOrders, total] = await Promise.all([
      db.workOrder.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              reference: true,
              designation: true,
              routingSteps: { select: { duration: true } },
            },
          },
          steps: {
            include: {
              workStation: { select: { id: true, name: true } },
            },
            orderBy: { stepOrder: 'asc' },
          },
          batches: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.workOrder.count({ where }),
    ])

    // Compute estimatedEndDate for each work order
    const workOrdersWithEstimate = workOrders.map((wo) => {
      const totalMinutes = wo.product.routingSteps.reduce((sum, rs) => sum + rs.duration, 0)
      const workDays = totalMinutes > 0 ? Math.ceil(totalMinutes / 60 / 8) : 0
      let estimatedEndDate: string | null = null
      if (wo.plannedDate && workDays > 0) {
        const startDate = new Date(wo.plannedDate)
        const endDate = new Date(startDate)
        // Add workDays skipping weekends
        let daysAdded = 0
        while (daysAdded < workDays) {
          endDate.setDate(endDate.getDate() + 1)
          const dayOfWeek = endDate.getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++
          }
        }
        estimatedEndDate = endDate.toISOString()
      }
      return { ...wo, estimatedEndDate }
    })

    return NextResponse.json({ workOrders: workOrdersWithEstimate, total, page, limit })
  } catch (error) {
    console.error('Work orders list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create work order
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = workOrderSchema.parse(body)

    const product = await db.product.findUnique({
      where: { id: data.productId },
      include: { routingSteps: { include: { workStation: true }, orderBy: { stepOrder: 'asc' } } },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    const number = await generateWONumber()

    // Create work order with steps from routing
    const stepsData = product.routingSteps.map((rs) => ({
      stepOrder: rs.stepOrder,
      description: rs.description,
      workStationId: rs.workStationId,
      duration: rs.duration,
    }))

    const workOrder = await db.workOrder.create({
      data: {
        number,
        productId: data.productId,
        quantity: data.quantity,
        status: 'draft',
        plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
        notes: data.notes,
        steps: stepsData.length > 0 ? { create: stepsData } : undefined,
      },
      include: {
        product: true,
        steps: { include: { workStation: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'WorkOrder', workOrder.id, null, workOrder)
    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Work order create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update work order / Launch / Close
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.workOrder.findUnique({
      where: { id },
      include: {
        product: { include: { bomComponents: { include: { component: true } } } },
        steps: { include: { workStation: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Ordre de fabrication introuvable' }, { status: 404 })
    }

    // Plan work order
    if (action === 'plan') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Seul un OF en brouillon peut être planifié' }, { status: 400 })
      }
      const workOrder = await db.workOrder.update({
        where: { id },
        data: { status: 'planned', plannedDate: updateData.plannedDate ? new Date(updateData.plannedDate) : existing.plannedDate },
        include: { product: true, steps: true },
      })
      await auditLog(auth.userId, 'plan', 'WorkOrder', id, existing, workOrder)
      return NextResponse.json(workOrder)
    }

    // Launch work order - consume raw materials from BOM
    if (action === 'launch') {
      if (existing.status !== 'planned') {
        return NextResponse.json({ error: 'L\'OF doit être planifié pour être lancé' }, { status: 400 })
      }

      // Check and consume BOM components
      const bomComponents = existing.product.bomComponents
      if (bomComponents.length === 0) {
        return NextResponse.json({ error: 'Aucune nomenclature définie pour ce produit' }, { status: 400 })
      }

      for (const bom of bomComponents) {
        const requiredQty = bom.quantity * existing.quantity

        if (bom.component.currentStock < requiredQty) {
          return NextResponse.json({
            error: `Stock insuffisant pour ${bom.component.designation} (stock: ${bom.component.currentStock}, requis: ${requiredQty})`,
          }, { status: 400 })
        }

        // Create stock movement (out for production input)
        await db.stockMovement.create({
          data: {
            productId: bom.componentId,
            type: 'out',
            origin: 'production_input',
            quantity: requiredQty,
            unitCost: bom.component.averageCost,
            documentRef: existing.number,
            notes: `OF ${existing.number} - Consommation ${bom.component.designation}`,
          },
        })

        // Update component stock
        await db.product.update({
          where: { id: bom.componentId },
          data: { currentStock: { decrement: requiredQty } },
        })
      }

      const workOrder = await db.workOrder.update({
        where: { id },
        data: {
          status: 'in_progress',
          startedAt: new Date(),
        },
        include: { product: true, steps: { include: { workStation: true } } },
      })

      await auditLog(auth.userId, 'launch', 'WorkOrder', id, existing, workOrder)
      return NextResponse.json(workOrder)
    }

    // Complete work order
    if (action === 'complete') {
      if (existing.status !== 'in_progress') {
        return NextResponse.json({ error: 'L\'OF doit être en cours' }, { status: 400 })
      }
      const workOrder = await db.workOrder.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
        include: { product: true, steps: { include: { workStation: true } } },
      })
      await auditLog(auth.userId, 'complete', 'WorkOrder', id, existing, workOrder)
      return NextResponse.json(workOrder)
    }

    // Close work order - produce finished goods
    if (action === 'close') {
      if (existing.status !== 'completed') {
        return NextResponse.json({ error: 'L\'OF doit être complété pour être clôturé' }, { status: 400 })
      }

      const closeData = closeWorkOrderSchema.parse(body)

      // If batches exist, use batch totals; otherwise use closeData (backward compatibility)
      const existingBatches = await db.productionBatch.findMany({
        where: { workOrderId: id },
      })

      let finalGoodQuantity = closeData.goodQuantity
      let finalScrapQuantity = closeData.scrapQuantity

      if (existingBatches.length > 0) {
        // Sum completed batches' quantities
        const completedBatches = existingBatches.filter((b) => b.status === 'completed')
        const rejectedBatches = existingBatches.filter((b) => b.status === 'rejected')
        finalGoodQuantity = completedBatches.reduce((sum, b) => sum + b.goodQuantity, 0)
        finalScrapQuantity = completedBatches.reduce((sum, b) => sum + b.scrapQuantity, 0)
          + rejectedBatches.reduce((sum, b) => sum + (b.goodQuantity + b.scrapQuantity), 0)
      }

      // Create stock movement (in for production output) + LOT
      if (finalGoodQuantity > 0) {
        await db.stockMovement.create({
          data: {
            productId: existing.productId,
            type: 'in',
            origin: 'production_output',
            quantity: finalGoodQuantity,
            unitCost: existing.product.averageCost,
            documentRef: existing.number,
            notes: `OF ${existing.number} - Production ${existing.product.designation}`,
          },
        })

        // Update product stock
        await db.product.update({
          where: { id: existing.productId },
          data: { currentStock: { increment: finalGoodQuantity } },
        })

        // Create a stock lot for traceability
        const lotCount = await db.lot.count()
        const year = new Date().getFullYear()
        const lotNumber = `LOT-${year}-${String(lotCount + 1).padStart(4, '0')}`

        // Ensure uniqueness
        const existingLot = await db.lot.findUnique({ where: { numeroLot: lotNumber } })
        const finalLotNumber = existingLot ? `${lotNumber}-${Math.floor(Math.random() * 1000)}` : lotNumber

        const lot = await db.lot.create({
          data: {
            numeroLot: finalLotNumber,
            productId: existing.productId,
            workOrderId: id,
            quantiteInitiale: finalGoodQuantity,
            statut: 'actif',
            dateFabrication: new Date(),
            notes: `Lot créé automatiquement depuis OF ${existing.number}`,
          },
        })

        // Create initial entry mouvement
        await db.lotMouvement.create({
          data: {
            lotId: lot.id,
            type: 'entree',
            quantite: finalGoodQuantity,
            documentRef: existing.number,
            notes: `Production OF ${existing.number}`,
          },
        })
      }

      const workOrder = await db.workOrder.update({
        where: { id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          goodQuantity: finalGoodQuantity,
          scrapQuantity: finalScrapQuantity,
          notes: closeData.notes || existing.notes,
        },
        include: { product: true, steps: { include: { workStation: true } } },
      })

      await auditLog(auth.userId, 'close', 'WorkOrder', id, existing, workOrder)
      return NextResponse.json(workOrder)
    }

    // Cancel work order
    if (action === 'cancel') {
      if (['completed', 'closed'].includes(existing.status)) {
        return NextResponse.json({ error: 'Impossible d\'annuler un OF complété ou clôturé' }, { status: 400 })
      }

      // If in progress, return consumed materials
      if (existing.status === 'in_progress') {
        const bomComponents = existing.product.bomComponents
        for (const bom of bomComponents) {
          const returnQty = bom.quantity * existing.quantity
          await db.stockMovement.create({
            data: {
              productId: bom.componentId,
              type: 'in',
              origin: 'return',
              quantity: returnQty,
              unitCost: bom.component.averageCost,
              documentRef: existing.number,
              notes: `Retour OF annulé ${existing.number}`,
            },
          })
          await db.product.update({
            where: { id: bom.componentId },
            data: { currentStock: { increment: returnQty } },
          })
        }
      }

      const workOrder = await db.workOrder.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { product: true, steps: true },
      })
      await auditLog(auth.userId, 'cancel', 'WorkOrder', id, existing, workOrder)
      return NextResponse.json(workOrder)
    }

    // Update step status
    if (action === 'update_step') {
      const stepData = stepSchema.parse(updateData)
      const stepId = updateData.stepId
      if (!stepId) {
        return NextResponse.json({ error: 'stepId requis' }, { status: 400 })
      }

      const existingStep = await db.workOrderStep.findUnique({ where: { id: stepId } })
      if (!existingStep || existingStep.workOrderId !== id) {
        return NextResponse.json({ error: 'Étape introuvable' }, { status: 404 })
      }

      const stepUpdate: Record<string, unknown> = {}
      if (stepData.status !== undefined) {
        stepUpdate.status = stepData.status
        if (stepData.status === 'in_progress' && !existingStep.startedAt) {
          stepUpdate.startedAt = new Date()
        }
        if (stepData.status === 'completed') {
          stepUpdate.completedAt = new Date()
          stepUpdate.actualDuration = stepData.duration || 0
        }
      }
      if (stepData.goodQuantity !== undefined) stepUpdate.goodQuantity = stepData.goodQuantity
      if (stepData.scrapQuantity !== undefined) stepUpdate.scrapQuantity = stepData.scrapQuantity
      if (stepData.notes !== undefined) stepUpdate.notes = stepData.notes

      const updatedStep = await db.workOrderStep.update({
        where: { id: stepId },
        data: stepUpdate,
      })

      return NextResponse.json(updatedStep)
    }

    // Simple update
    const workOrder = await db.workOrder.update({
      where: { id },
      data: updateData,
      include: { product: true, steps: { include: { workStation: true } } },
    })

    await auditLog(auth.userId, 'update', 'WorkOrder', id, existing, workOrder)
    return NextResponse.json(workOrder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Work order update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete work order
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.workOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ordre de fabrication introuvable' }, { status: 404 })
    }

    if (!['draft', 'planned'].includes(existing.status)) {
      return NextResponse.json({ error: 'Seuls les OF en brouillon ou planifié peuvent être supprimés' }, { status: 400 })
    }

    await db.workOrderStep.deleteMany({ where: { workOrderId: id } })
    await db.workOrder.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'WorkOrder', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Work order delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
