import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { clientDocumentSchema } from '@/lib/validations/client'

// GET /api/clients/[id]/documents — List documents for a client
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

    // Verify client exists
    const client = await db.client.findUnique({
      where: { id, isDeleted: false },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const documents = await db.clientDocument.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Client documents list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/clients/[id]/documents — Create document for a client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:create') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Verify client exists
    const client = await db.client.findUnique({
      where: { id, isDeleted: false },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const body = await req.json()
    const data = clientDocumentSchema.parse(body)

    const document = await db.clientDocument.create({
      data: {
        nomFichier: data.nomFichier,
        url: data.url,
        type: data.type,
        taille: data.taille,
        clientId: id,
      },
    })

    await auditLog(auth.userId, 'create', 'ClientDocument', document.id, null, document)

    return NextResponse.json(document, { status: 201 })
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
    console.error('Client document create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
