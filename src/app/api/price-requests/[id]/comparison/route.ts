import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

// GET - Comparison data for a price request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'purchase_orders:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { id } = await params

    const priceRequest = await db.priceRequest.findUnique({
      where: { id },
      include: {
        lines: {
          include: { product: { select: { id: true, reference: true, designation: true } } },
          orderBy: { createdAt: 'asc' },
        },
        supplierQuotes: {
          include: {
            supplier: { select: { id: true, name: true, code: true, rating: true, deliveryDelay: true, paymentTerms: true } },
            lines: {
              include: { product: { select: { id: true, reference: true, designation: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!priceRequest) {
      return NextResponse.json({ error: 'Demande de prix introuvable' }, { status: 404 })
    }

    // Build comparison matrix
    const quotes = priceRequest.supplierQuotes || []
    const prLines = priceRequest.lines || []

    // Per-product comparison: for each PR line, find matching quote lines
    const productComparison = prLines.map((prLine) => {
      const quotePrices = quotes.map((q) => {
        const matchingLine = q.lines.find((l) => l.productId === prLine.productId)
        return {
          quoteId: q.id,
          quoteNumber: q.number,
          supplierId: q.supplierId,
          supplierName: q.supplier?.name || '—',
          supplierRating: q.supplier?.rating || 0,
          unitPrice: matchingLine?.unitPrice || null,
          quantity: matchingLine?.quantity || 0,
          tvaRate: matchingLine?.tvaRate || 0,
          totalHT: matchingLine?.totalHT || 0,
          availability: matchingLine?.availability || null,
          deliveryDelay: matchingLine?.deliveryDelay ?? null,
          discount: matchingLine?.discount ?? null,
          hasProduct: !!matchingLine,
        }
      })

      // Find best price (lowest unitPrice)
      const validPrices = quotePrices.filter((p) => p.hasProduct && p.unitPrice != null && p.unitPrice > 0)
      const bestPrice = validPrices.length > 0
        ? Math.min(...validPrices.map((p) => p.unitPrice!))
        : null

      return {
        productId: prLine.productId,
        product: prLine.product,
        targetPrice: prLine.targetPrice,
        maxPrice: prLine.maxPrice,
        requestedQty: prLine.quantity,
        quotePrices,
        bestPrice,
        bestQuoteId: bestPrice != null
          ? validPrices.find((p) => p.unitPrice === bestPrice)?.quoteId || null
          : null,
      }
    })

    // Global scoring per quote
    const quoteScores = quotes.map((q) => {
      const matchedProducts = productComparison.filter((pc) =>
        pc.quotePrices.some((qp) => qp.quoteId === q.id && qp.hasProduct)
      )
      const unmatchedProducts = productComparison.filter((pc) =>
        !pc.quotePrices.some((qp) => qp.quoteId === q.id && qp.hasProduct)
      )

      const totalProducts = productComparison.length
      const coveredProducts = matchedProducts.length
      const coverageRate = totalProducts > 0 ? coveredProducts / totalProducts : 0

      // Price score (0-100): based on how close to best price
      let priceScore = 50
      const quoteProductPrices = matchedProducts.map((pc) => {
        const qp = pc.quotePrices.find((p) => p.quoteId === q.id)!
        return { unitPrice: qp.unitPrice || 0, bestPrice: pc.bestPrice || 0 }
      })
      if (quoteProductPrices.length > 0) {
        const avgPremium = quoteProductPrices.reduce((sum, pp) => {
          if (pp.bestPrice > 0) {
            return sum + ((pp.unitPrice - pp.bestPrice) / pp.bestPrice)
          }
          return sum
        }, 0) / quoteProductPrices.length
        // Lower premium = higher score
        priceScore = Math.max(0, Math.min(100, Math.round(100 - avgPremium * 200)))
      }

      // Delivery score (0-100): fewer days = higher score
      const deliveryDays = q.deliveryDelay || 7
      const deliveryScore = Math.max(0, Math.min(100, Math.round(100 - (deliveryDays - 1) * 3)))

      // Coverage score (0-100): more products covered = higher score
      const coverageScore = Math.round(coverageRate * 100)

      // Supplier rating score (0-100)
      const ratingScore = q.supplier?.rating || 3
      const ratingScoreNormalized = Math.round((ratingScore / 5) * 100)

      // Payment score (0-100): longer terms = better for buyer
      const paymentTerms = q.paymentTerms || '30 jours'
      let paymentScore = 50
      if (paymentTerms.includes('60')) paymentScore = 80
      else if (paymentTerms.includes('90')) paymentScore = 90
      else if (paymentTerms.includes('comptant')) paymentScore = 30
      else paymentScore = 60

      // Weighted total
      const totalScore = Math.round(
        priceScore * 0.40 +
        deliveryScore * 0.20 +
        coverageScore * 0.15 +
        ratingScoreNormalized * 0.10 +
        paymentScore * 0.15
      )

      return {
        quoteId: q.id,
        quoteNumber: q.number,
        supplierId: q.supplierId,
        supplierName: q.supplier?.name || '—',
        supplierCode: q.supplier?.code || '—',
        supplierRating: q.supplier?.rating || 0,
        status: q.status,
        deliveryDelay: q.deliveryDelay,
        deliveryFrequency: q.deliveryFrequency || null,
        paymentTerms: q.paymentTerms,
        validUntil: q.validUntil,
        totalHT: q.totalHT,
        totalTVA: q.totalTVA,
        totalTTC: q.totalTTC,
        selectedForPO: q.selectedForPO,
        coveredProducts,
        totalProducts,
        unmatchedProductIds: unmatchedProducts.map((up) => up.productId),
        scores: {
          price: priceScore,
          delivery: deliveryScore,
          coverage: coverageScore,
          rating: ratingScoreNormalized,
          payment: paymentScore,
          total: totalScore,
        },
      }
    })

    // Sort by total score descending
    quoteScores.sort((a, b) => b.scores.total - a.scores.total)

    // Find winner
    const winner = quoteScores.length > 0 ? quoteScores[0] : null

    return NextResponse.json({
      priceRequest: {
        id: priceRequest.id,
        number: priceRequest.number,
        title: priceRequest.title,
        status: priceRequest.status,
        validUntil: priceRequest.validUntil,
        notes: priceRequest.notes,
        createdAt: priceRequest.createdAt,
      },
      productComparison,
      quoteScores,
      winner,
    })
  } catch (error) {
    console.error('Price comparison error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
