import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { notifyAll } from '@/lib/notify'
import { z } from 'zod'

const priceRequestLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  description: z.string().optional(),
  targetPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
})

const priceRequestSchema = z.object({
  title: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(priceRequestLineSchema).min(1, 'Au moins une ligne requise'),
})

async function generatePRNumber(): Promise<string> {
  const count = await db.priceRequest.count()
  const year = new Date().getFullYear()
  return `DMP-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET - List price requests
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'price_requests:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' as const } },
        { title: { contains: search, mode: 'insensitive' as const } },
        { lines: { some: { product: { designation: { contains: search, mode: 'insensitive' as const } } } } },
      ]
    }

    const [priceRequests, total] = await Promise.all([
      db.priceRequest.findMany({
        where,
        include: {
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
          supplierQuotes: { select: { id: true, number: true, supplier: { select: { id: true, name: true } }, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.priceRequest.count({ where }),
    ])

    return NextResponse.json({ priceRequests, total, page, limit })
  } catch (error) {
    console.error('Price requests list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create price request
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'price_requests:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = priceRequestSchema.parse(body)

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    const number = await generatePRNumber()

    const priceRequest = await db.priceRequest.create({
      data: {
        number,
        title: data.title,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        notes: data.notes,
        lines: { create: data.lines },
      },
      include: {
        lines: { include: { product: true } },
        supplierQuotes: true,
      },
    })

    await auditLog(auth.userId, 'create', 'PriceRequest', priceRequest.id, null, priceRequest)
    notifyAll({ title: 'Nouvelle demande de prix', message: `Demande ${priceRequest.number}`, type: 'success', category: 'order', entityType: 'PriceRequest', entityId: priceRequest.id }).catch(() => {})
    return NextResponse.json(priceRequest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Price request create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update price request
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'price_requests:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, lines, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.priceRequest.findUnique({
      where: { id },
      include: { lines: true, supplierQuotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Demande de prix introuvable' }, { status: 404 })
    }

    // Validate status transition
    const validStatuses = ['draft', 'sent', 'answered', 'partially_answered', 'closed', 'cancelled']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Build update payload
    const data: Record<string, unknown> = {}
    if (updateData.title !== undefined) data.title = updateData.title
    if (updateData.notes !== undefined) data.notes = updateData.notes
    if (updateData.validUntil !== undefined) data.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null
    if (updateData.status !== undefined) data.status = updateData.status

    // If lines are provided, replace them
    if (lines && Array.isArray(lines) && lines.length > 0) {
      const parsedLines = z.array(priceRequestLineSchema).parse(lines)

      const productIds = parsedLines.map((l) => l.productId)
      const products = await db.product.findMany({ where: { id: { in: productIds } } })
      if (products.length !== productIds.length) {
        return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
      }

      await db.priceRequestLine.deleteMany({ where: { priceRequestId: id } })
      data.lines = { create: parsedLines }
    }

    const priceRequest = await db.priceRequest.update({
      where: { id },
      data,
      include: {
        lines: { include: { product: true } },
        supplierQuotes: { select: { id: true, number: true, supplier: { select: { id: true, name: true } }, status: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'PriceRequest', id, existing, priceRequest)
    return NextResponse.json(priceRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Price request update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete price request (only draft)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'price_requests:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.priceRequest.findUnique({
      where: { id },
      include: { supplierQuotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Demande de prix introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seule une demande de prix en brouillon peut être supprimée' }, { status: 400 })
    }

    await db.priceRequestLine.deleteMany({ where: { priceRequestId: id } })
    await db.priceRequest.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'PriceRequest', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Price request delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
