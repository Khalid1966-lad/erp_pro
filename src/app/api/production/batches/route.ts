import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const createBatchSchema = z.object({
  workOrderId: z.string().min(1),
  quantity: z.number().positive(),
  notes: z.string().optional(),
})

async function generateBatchNumber(woNumber: string, seq: number): Promise<string> {
  return `LOT-${woNumber}-${String(seq).padStart(3, '0')}`
}

// GET - List batches for a work order
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const workOrderId = searchParams.get('workOrderId')

    if (!workOrderId) {
      return NextResponse.json({ error: 'workOrderId requis' }, { status: 400 })
    }

    const batches = await db.productionBatch.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ batches })
  } catch (error) {
    console.error('Batches list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create a batch
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createBatchSchema.parse(body)

    // Verify work order exists and is in modifiable status
    const workOrder = await db.workOrder.findUnique({
      where: { id: data.workOrderId },
    })
    if (!workOrder) {
      return NextResponse.json({ error: 'Ordre de fabrication introuvable' }, { status: 404 })
    }

    if (!['draft', 'planned', 'in_progress'].includes(workOrder.status)) {
      return NextResponse.json(
        { error: 'Seuls les OF en brouillon, planifié ou en cours peuvent avoir des lots' },
        { status: 400 }
      )
    }

    // Generate batch number
    const existingCount = await db.productionBatch.count({
      where: { workOrderId: data.workOrderId },
    })
    const batchNumber = await generateBatchNumber(workOrder.number, existingCount + 1)

    // Ensure batch number uniqueness
    const existingBatch = await db.productionBatch.findUnique({
      where: { batchNumber },
    })
    if (existingBatch) {
      const fallbackSeq = existingCount + 2
      const fallbackNumber = await generateBatchNumber(workOrder.number, fallbackSeq)
      const batch = await db.productionBatch.create({
        data: {
          workOrderId: data.workOrderId,
          batchNumber: fallbackNumber,
          quantity: data.quantity,
          notes: data.notes,
        },
      })
      await auditLog(auth.userId, 'create', 'ProductionBatch', batch.id, null, batch)
      return NextResponse.json(batch, { status: 201 })
    }

    const batch = await db.productionBatch.create({
      data: {
        workOrderId: data.workOrderId,
        batchNumber,
        quantity: data.quantity,
        notes: data.notes,
      },
    })

    await auditLog(auth.userId, 'create', 'ProductionBatch', batch.id, null, batch)
    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Batch create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update a batch (start, complete, reject, update fields)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'ID et action requis' }, { status: 400 })
    }

    const existing = await db.productionBatch.findUnique({
      where: { id },
      include: { workOrder: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Verify work order is in modifiable status
    if (!['draft', 'planned', 'in_progress', 'completed'].includes(existing.workOrder.status)) {
      return NextResponse.json(
        { error: 'Impossible de modifier un lot pour un OF clôturé ou annulé' },
        { status: 400 }
      )
    }

    // Start batch
    if (action === 'start') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: 'Seul un lot en attente peut être démarré' }, { status: 400 })
      }
      const updated = await db.productionBatch.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      })
      await auditLog(auth.userId, 'start', 'ProductionBatch', id, existing, updated)
      return NextResponse.json(updated)
    }

    // Complete batch
    if (action === 'complete') {
      if (!['in_progress', 'quality_check'].includes(existing.status)) {
        return NextResponse.json({ error: 'Le lot doit être en cours ou en contrôle qualité' }, { status: 400 })
      }
      const updated = await db.productionBatch.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      })
      await auditLog(auth.userId, 'complete', 'ProductionBatch', id, existing, updated)
      return NextResponse.json(updated)
    }

    // Reject batch
    if (action === 'reject') {
      if (!['pending', 'in_progress', 'quality_check'].includes(existing.status)) {
        return NextResponse.json({ error: 'Ce lot ne peut plus être rejeté' }, { status: 400 })
      }
      const reason = updateData.notes || updateData.reason || 'Rejeté sans motif'
      const updated = await db.productionBatch.update({
        where: { id },
        data: {
          status: 'rejected',
          completedAt: new Date(),
          notes: existing.notes ? `${existing.notes} | Rejet: ${reason}` : `Rejet: ${reason}`,
        },
      })
      await auditLog(auth.userId, 'reject', 'ProductionBatch', id, existing, updated)
      return NextResponse.json(updated)
    }

    // Simple field update (goodQuantity, scrapQuantity, notes)
    if (action === 'update') {
      if (!['pending', 'in_progress', 'quality_check'].includes(existing.status)) {
        return NextResponse.json({ error: 'Ce lot ne peut plus être modifié' }, { status: 400 })
      }

      const fieldsToUpdate: Record<string, unknown> = {}
      if (updateData.goodQuantity !== undefined) fieldsToUpdate.goodQuantity = Number(updateData.goodQuantity)
      if (updateData.scrapQuantity !== undefined) fieldsToUpdate.scrapQuantity = Number(updateData.scrapQuantity)
      if (updateData.notes !== undefined) fieldsToUpdate.notes = updateData.notes

      const updated = await db.productionBatch.update({
        where: { id },
        data: fieldsToUpdate,
      })
      await auditLog(auth.userId, 'update', 'ProductionBatch', id, existing, updated)
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    console.error('Batch update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete a batch (only pending)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.productionBatch.findUnique({
      where: { id },
      include: { workOrder: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Seuls les lots en attente peuvent être supprimés' }, { status: 400 })
    }

    if (!['draft', 'planned', 'in_progress'].includes(existing.workOrder.status)) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un lot pour un OF terminé, clôturé ou annulé' },
        { status: 400 }
      )
    }

    await db.productionBatch.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'ProductionBatch', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Batch delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
