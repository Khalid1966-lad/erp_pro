import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

// ── Schemas ──

const planSchema = z.object({
  equipementId: z.string().min(1),
  type: z.enum(['temporel', 'usage']),
  frequence: z.number().int().positive(),
  description: z.string().min(1),
  piecesNecessaires: z.string().optional(),
  dureeEstimee: z.number().optional(),
  responsableId: z.string().optional(),
  actif: z.boolean().optional(),
})

const otmSchema = z.object({
  equipementId: z.string().min(1),
  planMaintenanceId: z.string().optional(),
  typeMaintenance: z.enum(['preventive', 'corrective', 'conditionnelle', 'ameliorative']).optional(),
  priorite: z.enum(['urgente', 'haute', 'normale', 'basse']).optional(),
  datePlanifiee: z.string().datetime().optional().nullable(),
  description: z.string().min(1),
  rapport: z.string().optional(),
  responsableId: z.string().optional(),
  notes: z.string().optional(),
})

const pieceSchema = z.object({
  otmId: z.string().min(1),
  productId: z.string().min(1),
  quantiteNecessaire: z.number().positive(),
  coutUnitaire: z.number().optional(),
})

async function generateOTMNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.ordreTravailMaintenance.count()
  return `OTM-${year}-${String(count + 1).padStart(4, '0')}`
}

