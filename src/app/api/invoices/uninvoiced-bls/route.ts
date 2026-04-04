import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

// GET - Return delivered delivery notes for a client that are NOT yet linked to any invoice
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'invoices:read') && !hasPermission(auth, 'delivery_notes:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'clientId requis' }, { status: 400 })
    }

    // Get all delivered delivery notes for this client
    const deliveredBLs = await db.deliveryNote.findMany({
      where: {
        clientId,
        status: { in: ['delivered', 'confirmed'] },
      },
      include: {
        lines: {
          include: {
            product: { select: { id: true, reference: true, designation: true } },
          },
        },
        salesOrder: { select: { id: true, number: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Get all delivery note IDs that are already linked to an invoice
    const alreadyInvoiced = await db.invoiceDeliveryNote.findMany({
      where: {
        deliveryNoteId: { in: deliveredBLs.map((bl) => bl.id) },
      },
      select: { deliveryNoteId: true },
    })

    const invoicedIds = new Set(alreadyInvoiced.map((l) => l.deliveryNoteId))

    // Filter out already-invoiced BLs
    const uninvoicedBLs = deliveredBLs.filter((bl) => !invoicedIds.has(bl.id))

    return NextResponse.json({ deliveryNotes: uninvoicedBLs })
  } catch (error) {
    console.error('Uninvoiced BLs error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
