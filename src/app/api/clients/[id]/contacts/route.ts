import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { clientContactSchema, clientContactUpdateSchema } from '@/lib/validations/client'

// GET /api/clients/[id]/contacts — List contacts for a client
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

    const contacts = await db.clientContact.findMany({
      where: { clientId: id },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    })

    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Client contacts list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/clients/[id]/contacts — Create contact for a client
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
    const data = clientContactSchema.parse(body)

    const contact = await db.clientContact.create({
      data: {
        ...data,
        clientId: id,
      },
    })

    await auditLog(auth.userId, 'create', 'ClientContact', contact.id, null, contact)

    return NextResponse.json(contact, { status: 201 })
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
    console.error('Client contact create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
