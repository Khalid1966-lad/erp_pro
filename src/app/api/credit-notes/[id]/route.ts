import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 15

// GET /api/credit-notes/[id] — Fetch a single credit note by ID with full relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'credit_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const creditNote = await db.creditNote.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, ice: true } },
        invoice: { select: { number: true } },
        lines: {
          include: {
            product: { select: { reference: true, designation: true } },
          },
        },
      },
    })

    if (!creditNote) {
      return NextResponse.json({ error: 'Avoir introuvable' }, { status: 404 })
    }

    return NextResponse.json(creditNote)
  } catch (error) {
    console.error('Credit note fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
