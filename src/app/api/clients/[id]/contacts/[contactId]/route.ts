import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { clientContactUpdateSchema } from '@/lib/validations/client'

// GET /api/clients/[id]/contacts/[contactId] — Get single contact
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:read') && !hasPermission(auth, 'clients:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id, contactId } = await params

    const contact = await db.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Client contact get error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/clients/[id]/contacts/[contactId] — Update contact
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:edit') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id, contactId } = await params
    const body = await req.json()

    const existing = await db.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    const data = clientContactUpdateSchema.parse(body)

    const contact = await db.clientContact.update({
      where: { id: contactId },
      data,
    })

    await auditLog(auth.userId, 'update', 'ClientContact', contactId, existing, contact)

    return NextResponse.json(contact)
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
    console.error('Client contact update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/clients/[id]/contacts/[contactId] — Delete contact
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'client:delete') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id, contactId } = await params

    const existing = await db.clientContact.findFirst({
      where: { id: contactId, clientId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    await db.clientContact.delete({ where: { id: contactId } })

    await auditLog(auth.userId, 'delete', 'ClientContact', contactId, existing, null)

    return NextResponse.json({ success: true, message: 'Contact supprimé' })
  } catch (error) {
    console.error('Client contact delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
