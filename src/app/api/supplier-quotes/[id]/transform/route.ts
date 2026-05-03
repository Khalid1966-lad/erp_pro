import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'

// POST - Transform supplier quote → purchase order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'purchase_orders:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const quote = await db.supplierQuote.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: { include: { product: true } },
        priceRequest: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Devis fournisseur introuvable' }, { status: 404 })
    }

    if (quote.status !== 'received' && quote.status !== 'accepted') {
      return NextResponse.json({ error: 'Seul un devis reçu ou accepté peut être transformé en commande' }, { status: 400 })
    }

    // Generate PO number
    const count = await db.purchaseOrder.count()
    const year = new Date().getFullYear()
    const number = `COM-${year}-${String(count + 1).padStart(4, '0')}`

    let totalHT = 0
    let totalTVA = 0

    const linesData = quote.lines.map((line) => {
      const lineHT = line.quantity * line.unitPrice
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
        totalHT: lineHT,
      }
    })

    const expectedDate = quote.deliveryDelay
      ? new Date(Date.now() + quote.deliveryDelay * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const notes = quote.notes
      ? `[Transformé depuis devis ${quote.number}]\n${quote.notes}`
      : `Transformé depuis devis ${quote.number}`

    const order = await db.purchaseOrder.create({
      data: {
        number,
        supplierId: quote.supplierId,
        supplierQuoteId: quote.id,
        status: 'draft',
        expectedDate,
        notes,
        totalHT,
        totalTVA,
        totalTTC: totalHT + totalTVA,
        lines: { create: linesData },
      },
      include: {
        supplier: true,
        lines: { include: { product: true } },
      },
    })

    // Mark quote as selected for PO
    await db.supplierQuote.update({
      where: { id: quote.id },
      data: { selectedForPO: true },
    })

    // Update price request status if linked
    if (quote.priceRequestId) {
      const pr = await db.priceRequest.findUnique({
        where: { id: quote.priceRequestId },
        include: { supplierQuotes: true },
      })
      if (pr && (pr.status === 'sent' || pr.status === 'partially_answered' || pr.status === 'answered')) {
        await db.priceRequest.update({
          where: { id: quote.priceRequestId },
          data: { status: 'closed' },
        })
      }
    }

    await auditLog(auth.userId, 'create', 'PurchaseOrder', order.id, null, order)

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Transform supplier quote error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
