import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// POST - Record a print event for an effet/cheque
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    await db.effetCheque.update({
      where: { id },
      data: {
        printedAt: new Date(),
        printCount: { increment: 1 },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording cheque print:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
