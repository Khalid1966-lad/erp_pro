import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  siret: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('Maroc'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  deliveryDelay: z.number().default(7),
  paymentTerms: z.string().default('30 jours'),
  notes: z.string().optional(),
  rating: z.number().min(0).max(5).default(0),
})

// GET - List suppliers
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'suppliers:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { siret: { contains: search } },
      ]
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: { select: { purchaseOrders: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supplier.count({ where }),
    ])

    return NextResponse.json({ suppliers, total, page, limit })
  } catch (error) {
    console.error('Suppliers list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create supplier
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'suppliers:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = supplierSchema.parse(body)

    const supplier = await db.supplier.create({ data })

    await auditLog(auth.userId, 'create', 'Supplier', supplier.id, null, supplier)
    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update supplier
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'suppliers:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    const data = supplierSchema.partial().parse(updateData)
    const supplier = await db.supplier.update({ where: { id }, data })

    await auditLog(auth.userId, 'update', 'Supplier', id, existing, supplier)
    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete supplier
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'suppliers:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.supplier.findUnique({
      where: { id },
      include: { purchaseOrders: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    if (existing.purchaseOrders.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un fournisseur avec des commandes associées' }, { status: 400 })
    }

    await db.supplier.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Supplier', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Supplier delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
