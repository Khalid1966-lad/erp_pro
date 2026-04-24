import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 15

// GET /api/quotes/[id] — Fetch a single quote by ID with full relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'quotes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, ice: true } },
        lines: {
          include: {
            product: { select: { reference: true, designation: true } },
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Quote fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
