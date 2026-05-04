import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60

/** Convert number to alphabetic code: 0→A, 25→Z, 26→AA, 27→AB, ... */
function numberToAlphaCode(n: number): string {
  let code = ''
  let num = n
  do {
    code = String.fromCharCode(65 + (num % 26)) + code
    num = Math.floor(num / 26) - 1
  } while (num >= 0)
  return code
}

/**
 * POST /api/finance/payments/backfill-codes
 *
 * One-time migration: assigns alphabetic codes (A, B, C...) to all existing
 * payments that don't have a code yet, grouped by year of creation.
 * Also initializes the PaymentCodeCounter for each year.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    // Fetch all payments without a code, ordered by date ascending
    const payments = await db.payment.findMany({
      where: {
        code: null,
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (payments.length === 0) {
      return NextResponse.json({
        message: 'Aucun paiement à mettre à jour. Tous les paiements ont déjà un code.',
        updated: 0,
      })
    }

    // Group payments by year
    const byYear = new Map<number, string[]>()
    for (const p of payments) {
      const year = p.createdAt.getFullYear()
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(p.id)
    }

    const yearResults: Record<string, { count: number; firstCode: string; lastCode: string }> = {}
    let totalUpdated = 0

    await db.$transaction(async (tx) => {
      for (const [yearStr, paymentIds] of byYear) {
        const year = Number(yearStr)

        // Get current counter for this year (if exists)
        const existing = await tx.paymentCodeCounter.findUnique({
          where: { year },
        })
        let startCounter = existing ? existing.counter + 1 : 0

        const codes: string[] = []
        for (let i = 0; i < paymentIds.length; i++) {
          const code = numberToAlphaCode(startCounter + i)
          codes.push(code)

          await tx.payment.update({
            where: { id: paymentIds[i] },
            data: { code, codeYear: year },
          })
        }

        // Update or create the counter
        const newCounter = startCounter + paymentIds.length - 1
        await tx.paymentCodeCounter.upsert({
          where: { year },
          update: { counter: newCounter },
          create: { year, counter: newCounter },
        })

        yearResults[yearStr] = {
          count: paymentIds.length,
          firstCode: codes[0],
          lastCode: codes[codes.length - 1],
        }

        totalUpdated += paymentIds.length
      }
    })

    return NextResponse.json({
      message: `${totalUpdated} paiement(s) mis à jour avec succès.`,
      updated: totalUpdated,
      years: yearResults,
    })
  } catch (error) {
    console.error('Backfill payment codes error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la mise à jour des codes' },
      { status: 500 }
    )
  }
}
