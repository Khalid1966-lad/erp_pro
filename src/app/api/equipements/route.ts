import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  code: z.string().min(1),
  designation: z.string().min(1),
  type: z.enum(['extrudeuse','moule','compresseur','four','decoupeuse','emballage','pompe','moteur','climatisation','convoyeur','generateur','autre']).optional(),
  marque: z.string().optional(),
  modele: z.string().optional(),
  numeroSerie: z.string().optional(),
  dateInstallation: z.string().datetime().optional().nullable(),
  emplacement: z.string().optional(),
  statut: z.enum(['en_service','en_panne','en_maintenance','hors_service','en_reserve']).optional(),
  criticite: z.enum(['haute','moyenne','basse']).optional(),
  ficheTechnique: z.string().optional(),
  notes: z.string().optional(),
})

async function generateCode(): Promise<string> {
  const count = await db.equipement.count()
  return `EQ-${String(count + 1).padStart(4, '0')}`
}

// GET - List equipment
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const statut = searchParams.get('statut') || ''
    const type = searchParams.get('type') || ''
    const criticite = searchParams.get('criticite') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (statut) where.statut = statut
    if (type) where.type = type
    if (criticite) where.criticite = criticite
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { marque: { contains: search, mode: 'insensitive' } },
        { emplacement: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [equipements, total] = await Promise.all([
      db.equipement.findMany({
        where,
        include: {
          _count: { select: { plans: true, ordres: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.equipement.count({ where }),
    ])

    // Get next planned maintenance for each equipment
    const enriched = await Promise.all(equipements.map(async (eq) => {
      const nextPlan = await db.planMaintenance.findFirst({
        where: { equipementId: eq.id, actif: true },
        orderBy: { prochaineExecution: 'asc' },
      })
      return {
        ...eq,
        prochaineMaintenance: nextPlan?.prochaineExecution || null,
        alerteMaintenance: nextPlan?.prochaineExecution
          ? (new Date(nextPlan.prochaineExecution).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7
          : false,
      }
    }))

    return NextResponse.json({ equipements: enriched, total, page, limit })
  } catch (error) {
    console.error('Equipements list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create equipment
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const existing = await db.equipement.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: 'Ce code équipement existe déjà' }, { status: 400 })
    }

    const equipement = await db.equipement.create({
      data: {
        code: data.code,
        designation: data.designation,
        type: data.type || 'autre',
        marque: data.marque,
        modele: data.modele,
        numeroSerie: data.numeroSerie,
        dateInstallation: data.dateInstallation ? new Date(data.dateInstallation) : null,
        emplacement: data.emplacement,
        statut: data.statut || 'en_service',
        criticite: data.criticite || 'moyenne',
        ficheTechnique: data.ficheTechnique,
        notes: data.notes,
      },
    })

    await auditLog(auth.userId, 'create', 'Equipement', equipement.id, null, equipement)
    return NextResponse.json(equipement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Equipement create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update equipment
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.equipement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Équipement introuvable' }, { status: 404 })
    }

    if (updateData.code && updateData.code !== existing.code) {
      const dup = await db.equipement.findUnique({ where: { code: updateData.code } })
      if (dup) {
        return NextResponse.json({ error: 'Ce code équipement existe déjà' }, { status: 400 })
      }
    }

    const updated = await db.equipement.update({
      where: { id },
      data: updateData,
    })

    await auditLog(auth.userId, 'update', 'Equipement', id, existing, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Equipement update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete equipment
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.equipement.findUnique({
      where: { id },
      include: { _count: { select: { plans: true, ordres: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Équipement introuvable' }, { status: 404 })
    }

    // Check for active maintenance orders
    const activeOrdres = await db.ordreTravailMaintenance.count({
      where: { equipementId: id, statut: { in: ['planifiee', 'en_cours', 'en_attente_pieces'] } },
    })
    if (activeOrdres > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un équipement avec des ordres de maintenance actifs' }, { status: 400 })
    }

    await db.planMaintenance.deleteMany({ where: { equipementId: id } })
    await db.equipement.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Equipement', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Equipement delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
