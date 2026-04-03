import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const inventoryLineSchema = z.object({
  productId: z.string(),
  systemQty: z.number(),
  physicalQty: z.number(),
  unitCost: z.number().default(0),
  notes: z.string().optional(),
})

const inventorySchema = z.object({
  type: z.enum(['tournant', 'complet', 'exceptionnel']).default('tournant'),
  notes: z.string().optional(),
  lines: z.array(inventoryLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generateInventoryNumber(): Promise<string> {
  const count = await db.inventory.count()
  const year = new Date().getFullYear()
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List inventories
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [inventories, total] = await Promise.all([
      db.inventory.findMany({
        where,
        include: {
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inventory.count({ where }),
    ])

    return NextResponse.json({ inventories, total, page, limit })
  } catch (error) {
    console.error('Inventories list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create inventory
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = inventorySchema.parse(body)

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    const number = await generateInventoryNumber()

    const linesData = data.lines.map((line) => ({
      productId: line.productId,
      systemQty: line.systemQty,
      physicalQty: line.physicalQty,
      difference: line.physicalQty - line.systemQty,
      unitCost: line.unitCost,
      notes: line.notes,
    }))

    const inventory = await db.inventory.create({
      data: {
        number,
        type: data.type,
        status: 'en_cours',
        lines: { create: linesData },
      },
      include: {
        lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
      },
    })

    await auditLog(auth.userId, 'create', 'Inventory', inventory.id, null, inventory)
    return NextResponse.json(inventory, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Inventory create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update inventory / Validate
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.inventory.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Inventaire introuvable' }, { status: 404 })
    }

    // Validate inventory - apply stock adjustments
    if (action === 'validate') {
      if (existing.status !== 'en_cours') {
        return NextResponse.json({ error: 'Seul un inventaire en cours peut être validé' }, { status: 400 })
      }

      // Apply stock adjustments for each line with differences
      for (const line of existing.lines) {
        if (Math.abs(line.difference) < 0.001) continue

        // Create stock movement
        await db.stockMovement.create({
          data: {
            productId: line.productId,
            type: line.difference > 0 ? 'in' : 'out',
            origin: 'inventory_adjustment',
            quantity: Math.abs(line.difference),
            unitCost: line.unitCost,
            documentRef: existing.number,
            notes: `Ajustement inventaire ${existing.number}`,
          },
        })

        // Update product stock
        await db.product.update({
          where: { id: line.productId },
          data: { currentStock: line.physicalQty },
        })
      }

      const inventory = await db.inventory.update({
        where: { id },
        data: {
          status: 'termine',
          completedAt: new Date(),
        },
        include: {
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
      })

      await auditLog(auth.userId, 'validate', 'Inventory', id, existing, inventory)
      return NextResponse.json(inventory)
    }

    // Simple update
    if (action === 'update_lines' && updateData.lines) {
      // Delete existing lines and recreate
      await db.inventoryLine.deleteMany({ where: { inventoryId: id } })

      const linesData = updateData.lines.map((line: z.infer<typeof inventoryLineSchema>) => ({
        productId: line.productId,
        systemQty: line.systemQty,
        physicalQty: line.physicalQty,
        difference: line.physicalQty - line.systemQty,
        unitCost: line.unitCost,
        notes: line.notes,
      }))

      const inventory = await db.inventory.update({
        where: { id },
        data: { lines: { create: linesData } },
        include: {
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
        },
      })

      await auditLog(auth.userId, 'update', 'Inventory', id, existing, inventory)
      return NextResponse.json(inventory)
    }

    const inventory = await db.inventory.update({
      where: { id },
      data: updateData,
      include: {
        lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
      },
    })

    await auditLog(auth.userId, 'update', 'Inventory', id, existing, inventory)
    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Inventory update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete inventory
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.inventory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Inventaire introuvable' }, { status: 404 })
    }

    if (existing.status === 'termine') {
      return NextResponse.json({ error: 'Impossible de supprimer un inventaire terminé' }, { status: 400 })
    }

    await db.inventoryLine.deleteMany({ where: { inventoryId: id } })
    await db.inventory.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Inventory', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Inventory delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
