import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const productSchema = z.object({
  reference: z.string().min(1, 'La référence est requise'),
  designation: z.string().min(1, 'La désignation est requise'),
  description: z.string().optional(),
  famille: z.string().optional(),
  sousFamille: z.string().optional(),
  priceHT: z.number().min(0),
  tvaRate: z.number().default(20),
  unit: z.string().default('unité'),
  productNature: z.string().default('produit_fini'),
  productUsage: z.string().default('vente'),
  isStockable: z.boolean().default(true),
  currentStock: z.number().default(0),
  minStock: z.number().default(0),
  maxStock: z.number().default(100),
  averageCost: z.number().default(0),
  isActive: z.boolean().default(true),
})

// GET - List products with pagination
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'products:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const productUsage = searchParams.get('productUsage') || ''
    const productNature = searchParams.get('productNature') || ''
    const famille = searchParams.get('famille') || ''
    const sousFamille = searchParams.get('sousFamille') || ''
    const activeOnly = searchParams.get('active') !== 'false'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const searchDesignation = searchParams.get('searchDesignation') || ''
    const dropdown = searchParams.get('dropdown') === 'true'

    const where: Record<string, unknown> = {}
    if (searchDesignation) {
      where.designation = { contains: searchDesignation, mode: 'insensitive' }
    } else if (search) {
      where.designation = { contains: search, mode: 'insensitive' }
    }
    if (productUsage) {
      where.productUsage = { contains: productUsage }
    }
    if (productNature) {
      where.productNature = productNature
    }
    if (famille) {
      where.famille = famille
    }
    if (sousFamille) {
      where.sousFamille = sousFamille
    }
    if (activeOnly) {
      where.isActive = true
    }

    // Dropdown mode: lightweight response for select components (no pagination)
    if (dropdown) {
      const products = await db.product.findMany({
        where,
        orderBy: { designation: 'asc' },
        select: { id: true, reference: true, designation: true, priceHT: true, tvaRate: true, productUsage: true, productNature: true },
      })
      return NextResponse.json({ products, total: products.length })
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ products, total, page, limit, totalPages })
  } catch (error) {
    console.error('Products list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create product
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'products:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = productSchema.parse(body)

    const existing = await db.product.findUnique({ where: { reference: data.reference } })
    if (existing) {
      return NextResponse.json({ error: 'Cette référence existe déjà' }, { status: 409 })
    }

    const product = await db.product.create({ data })

    await auditLog(auth.userId, 'create', 'Product', product.id, null, product)

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Product create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update product
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'products:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    const data = productSchema.partial().parse(updateData)

    const product = await db.product.update({ where: { id }, data })

    await auditLog(auth.userId, 'update', 'Product', id, existing, product)

    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Product update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete product
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'products:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    await db.product.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Product', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
