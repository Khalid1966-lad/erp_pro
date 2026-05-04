import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getPermissionsForUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/auth/permissions — Fetch current user's permissions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    // Super admin has all permissions
    if (auth.role === 'super_admin') {
      return NextResponse.json({ permissions: ['*'] })
    }

    // Fetch fresh permissions from DB
    const permissions = await getPermissionsForUser(auth.userId, auth.role)

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Permissions fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