// ══════════════════════════════════════════════════════════════
// GET - List maintenance orders + plans
// ══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'ordres' // 'ordres' | 'plans'
    const search = searchParams.get('search') || ''
    const statut = searchParams.get('statut') || ''
    const typeMaintenance = searchParams.get('typeMaintenance') || ''
    const priorite = searchParams.get('priorite') || ''
    const equipementId = searchParams.get('equipementId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // ── PLANS MODE ──
    if (mode === 'plans') {
      const where: Record<string, unknown> = {}
      if (equipementId) where.equipementId = equipementId

      const plans = await db.planMaintenance.findMany({
        where,
        include: {
          equipement: { select: { id: true, code: true, designation: true, statut: true } },
        },
        orderBy: { prochaineExecution: 'asc' },
      })
      return NextResponse.json({ plans })
    }

    // ── ORDRES MODE ──
    const where: Record<string, unknown> = {}
    if (statut) where.statut = statut
    if (typeMaintenance) where.typeMaintenance = typeMaintenance
    if (priorite) where.priorite = priorite
    if (equipementId) where.equipementId = equipementId
    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { equipement: { code: { contains: search, mode: 'insensitive' } } },
        { equipement: { designation: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [ordres, total] = await Promise.all([
      db.ordreTravailMaintenance.findMany({
        where,
        include: {
          equipement: { select: { id: true, code: true, designation: true, statut: true, criticite: true } },
          planMaintenance: { select: { id: true, description: true } },
          pieces: { include: { product: { select: { id: true, reference: true, designation: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ordreTravailMaintenance.count({ where }),
    ])

    return NextResponse.json({ ordres, total, page, limit })
  } catch (error) {
    console.error('Maintenance list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
// POST - Create plan or OTM
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ── Create Plan ──
    if (body.mode === 'plan') {
      const data = planSchema.parse(body)

      const equipement = await db.equipement.findUnique({ where: { id: data.equipementId } })
      if (!equipement) {
        return NextResponse.json({ error: 'Équipement introuvable' }, { status: 404 })
      }

      const plan = await db.planMaintenance.create({
        data: {
          equipementId: data.equipementId,
          type: data.type,
          frequence: data.frequence,
          description: data.description,
          piecesNecessaires: data.piecesNecessaires,
          dureeEstimee: data.dureeEstimee,
          responsableId: data.responsableId,
          actif: data.actif ?? true,
          // Calculate next execution based on type
          ...(data.type === 'temporel'
            ? { prochaineExecution: new Date(Date.now() + data.frequence * 24 * 60 * 60 * 1000) }
            : { prochaineExecution: new Date() }
          ),
        },
      })

      await auditLog(auth.userId, 'create', 'PlanMaintenance', plan.id, null, plan)
      return NextResponse.json(plan, { status: 201 })
    }

    // ── Create OTM ──
    const data = otmSchema.parse(body)

    const equipement = await db.equipement.findUnique({ where: { id: data.equipementId } })
    if (!equipement) {
      return NextResponse.json({ error: 'Équipement introuvable' }, { status: 404 })
    }

    const numero = await generateOTMNumber()

    const otm = await db.ordreTravailMaintenance.create({
      data: {
        numero,
        equipementId: data.equipementId,
        planMaintenanceId: data.planMaintenanceId || null,
        typeMaintenance: data.typeMaintenance || 'corrective',
        priorite: data.priorite || 'normale',
        statut: 'planifiee',
        datePlanifiee: data.datePlanifiee ? new Date(data.datePlanifiee) : new Date(),
        description: data.description,
        responsableId: data.responsableId,
        notes: data.notes,
      },
    })

    // If corrective/panne, update equipment status
    if (data.typeMaintenance === 'corrective') {
      await db.equipement.update({
        where: { id: data.equipementId },
        data: { statut: 'en_maintenance' },
      })
    }

    await auditLog(auth.userId, 'create', 'OrdreTravailMaintenance', otm.id, null, otm)
    return NextResponse.json(otm, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Maintenance create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
// PUT - Update plan, OTM, or change status
// ══════════════════════════════════════════════════════════════
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { mode, id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // ── Update Plan ──
    if (mode === 'plan') {
      const existing = await db.planMaintenance.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })
      }
      const updated = await db.planMaintenance.update({ where: { id }, data: updateData })
      await auditLog(auth.userId, 'update', 'PlanMaintenance', id, existing, updated)
      return NextResponse.json(updated)
    }

    // ── OTM Status transitions ──
    if (action === 'update_status') {
      const existing = await db.ordreTravailMaintenance.findUnique({
        where: { id },
        include: { equipement: true, pieces: true },
      })
      if (!existing) {
        return NextResponse.json({ error: 'OTM introuvable' }, { status: 404 })
      }

      const newStatut = updateData.statut
      const updates: Record<string, unknown> = { statut: newStatut }

      // Start: record start date
      if (newStatut === 'en_cours' && existing.statut === 'planifiee') {
        updates.dateDebut = new Date()
        await db.equipement.update({ where: { id: existing.equipementId }, data: { statut: 'en_maintenance' } })
      }

      // Waiting for parts
      if (newStatut === 'en_attente_pieces') {
        updates.dateDebut = existing.dateDebut || new Date()
      }

      // Complete: record end date + calculate duration
      if (newStatut === 'terminee') {
        updates.dateFin = new Date()
      }

      // Validate: update plan next execution, return equipment to service
      if (newStatut === 'validee') {
        // Calculate total cost from pieces
        const totalPieces = existing.pieces.reduce((s: number, p: { quantiteUtilisee: number; coutUnitaire: number }) => s + p.quantiteUtilisee * p.coutUnitaire, 0)
        updates.coutPieces = totalPieces
        updates.dateFin = existing.dateFin || new Date()

        // Return equipment to service
        await db.equipement.update({ where: { id: existing.equipementId }, data: { statut: 'en_service' } })

        // Update plan if linked
        if (existing.planMaintenanceId) {
          const plan = await db.planMaintenance.findUnique({ where: { id: existing.planMaintenanceId } })
          if (plan) {
            const nextExec = plan.type === 'temporel'
              ? new Date(Date.now() + plan.frequence * 24 * 60 * 60 * 1000)
              : new Date()
            await db.planMaintenance.update({
              where: { id: plan.id },
              data: {
                derniereExecution: new Date(),
                prochaineExecution: nextExec,
              },
            })
          }
        }
      }

      // Cancel: return equipment to service
      if (newStatut === 'annulee') {
        await db.equipement.update({ where: { id: existing.equipementId }, data: { statut: 'en_service' } })
      }

      // Resume from en_attente_pieces to en_cours
      if (newStatut === 'en_cours' && existing.statut === 'en_attente_pieces') {
        // Already started, no date change needed
      }

      const updated = await db.ordreTravailMaintenance.update({ where: { id }, data: updates })
      await auditLog(auth.userId, 'update_status', 'OrdreTravailMaintenance', id, existing, updated)
      return NextResponse.json(updated)
    }

    // ── Update OTM report ──
    if (action === 'update_report') {
      const existing = await db.ordreTravailMaintenance.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'OTM introuvable' }, { status: 404 })
      }
      const updated = await db.ordreTravailMaintenance.update({
        where: { id },
        data: {
          rapport: updateData.rapport,
          coutMainOeuvre: updateData.coutMainOeuvre,
          machineArretee: updateData.machineArretee,
          arretDebut: updateData.arretDebut ? new Date(updateData.arretDebut) : null,
          arretFin: updateData.arretFin ? new Date(updateData.arretFin) : null,
          productionPerdue: updateData.productionPerdue,
          notes: updateData.notes,
        },
      })
      return NextResponse.json(updated)
    }

    // ── Add piece to OTM ──
    if (action === 'add_piece') {
      const pieceData = pieceSchema.parse({ ...updateData, otmId: id })
      const product = await db.product.findUnique({ where: { id: pieceData.productId } })
      if (!product) {
        return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
      }
      const piece = await db.oTMPiece.create({
        data: {
          otmId: id,
          productId: pieceData.productId,
          quantiteNecessaire: pieceData.quantiteNecessaire,
          coutUnitaire: pieceData.coutUnitaire || product.averageCost,
        },
      })
      return NextResponse.json(piece, { status: 201 })
    }

    // ── Update piece (mark as used) ──
    if (action === 'update_piece') {
      const { pieceId, quantiteUtilisee } = updateData as { pieceId: string; quantiteUtilisee: number }
      const piece = await db.oTMPiece.findUnique({ where: { id: pieceId } })
      if (!piece || piece.otmId !== id) {
        return NextResponse.json({ error: 'Pièce introuvable' }, { status: 404 })
      }
      const updated = await db.oTMPiece.update({
        where: { id: pieceId },
        data: { quantiteUtilisee },
      })

      // If piece is being consumed, create stock movement
      if (quantiteUtilisee > 0) {
        await db.stockMovement.create({
          data: {
            productId: piece.productId,
            type: 'out',
            origin: 'maintenance',
            quantity: quantiteUtilisee,
            unitCost: piece.coutUnitaire,
            documentRef: `OTM-${(await db.ordreTravailMaintenance.findUnique({ where: { id } }))?.numero || id}`,
            notes: 'Pièce consommée pour maintenance',
          },
        })
        await db.product.update({
          where: { id: piece.productId },
          data: { currentStock: { decrement: quantiteUtilisee } },
        })
      }

      return NextResponse.json(updated)
    }

    // Simple update
    const existing = await db.ordreTravailMaintenance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'OTM introuvable' }, { status: 404 })
    }
    const updated = await db.ordreTravailMaintenance.update({ where: { id }, data: updateData })
    await auditLog(auth.userId, 'update', 'OrdreTravailMaintenance', id, existing, updated)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Maintenance update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
// DELETE - Delete plan or OTM
// ══════════════════════════════════════════════════════════════
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const mode = searchParams.get('mode') || 'otm'

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    if (mode === 'plan') {
      const existing = await db.planMaintenance.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })
      }
      // Check for linked OTMs
      const linkedOTMs = await db.ordreTravailMaintenance.count({
        where: { planMaintenanceId: id, statut: { in: ['planifiee', 'en_cours'] } },
      })
      if (linkedOTMs > 0) {
        return NextResponse.json({ error: 'Impossible de supprimer un plan avec des OTM actifs' }, { status: 400 })
      }
      await db.planMaintenance.delete({ where: { id } })
      await auditLog(auth.userId, 'delete', 'PlanMaintenance', id, existing, null)
      return NextResponse.json({ success: true })
    }

    // Delete OTM
    const existing = await db.ordreTravailMaintenance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'OTM introuvable' }, { status: 404 })
    }
    if (!['planifiee', 'annulee'].includes(existing.statut)) {
      return NextResponse.json({ error: 'Impossible de supprimer un OTM en cours ou terminé' }, { status: 400 })
    }
    await db.oTMPiece.deleteMany({ where: { otmId: id } })
    await db.ordreTravailMaintenance.delete({ where: { id } })

    // Return equipment to service if it was corrective
    if (existing.typeMaintenance === 'corrective' && existing.statut === 'planifiee') {
      await db.equipement.update({ where: { id: existing.equipementId }, data: { statut: 'en_service' } })
    }

    await auditLog(auth.userId, 'delete', 'OrdreTravailMaintenance', id, existing, null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Maintenance delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
