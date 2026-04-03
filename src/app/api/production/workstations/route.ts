import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const workStationSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  efficiency: z.number().min(0).max(200).default(100),
})

// GET - List workstations
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'workstations:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.name = { contains: search }
    }

    const workstations = await db.workStation.findMany({
      where,
      include: {
        _count: { select: { routingSteps: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ workstations })
  } catch (error) {
    console.error('Workstations list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create workstation
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'workstations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = workStationSchema.parse(body)

    const workstation = await db.workStation.create({ data })

    await auditLog(auth.userId, 'create', 'WorkStation', workstation.id, null, workstation)
    return NextResponse.json(workstation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Workstation create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update workstation
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'workstations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.workStation.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Poste de travail introuvable' }, { status: 404 })
    }

    const data = workStationSchema.partial().parse(updateData)
    const workstation = await db.workStation.update({ where: { id }, data })

    await auditLog(auth.userId, 'update', 'WorkStation', id, existing, workstation)
    return NextResponse.json(workstation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Workstation update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete workstation
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'workstations:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.workStation.findUnique({
      where: { id },
      include: { routingSteps: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Poste de travail introuvable' }, { status: 404 })
    }

    if (existing.routingSteps.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un poste de travail utilisé dans des gammes' }, { status: 400 })
    }

    await db.workStation.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'WorkStation', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workstation delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
