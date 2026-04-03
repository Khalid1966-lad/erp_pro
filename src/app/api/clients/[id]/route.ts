import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { clientUpdateSchema } from '@/lib/validations/client'
import { Prisma } from '@prisma/client'

// GET /api/clients/[id] — Get single client with contacts and documents
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:read') && !hasPermission(auth, 'clients:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const client = await db.client.findUnique({
      where: { id, isDeleted: false },
      include: {
        contacts: { orderBy: { type: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            quotes: true,
            salesOrders: true,
            invoices: true,
            creditNotes: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Client get error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/clients/[id] — Update client
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:edit') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.client.findUnique({
      where: { id, isDeleted: false },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const data = clientUpdateSchema.parse(body)

    // Check ICE uniqueness if changed
    if (data.ice && data.ice !== existing.ice) {
      const existingIce = await db.client.findUnique({ where: { ice: data.ice } })
      if (existingIce) {
        return NextResponse.json(
          { error: 'Un client avec cet ICE existe déjà', field: 'ice' },
          { status: 409 }
        )
      }
    }

    // Check email uniqueness if changed
    if (data.email && data.email !== existing.email) {
      const existingEmail = await db.client.findUnique({ where: { email: data.email } })
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Un client avec cet email existe déjà', field: 'email' },
          { status: 409 }
        )
      }
    }

    // Map date strings to Date objects
    const updateData: Record<string, unknown> = { ...data }
    if (data.dateCreation !== undefined) {
      updateData.dateCreation = data.dateCreation ? new Date(data.dateCreation) : null
    }
    if (data.datePremierAchat !== undefined) {
      updateData.datePremierAchat = data.datePremierAchat ? new Date(data.datePremierAchat) : null
    }
    if (data.dateDernierAchat !== undefined) {
      updateData.dateDernierAchat = data.dateDernierAchat ? new Date(data.dateDernierAchat) : null
    }
    if (data.dernierDevisDate !== undefined) {
      updateData.dernierDevisDate = data.dernierDevisDate ? new Date(data.dernierDevisDate) : null
    }
    if (data.derniereFactureDate !== undefined) {
      updateData.derniereFactureDate = data.derniereFactureDate ? new Date(data.derniereFactureDate) : null
    }
    if (data.derniereRelanceDate !== undefined) {
      updateData.derniereRelanceDate = data.derniereRelanceDate ? new Date(data.derniereRelanceDate) : null
    }

    // Sync legacy fields from new Moroccan fields
    if (updateData.raisonSociale) updateData.name = updateData.raisonSociale
    if (updateData.adresse !== undefined) updateData.address = updateData.adresse
    if (updateData.ville !== undefined) updateData.city = updateData.ville
    if (updateData.codePostal !== undefined) updateData.postalCode = updateData.codePostal
    if (updateData.telephone !== undefined) updateData.phone = updateData.telephone
    if (updateData.seuilCredit !== undefined) updateData.creditLimit = updateData.seuilCredit
    if (updateData.conditionsPaiement) updateData.paymentTerms = updateData.conditionsPaiement

    // Increment version
    updateData.version = { increment: 1 }
    updateData.updatedBy = auth.userId

    const client = await db.client.update({
      where: { id },
      data: updateData,
    })

    await auditLog(auth.userId, 'update', 'Client', id, existing, client)

    return NextResponse.json(client)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    const zodErr = error as { errors?: Array<{ message: string; path: (string | number)[] }> }
    if (zodErr.errors && zodErr.errors.length > 0) {
      return NextResponse.json(
        { error: 'Données invalides', details: zodErr.errors },
        { status: 400 }
      )
    }
    console.error('Client update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/clients/[id] — Soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:delete') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const existing = await db.client.findUnique({
      where: { id, isDeleted: false },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    await db.client.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedBy: auth.userId,
      },
    })

    await auditLog(auth.userId, 'delete', 'Client', id, existing, null)

    return NextResponse.json({ success: true, message: 'Client supprimé (archivé)' })
  } catch (error) {
    console.error('Client delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
