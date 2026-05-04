import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'

// GET /api/clients/[id]/documents/[documentId] — Get single document
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:read') && !hasPermission(auth, 'clients:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id, documentId } = await params

    const document = await db.clientDocument.findFirst({
      where: { id: documentId, clientId: id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Client document get error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/clients/[id]/documents/[documentId] — Delete document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
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
    const { id, documentId } = await params

    const existing = await db.clientDocument.findFirst({
      where: { id: documentId, clientId: id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    await db.clientDocument.delete({ where: { id: documentId } })

    await auditLog(auth.userId, 'delete', 'ClientDocument', documentId, existing, null)

    return NextResponse.json({ success: true, message: 'Document supprimé' })
  } catch (error) {
    console.error('Client document delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
