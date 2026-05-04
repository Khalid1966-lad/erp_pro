import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const createLotSchema = z.object({
  productId: z.string().min(1),
  workOrderId: z.string().optional(),
  quantiteInitiale: z.number().positive(),
  dateFabrication: z.string().datetime().optional().nullable(),
  dateExpiration: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
})

const mouvementSchema = z.object({
  lotId: z.string().min(1),
  type: z.enum(['entree', 'sortie', 'reservation', 'annulation_resa', 'retour', 'ajustement']),
  quantite: z.number().positive(),
  documentRef: z.string().optional(),
  documentId: z.string().optional(),
  notes: z.string().optional(),
})

async function generateLotNumber(productId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.lot.count()
  const seq = String(count + 1).padStart(4, '0')
  return `LOT-${year}-${seq}`
}

// GET - List lots
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:read') && !hasPermission(auth, 'work_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId') || ''
    const workOrderId = searchParams.get('workOrderId') || ''
    const statut = searchParams.get('statut') || ''
    const search = searchParams.get('search') || ''
    const includeMouvements = searchParams.get('includeMouvements') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (workOrderId) where.workOrderId = workOrderId
    if (statut) where.statut = statut
    if (search) {
      where.OR = [
        { numeroLot: { contains: search, mode: 'insensitive' } },
        { product: { reference: { contains: search, mode: 'insensitive' } } },
        { product: { designation: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [lots, total] = await Promise.all([
      db.lot.findMany({
        where,
        include: {
          product: { select: { id: true, reference: true, designation: true, unit: true } },
          workOrder: { select: { id: true, number: true } },
          ...(includeMouvements ? {
            mouvements: { orderBy: { createdAt: 'desc' } },
          } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lot.count({ where }),
    ])

    // Calculate derived quantities for each lot
    const lotsWithQty = await Promise.all(lots.map(async (lot) => {
      const mouvements = await db.lotMouvement.groupBy({
        by: ['type'],
        where: { lotId: lot.id },
        _sum: { quantite: true },
      })

      let qtySortie = 0
      let qtyReservee = 0
      let qtyRetour = 0

      for (const m of mouvements) {
        const qty = m._sum.quantite || 0
        if (m.type === 'sortie') qtySortie += qty
        if (m.type === 'reservation') qtyReservee += qty
        if (m.type === 'annulation_resa') qtyReservee -= qty
        if (m.type === 'retour') qtyRetour += qty
      }

      const qtyDisponible = lot.quantiteInitiale - qtySortie - qtyReservee + qtyRetour
      const qtyPhysique = lot.quantiteInitiale - qtySortie + qtyRetour

      return {
        ...lot,
        qtySortie,
        qtyReservee: Math.max(0, qtyReservee),
        qtyRetour,
        qtyDisponible: Math.max(0, qtyDisponible),
        qtyPhysique: Math.max(0, qtyPhysique),
      }
    }))

    return NextResponse.json({ lots: lotsWithQty, total, page, limit })
  } catch (error) {
    console.error('Lots list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET - Single lot with mouvements
export async function GET_DETAIL(req: NextRequest) {
  // This is handled via the GET above with ?includeMouvements=true
  return GET(req)
}

// POST - Create a lot (+ optional entry mouvement)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write') && !hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // Check if this is a lot creation or a mouvement creation
    if (body.type && body.lotId) {
      // This is a mouvement creation
      return handleCreateMouvement(auth, body)
    }

    // This is a lot creation
    const data = createLotSchema.parse(body)

    // Verify product exists
    const product = await db.product.findUnique({ where: { id: data.productId } })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // If workOrderId provided, verify it exists
    if (data.workOrderId) {
      const wo = await db.workOrder.findUnique({ where: { id: data.workOrderId } })
      if (!wo) {
        return NextResponse.json({ error: 'Ordre de fabrication introuvable' }, { status: 404 })
      }
    }

    const numeroLot = await generateLotNumber(data.productId)

    // Ensure uniqueness
    const existing = await db.lot.findUnique({ where: { numeroLot } })
    if (existing) {
      const fallback = `${numeroLot}-${Math.floor(Math.random() * 1000)}`
      const lot = await db.lot.create({
        data: {
          numeroLot: fallback,
          productId: data.productId,
          workOrderId: data.workOrderId || null,
          quantiteInitiale: data.quantiteInitiale,
          statut: 'actif',
          dateFabrication: data.dateFabrication ? new Date(data.dateFabrication) : new Date(),
          dateExpiration: data.dateExpiration ? new Date(data.dateExpiration) : null,
          notes: data.notes,
        },
      })
      // Create initial entry mouvement
      await db.lotMouvement.create({
        data: {
          lotId: lot.id,
          type: 'entree',
          quantite: data.quantiteInitiale,
          documentRef: data.workOrderId ? undefined : 'Création manuelle',
          notes: data.notes || 'Entrée initiale',
        },
      })
      await auditLog(auth.userId, 'create', 'Lot', lot.id, null, lot)
      return NextResponse.json(lot, { status: 201 })
    }

    const lot = await db.lot.create({
      data: {
        numeroLot,
        productId: data.productId,
        workOrderId: data.workOrderId || null,
        quantiteInitiale: data.quantiteInitiale,
        statut: 'actif',
        dateFabrication: data.dateFabrication ? new Date(data.dateFabrication) : new Date(),
        dateExpiration: data.dateExpiration ? new Date(data.dateExpiration) : null,
        notes: data.notes,
      },
    })

    // Create initial entry mouvement
    await db.lotMouvement.create({
      data: {
        lotId: lot.id,
        type: 'entree',
        quantite: data.quantiteInitiale,
        documentRef: data.workOrderId ? undefined : 'Création manuelle',
        notes: data.notes || 'Entrée initiale',
      },
    })

    await auditLog(auth.userId, 'create', 'Lot', lot.id, null, lot)
    return NextResponse.json(lot, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Lot create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

async function handleCreateMouvement(auth: any, body: any) {
  const data = mouvementSchema.parse(body)

  const lot = await db.lot.findUnique({
    where: { id: data.lotId },
    include: { product: true },
  })
  if (!lot) {
    return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
  }

  if (lot.statut === 'epuise') {
    return NextResponse.json({ error: 'Ce lot est épuisé' }, { status: 400 })
  }
  if (lot.statut === 'bloque') {
    return NextResponse.json({ error: 'Ce lot est bloqué' }, { status: 400 })
  }

  // Calculate current available quantity
  const mouvements = await db.lotMouvement.groupBy({
    by: ['type'],
    where: { lotId: data.lotId },
    _sum: { quantite: true },
  })

  let qtySortie = 0
  let qtyReservee = 0
  let qtyRetour = 0
  for (const m of mouvements) {
    const qty = m._sum.quantite || 0
    if (m.type === 'sortie') qtySortie += qty
    if (m.type === 'reservation') qtyReservee += qty
    if (m.type === 'annulation_resa') qtyReservee -= qty
    if (m.type === 'retour') qtyRetour += qty
  }
  const qtyDisponible = lot.quantiteInitiale - qtySortie - qtyReservee + qtyRetour

  // Validate quantity based on type
  if (data.type === 'sortie' && data.quantite > qtyDisponible) {
    return NextResponse.json({
      error: `Quantité insuffisante. Disponible: ${qtyDisponible}, Demandé: ${data.quantite}`,
    }, { status: 400 })
  }
  if (data.type === 'reservation' && data.quantite > qtyDisponible) {
    return NextResponse.json({
      error: `Impossible de réserver plus que la quantité disponible (${qtyDisponible})`,
    }, { status: 400 })
  }
  if (data.type === 'annulation_resa') {
    // Check that there's enough reserved to cancel
    if (data.quantite > qtyReservee) {
      return NextResponse.json({
        error: `Impossible d'annuler plus que la quantité réservée (${qtyReservee})`,
      }, { status: 400 })
    }
  }

  const mouvement = await db.lotMouvement.create({
    data: {
      lotId: data.lotId,
      type: data.type,
      quantite: data.quantite,
      documentRef: data.documentRef,
      documentId: data.documentId,
      notes: data.notes,
    },
  })

  // Update product stock for sortie/retour/entree/ajustement
  if (['sortie', 'retour', 'entree', 'ajustement'].includes(data.type)) {
    const stockChange = (data.type === 'sortie')
      ? -data.quantite
      : data.type === 'retour'
        ? data.quantite
        : data.type === 'entree'
          ? data.quantite
          : 0 // ajustement doesn't auto-update stock

    if (stockChange !== 0) {
      await db.product.update({
        where: { id: lot.productId },
        data: { currentStock: { increment: stockChange } },
      })
    }
  }

  // Create corresponding StockMovement for sortie
  if (data.type === 'sortie') {
    await db.stockMovement.create({
      data: {
        productId: lot.productId,
        type: 'out',
        origin: 'sale',
        quantity: data.quantite,
        unitCost: lot.product.averageCost,
        documentRef: data.documentRef || lot.numeroLot,
        notes: data.notes || `Sortie lot ${lot.numeroLot}`,
      },
    })
  }

  // Check if lot is now exhausted and update status
  const newQtyDisponible = qtyDisponible
    + (data.type === 'retour' ? data.quantite : 0)
    + (data.type === 'entree' ? data.quantite : 0)
    + (data.type === 'annulation_resa' ? data.quantite : 0)
    - (data.type === 'sortie' ? data.quantite : 0)
    - (data.type === 'reservation' ? data.quantite : 0)

  if (newQtyDisponible <= 0 && lot.statut === 'actif') {
    await db.lot.update({
      where: { id: data.lotId },
      data: { statut: 'epuise' },
    })
  } else if (newQtyDisponible > 0 && lot.statut === 'epuise') {
    await db.lot.update({
      where: { id: data.lotId },
      data: { statut: 'actif' },
    })
  }

  await auditLog(auth.userId, 'create_mouvement', 'LotMouvement', mouvement.id, null, mouvement)
  return NextResponse.json(mouvement, { status: 201 })
}

// PUT - Update lot status / info
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'stock:write') && !hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.lot.findUnique({
      where: { id },
      include: { product: true, workOrder: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Update status
    if (action === 'update_status') {
      const newStatut = updateData.statut
      if (!['actif', 'epuise', 'bloque', 'expire'].includes(newStatut)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      const updated = await db.lot.update({
        where: { id },
        data: { statut: newStatut, notes: updateData.notes || existing.notes },
      })
      await auditLog(auth.userId, 'update_status', 'Lot', id, existing, updated)
      return NextResponse.json(updated)
    }

    // Update notes
    if (action === 'update_notes') {
      const updated = await db.lot.update({
        where: { id },
        data: { notes: updateData.notes },
      })
      return NextResponse.json(updated)
    }

    // FIFO allocation: allocate quantity from oldest lots for a product
    if (action === 'fifo_allocate') {
      const { productId, quantity } = updateData as { productId: string; quantity: number }
      if (!productId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: 'productId et quantity requis' }, { status: 400 })
      }

      // Get all active lots for this product ordered by creation date (oldest first = FIFO)
      const activeLots = await db.lot.findMany({
        where: { productId, statut: 'actif' },
        orderBy: { dateFabrication: 'asc' },
      })

      const allocations: { lotId: string; numeroLot: string; quantity: number }[] = []
      let remaining = quantity

      for (const lot of activeLots) {
        if (remaining <= 0) break

        // Calculate available quantity for this lot
        const mouvements = await db.lotMouvement.groupBy({
          by: ['type'],
          where: { lotId: lot.id },
          _sum: { quantite: true },
        })

        let qtySortie = 0
        let qtyReservee = 0
        let qtyRetour = 0
        for (const m of mouvements) {
          const qty = m._sum.quantite || 0
          if (m.type === 'sortie') qtySortie += qty
          if (m.type === 'reservation') qtyReservee += qty
          if (m.type === 'annulation_resa') qtyReservee -= qty
          if (m.type === 'retour') qtyRetour += qty
        }
        const available = lot.quantiteInitiale - qtySortie - qtyReservee + qtyRetour

        if (available > 0) {
          const toAllocate = Math.min(available, remaining)
          allocations.push({
            lotId: lot.id,
            numeroLot: lot.numeroLot,
            quantity: toAllocate,
          })
          remaining -= toAllocate
        }
      }

      if (remaining > 0) {
        return NextResponse.json({
          error: `Stock insuffisant pour FIFO. Manquant: ${remaining}`,
          allocated: allocations,
          remaining,
        }, { status: 400 })
      }

      return NextResponse.json({ allocations, remaining: 0 })
    }

    // FIFO execute: actually create sortie movements from the allocation plan
    if (action === 'fifo_execute') {
      const { productId, quantity, documentRef, documentId, notes: execNotes } = updateData as {
        productId: string; quantity: number; documentRef?: string; documentId?: string; notes?: string
      }
      if (!productId || !quantity || quantity <= 0) {
        return NextResponse.json({ error: 'productId et quantity requis' }, { status: 400 })
      }

      // Get all active lots for this product ordered by fabrication date (oldest first = FIFO)
      const activeLots = await db.lot.findMany({
        where: { productId, statut: 'actif' },
        orderBy: { dateFabrication: 'asc' },
        include: { product: true },
      })

      const allocations: { lotId: string; numeroLot: string; quantity: number }[] = []
      let remaining = quantity

      for (const lot of activeLots) {
        if (remaining <= 0) break

        const mouvements = await db.lotMouvement.groupBy({
          by: ['type'],
          where: { lotId: lot.id },
          _sum: { quantite: true },
        })

        let qtySortie = 0
        let qtyReservee = 0
        let qtyRetour = 0
        for (const m of mouvements) {
          const qty = m._sum.quantite || 0
          if (m.type === 'sortie') qtySortie += qty
          if (m.type === 'reservation') qtyReservee += qty
          if (m.type === 'annulation_resa') qtyReservee -= qty
          if (m.type === 'retour') qtyRetour += qty
        }
        const available = lot.quantiteInitiale - qtySortie - qtyReservee + qtyRetour

        if (available > 0) {
          const toAllocate = Math.min(available, remaining)

          // Create the sortie mouvement
          await db.lotMouvement.create({
            data: {
              lotId: lot.id,
              type: 'sortie',
              quantite: toAllocate,
              documentRef: documentRef || undefined,
              documentId: documentId || undefined,
              notes: execNotes || `Sortie FIFO - ${documentRef || 'Manuel'}`,
            },
          })

          // Create corresponding StockMovement
          await db.stockMovement.create({
            data: {
              productId: lot.productId,
              type: 'out',
              origin: 'sale',
              quantity: toAllocate,
              unitCost: lot.product.averageCost,
              documentRef: documentRef || lot.numeroLot,
              notes: execNotes || `Sortie FIFO lot ${lot.numeroLot}`,
            },
          })

          // Update product stock
          await db.product.update({
            where: { id: lot.productId },
            data: { currentStock: { decrement: toAllocate } },
          })

          allocations.push({
            lotId: lot.id,
            numeroLot: lot.numeroLot,
            quantity: toAllocate,
          })
          remaining -= toAllocate
        }
      }

      // Check if lots are now exhausted
      for (const alloc of allocations) {
        const lotMvts = await db.lotMouvement.groupBy({
          by: ['type'],
          where: { lotId: alloc.lotId },
          _sum: { quantite: true },
        })
        let qs = 0, qr = 0, qret = 0
        for (const m of lotMvts) {
          const qty = m._sum.quantite || 0
          if (m.type === 'sortie') qs += qty
          if (m.type === 'reservation') qr += qty
          if (m.type === 'annulation_resa') qr -= qty
          if (m.type === 'retour') qret += qty
        }
        const lotRecord = await db.lot.findUnique({ where: { id: alloc.lotId } })
        const dispo = (lotRecord?.quantiteInitiale || 0) - qs - qr + qret
        if (dispo <= 0 && lotRecord?.statut === 'actif') {
          await db.lot.update({ where: { id: alloc.lotId }, data: { statut: 'epuise' } })
        }
      }

      if (remaining > 0) {
        return NextResponse.json({
          error: `Stock insuffisant pour FIFO. Manquant: ${remaining}`,
          allocated: allocations,
          remaining,
        }, { status: 400 })
      }

      await auditLog(auth.userId, 'fifo_execute', 'Lot', productId, null, { productId, quantity, allocations, documentRef })
      return NextResponse.json({ allocations, remaining: 0, message: 'FIFO exécuté avec succès' })
    }

    // Simple update
    const updated = await db.lot.update({
      where: { id },
      data: updateData,
    })
    await auditLog(auth.userId, 'update', 'Lot', id, existing, updated)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Lot update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete a lot (only if no mouvements or only initial entry)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'stock:write') && !hasPermission(auth, 'work_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.lot.findUnique({
      where: { id },
      include: { mouvements: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Can only delete if lot has only one mouvement (the initial entry) and is actif
    const nonEntryMouvements = existing.mouvements.filter(m => m.type !== 'entree')
    if (nonEntryMouvements.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un lot ayant des mouvements de sortie ou réservation' }, { status: 400 })
    }

    if (existing.statut !== 'actif') {
      return NextResponse.json({ error: 'Impossible de supprimer un lot non actif' }, { status: 400 })
    }

    // Reverse the stock entry
    await db.product.update({
      where: { id: existing.productId },
      data: { currentStock: { decrement: existing.quantiteInitiale } },
    })

    await db.lotMouvement.deleteMany({ where: { lotId: id } })
    await db.lot.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Lot', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lot delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
