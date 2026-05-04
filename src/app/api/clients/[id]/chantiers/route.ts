import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

// ─── Validation Schemas ───

const createChantierSchema = z.object({
  nomProjet: z.string().min(1, 'Le nom du projet est requis'),
  adresse: z.string().min(1, "L'adresse est requise"),
  ville: z.string().min(1, 'La ville est requise'),
  codePostal: z.string().optional(),
  provincePrefecture: z.string().optional(),
  responsableNom: z.string().min(1, 'Le nom du responsable est requis'),
  responsableFonction: z.string().optional(),
  telephone: z.string().optional(),
  gsm: z.string().optional(),
  notes: z.string().optional(),
  actif: z.boolean().default(true),
})

const updateChantierSchema = createChantierSchema.partial()

// ═══════════════════════════════════════════════════════════
// GET - List chantiers for a client
// ═══════════════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id: clientId } = await params

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const actifOnly = searchParams.get('actif') !== 'false' // default: only active

    const chantiers = await db.chantier.findMany({
      where: {
        clientId,
        ...(actifOnly ? { actif: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ chantiers })
  } catch (error) {
    console.error('Chantiers list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// POST - Create a chantier
// ═══════════════════════════════════════════════════════════

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id: clientId } = await params

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const body = await req.json()
    const data = createChantierSchema.parse(body)

    const chantier = await db.chantier.create({
      data: {
        clientId,
        nomProjet: data.nomProjet,
        adresse: data.adresse,
        ville: data.ville,
        codePostal: data.codePostal || null,
        provincePrefecture: data.provincePrefecture || null,
        responsableNom: data.responsableNom,
        responsableFonction: data.responsableFonction || null,
        telephone: data.telephone || null,
        gsm: data.gsm || null,
        notes: data.notes || null,
        actif: data.actif,
      },
    })

    await auditLog(auth.userId, 'create', 'Chantier', chantier.id, null, chantier)
    return NextResponse.json(chantier, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Chantier create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT - Update a chantier
// ═══════════════════════════════════════════════════════════

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id: clientId } = await params

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID du chantier requis' }, { status: 400 })
    }

    // Verify chantier belongs to this client
    const existing = await db.chantier.findFirst({
      where: { id, clientId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Chantier introuvable' }, { status: 404 })
    }

    const data = updateChantierSchema.parse(updateData)

    const chantier = await db.chantier.update({
      where: { id },
      data,
    })

    await auditLog(auth.userId, 'update', 'Chantier', id, existing, chantier)
    return NextResponse.json(chantier)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Chantier update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE - Deactivate a chantier (soft delete)
// ═══════════════════════════════════════════════════════════

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id: clientId } = await params

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const chantierId = searchParams.get('id')

    if (!chantierId) {
      return NextResponse.json({ error: 'ID du chantier requis' }, { status: 400 })
    }

    // Verify chantier belongs to this client
    const existing = await db.chantier.findFirst({
      where: { id: chantierId, clientId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Chantier introuvable' }, { status: 404 })
    }

    // Soft delete: deactivate instead of removing
    const chantier = await db.chantier.update({
      where: { id: chantierId },
      data: { actif: false },
    })

    await auditLog(auth.userId, 'delete', 'Chantier', chantierId, existing, chantier)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Chantier delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
