import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

export const maxDuration = 15

// GET /api/sales-orders/[id] — Fetch a single sales order by ID with full relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'sales_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const order = await db.salesOrder.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, ice: true } },
        quote: { select: { number: true } },
        lines: {
          include: {
            product: { select: { reference: true, designation: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('Sales order fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
