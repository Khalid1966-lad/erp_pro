import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 15

// GET /api/delivery-notes/[id] — Fetch a single delivery note by ID with full relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'delivery_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const note = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, ice: true } },
        salesOrder: { select: { number: true } },
        lines: {
          include: {
            product: { select: { reference: true, designation: true } },
            salesOrderLine: { select: { quantity: true, quantityDelivered: true } },
          },
        },
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Bon de livraison introuvable' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Delivery note fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
