import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  siret: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('France'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  creditLimit: z.number().default(0),
  paymentTerms: z.string().default('30 jours'),
  notes: z.string().optional(),
})

// GET - List clients
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:read')) {
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

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.client.count({ where }),
    ])

    return NextResponse.json({ clients, total, page, limit })
  } catch (error) {
    console.error('Clients list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create client
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = clientSchema.parse(body)

    const client = await db.client.create({ data })

    await auditLog(auth.userId, 'create', 'Client', client.id, null, client)

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Client create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update client
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const data = clientSchema.partial().parse(updateData)

    const client = await db.client.update({ where: { id }, data })

    await auditLog(auth.userId, 'update', 'Client', id, existing, client)

    return NextResponse.json(client)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Client update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete client
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.client.findUnique({
      where: { id },
      include: {
        quotes: true,
        salesOrders: true,
        invoices: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    if (existing.quotes.length > 0 || existing.salesOrders.length > 0 || existing.invoices.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un client avec des documents associés' }, { status: 400 })
    }

    await db.client.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Client', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Client delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
