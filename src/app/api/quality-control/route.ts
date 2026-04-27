import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const lineSchema = z.object({
  productId: z.string(),
  specification: z.string().optional(),
  measuredValue: z.string().optional(),
  unit: z.string().optional(),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  tolerance: z.number().optional().nullable(),
  result: z.enum(['conforme', 'non_conforme', 'conditionnel']).default('conforme'),
  notes: z.string().optional(),
})

const createSchema = z.object({
  type: z.enum(['reception', 'production_inter', 'production_out', 'production_final', 'inventory']),
  receptionId: z.string().optional(),
  workOrderId: z.string().optional(),
  inspector: z.string().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  lines: z.array(lineSchema).optional(),
})

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).optional(),
  result: z.enum(['conforme', 'non_conforme', 'conditionnel']).optional().nullable(),
  inspector: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  lines: z.array(lineSchema).optional(),
})

async function generateQCNumber(): Promise<string> {
  const count = await db.qualityControl.count()
  const year = new Date().getFullYear()
  return `QC-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List quality controls
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    const workOrderId = searchParams.get('workOrderId') || ''
    const receptionId = searchParams.get('receptionId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (status) where.status = status
    if (workOrderId) where.workOrderId = workOrderId
    if (receptionId) where.receptionId = receptionId

    const [qualityControls, total] = await Promise.all([
      db.qualityControl.findMany({
        where,
        include: {
          lines: {
            include: {
              product: {
                select: { id: true, reference: true, designation: true },
              },
            },
          },
          reception: {
            select: { id: true, number: true },
          },
          workOrder: {
            select: {
              id: true,
              number: true,
              product: { select: { reference: true, designation: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.qualityControl.count({ where }),
    ])

    return NextResponse.json({ qualityControls, total, page, limit })
  } catch (error) {
    console.error('Quality control list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create quality control
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Validate source entity
    if (data.type === 'reception' && data.receptionId) {
      const reception = await db.reception.findUnique({ where: { id: data.receptionId } })
      if (!reception) {
        return NextResponse.json({ error: 'Réception introuvable' }, { status: 404 })
      }
    }
    if (['production_inter', 'production_out', 'production_final'].includes(data.type) && data.workOrderId) {
      const workOrder = await db.workOrder.findUnique({ where: { id: data.workOrderId } })
      if (!workOrder) {
        return NextResponse.json({ error: 'Ordre de fabrication introuvable' }, { status: 404 })
      }
    }

    const number = await generateQCNumber()

    const qualityControl = await db.qualityControl.create({
      data: {
        number,
        type: data.type,
        receptionId: data.receptionId || null,
        workOrderId: data.workOrderId || null,
        inspector: data.inspector || null,
        notes: data.notes || null,
        reference: data.reference || null,
        lines: data.lines && data.lines.length > 0
          ? {
              create: data.lines.map((line) => ({
                productId: line.productId,
                specification: line.specification || null,
                measuredValue: line.measuredValue || null,
                unit: line.unit || null,
                minValue: line.minValue ?? null,
                maxValue: line.maxValue ?? null,
                tolerance: line.tolerance ?? null,
                result: line.result,
                notes: line.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        reception: { select: { id: true, number: true } },
        workOrder: { select: { id: true, number: true, product: { select: { reference: true, designation: true } } } },
      },
    })

    await auditLog(auth.userId, 'create', 'QualityControl', qualityControl.id, null, qualityControl)
    return NextResponse.json(qualityControl, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Quality control create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update quality control
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    if (!data.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.qualityControl.findUnique({
      where: { id: data.id },
      include: { lines: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Contrôle qualité introuvable' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.result !== undefined) updateData.result = data.result
    if (data.inspector !== undefined) updateData.inspector = data.inspector
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.reference !== undefined) updateData.reference = data.reference

    // If lines are provided, replace them
    if (data.lines) {
      // Delete existing lines
      await db.qualityControlLine.deleteMany({ where: { qualityControlId: data.id } })
      updateData.lines = {
        create: data.lines.map((line) => ({
          productId: line.productId,
          specification: line.specification || null,
          measuredValue: line.measuredValue || null,
          unit: line.unit || null,
          minValue: line.minValue ?? null,
          maxValue: line.maxValue ?? null,
          tolerance: line.tolerance ?? null,
          result: line.result,
          notes: line.notes || null,
        })),
      }
    }

    const qualityControl = await db.qualityControl.update({
      where: { id: data.id },
      data: updateData,
      include: {
        lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        reception: { select: { id: true, number: true } },
        workOrder: { select: { id: true, number: true, product: { select: { reference: true, designation: true } } } },
      },
    })

    await auditLog(auth.userId, 'update', 'QualityControl', data.id, existing, qualityControl)
    return NextResponse.json(qualityControl)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Quality control update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete quality control
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.qualityControl.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Contrôle qualité introuvable' }, { status: 404 })
    }

    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Un contrôle terminé ne peut pas être supprimé' }, { status: 400 })
    }

    await db.qualityControlLine.deleteMany({ where: { qualityControlId: id } })
    await db.qualityControl.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'QualityControl', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Quality control delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
