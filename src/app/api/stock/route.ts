import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const stockMovementSchema = z.object({
  productId: z.string(),
  type: z.enum(['in', 'out', 'adjustment']),
  origin: z.enum([
    'purchase_reception',
    'production_input',
    'production_output',
    'sale',
    'return',
    'inventory_adjustment',
    'manual',
  ]),
  quantity: z.number().min(0.01),
  unitCost: z.number().default(0),
  documentRef: z.string().optional(),
  notes: z.string().optional(),
})

// GET - List stock movements + stock alerts
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'movements' // movements | alerts | all
    const productId = searchParams.get('productId') || ''
    const type = searchParams.get('type') || ''
    const origin = searchParams.get('origin') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Stock alerts view
    if (view === 'alerts') {
      const lowStockProducts = await db.product.findMany({
        where: {
          isActive: true,
          currentStock: { lte: db.product.fields.minStock },
        },
        orderBy: { currentStock: 'asc' },
      })

      const outOfStockProducts = lowStockProducts.filter((p) => p.currentStock <= 0)
      const belowMinStock = lowStockProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock)

      return NextResponse.json({
        alerts: lowStockProducts,
        total: lowStockProducts.length,
        outOfStock: outOfStockProducts.length,
        belowMinStock: belowMinStock.length,
      })
    }

    // Movements list
    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (type) where.type = type
    if (origin) where.origin = origin

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, reference: true, designation: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.stockMovement.count({ where }),
    ])

    return NextResponse.json({ movements, total, page, limit })
  } catch (error) {
    console.error('Stock movements list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create stock movement
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = stockMovementSchema.parse(body)

    const product = await db.product.findUnique({ where: { id: data.productId } })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // Check stock availability for outgoing movements
    if (data.type === 'out' && product.currentStock < data.quantity) {
      return NextResponse.json({
        error: `Stock insuffisant (stock: ${product.currentStock}, demandé: ${data.quantity})`,
      }, { status: 400 })
    }

    // Create stock movement
    const movement = await db.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        origin: data.origin,
        quantity: data.quantity,
        unitCost: data.unitCost,
        documentRef: data.documentRef,
        notes: data.notes,
      },
      include: { product: true },
    })

    // Update product stock
    const stockChange = data.type === 'in'
      ? { increment: data.quantity }
      : data.type === 'out'
        ? { decrement: data.quantity }
        : 0 // adjustment handled separately

    if (data.type !== 'adjustment') {
      await db.product.update({
        where: { id: data.productId },
        data: { currentStock: stockChange },
      })
    }

    await auditLog(auth.userId, 'create', 'StockMovement', movement.id, null, movement)
    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Stock movement create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Adjust stock (manual adjustment)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { productId, newQuantity, reason } = z.object({
      productId: z.string(),
      newQuantity: z.number().min(0),
      reason: z.string().optional(),
    }).parse(body)

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    const difference = newQuantity - product.currentStock

    if (Math.abs(difference) < 0.001) {
      return NextResponse.json({ error: 'La nouvelle quantité est identique à l\'actuelle' }, { status: 400 })
    }

    // Create adjustment movement
    const movement = await db.stockMovement.create({
      data: {
        productId,
        type: 'adjustment',
        origin: 'manual',
        quantity: Math.abs(difference),
        unitCost: product.averageCost,
        notes: reason || `Ajustement manuel: ${product.currentStock} → ${newQuantity}`,
      },
      include: { product: true },
    })

    // Update product stock
    await db.product.update({
      where: { id: productId },
      data: { currentStock: newQuantity },
    })

    await auditLog(auth.userId, 'adjust', 'Product', productId, { currentStock: product.currentStock }, { currentStock: newQuantity })
    return NextResponse.json(movement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Stock adjustment error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
