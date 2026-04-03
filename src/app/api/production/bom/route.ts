import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const bomComponentSchema = z.object({
  componentId: z.string(),
  quantity: z.number().min(0.001),
  notes: z.string().optional(),
})

// GET - List BOMs
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bom:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId') || ''

    const where: Record<string, unknown> = {}
    if (productId) {
      where.bomId = productId
    }

    const boms = await db.bomComponent.findMany({
      where,
      include: {
        bom: { select: { id: true, reference: true, designation: true } },
        component: { select: { id: true, reference: true, designation: true, currentStock: true, unit: true } },
      },
      orderBy: { bomId: 'asc' },
    })

    return NextResponse.json({ boms })
  } catch (error) {
    console.error('BOM list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create BOM component
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bom:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { bomId, ...data } = bomComponentSchema.parse(body)

    if (!bomId) {
      return NextResponse.json({ error: 'bomId (productId du produit fini) est requis' }, { status: 400 })
    }

    // Check bom product exists
    const bomProduct = await db.product.findUnique({ where: { id: bomId } })
    if (!bomProduct) {
      return NextResponse.json({ error: 'Produit fini introuvable' }, { status: 404 })
    }

    // Check component exists
    const component = await db.product.findUnique({ where: { id: data.componentId } })
    if (!component) {
      return NextResponse.json({ error: 'Composant introuvable' }, { status: 404 })
    }

    // Check for duplicate
    const existing = await db.bomComponent.findUnique({
      where: { bomId_componentId: { bomId, componentId: data.componentId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Ce composant existe déjà dans la nomenclature' }, { status: 409 })
    }

    const bomComponent = await db.bomComponent.create({
      data: {
        bomId,
        componentId: data.componentId,
        quantity: data.quantity,
        notes: data.notes,
      },
      include: {
        bom: { select: { id: true, reference: true, designation: true } },
        component: { select: { id: true, reference: true, designation: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'BomComponent', bomComponent.id, null, bomComponent)
    return NextResponse.json(bomComponent, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('BOM create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update BOM component
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bom:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, quantity, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.bomComponent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Composant BOM introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (quantity !== undefined) updateData.quantity = quantity
    if (notes !== undefined) updateData.notes = notes

    const bomComponent = await db.bomComponent.update({
      where: { id },
      data: updateData,
      include: {
        bom: { select: { id: true, reference: true, designation: true } },
        component: { select: { id: true, reference: true, designation: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'BomComponent', id, existing, bomComponent)
    return NextResponse.json(bomComponent)
  } catch (error) {
    console.error('BOM update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete BOM component
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bom:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.bomComponent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Composant BOM introuvable' }, { status: 404 })
    }

    await db.bomComponent.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'BomComponent', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('BOM delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
