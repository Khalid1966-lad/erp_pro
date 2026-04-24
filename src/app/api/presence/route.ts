import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/presence — Update the authenticated user's lastSeen timestamp
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    await db.user.update({
      where: { id: auth.userId },
      data: { lastSeen: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Presence heartbeat error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
