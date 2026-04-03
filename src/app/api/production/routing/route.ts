import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const routingStepSchema = z.object({
  productId: z.string(),
  workStationId: z.string(),
  stepOrder: z.number().int().min(1),
  duration: z.number().int().min(0).default(0),
  description: z.string().optional(),
})

// GET - List routing steps
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'routing:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId') || ''

    if (!productId) {
      return NextResponse.json({ error: 'productId est requis' }, { status: 400 })
    }

    const steps = await db.routingStep.findMany({
      where: { productId },
      include: {
        product: { select: { id: true, reference: true, designation: true } },
        workStation: { select: { id: true, name: true, efficiency: true } },
      },
      orderBy: { stepOrder: 'asc' },
    })

    return NextResponse.json({ steps })
  } catch (error) {
    console.error('Routing steps list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create routing step
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'routing:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = routingStepSchema.parse(body)

    const product = await db.product.findUnique({ where: { id: data.productId } })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    const workStation = await db.workStation.findUnique({ where: { id: data.workStationId } })
    if (!workStation) {
      return NextResponse.json({ error: 'Poste de travail introuvable' }, { status: 404 })
    }

    // Check for duplicate step order
    const existing = await db.routingStep.findUnique({
      where: { productId_stepOrder: { productId: data.productId, stepOrder: data.stepOrder } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Cette étape existe déjà pour ce produit' }, { status: 409 })
    }

    const step = await db.routingStep.create({
      data: {
        productId: data.productId,
        workStationId: data.workStationId,
        stepOrder: data.stepOrder,
        duration: data.duration,
        description: data.description,
      },
      include: {
        product: { select: { id: true, reference: true, designation: true } },
        workStation: { select: { id: true, name: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'RoutingStep', step.id, null, step)
    return NextResponse.json(step, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Routing step create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update routing step
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'routing:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.routingStep.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Étape de gamme introuvable' }, { status: 404 })
    }

    const data = routingStepSchema.partial().omit({ productId: true }).parse(updateData)

    const step = await db.routingStep.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, reference: true, designation: true } },
        workStation: { select: { id: true, name: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'RoutingStep', id, existing, step)
    return NextResponse.json(step)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Routing step update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete routing step
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'routing:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.routingStep.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Étape de gamme introuvable' }, { status: 404 })
    }

    await db.routingStep.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'RoutingStep', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Routing step delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
