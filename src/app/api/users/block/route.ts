import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'

// POST /api/users/block — Block or unblock a user (super_admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — super administrateur requis' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId, block } = body // block: true = block, false = unblock

    if (!userId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Cannot block/unblock a super admin
    if (user.isSuperAdmin) {
      return NextResponse.json({ error: 'Impossible de bloquer un super administrateur' }, { status: 403 })
    }

    // Cannot block yourself
    if (userId === auth.userId) {
      return NextResponse.json({ error: 'Impossible de bloquer votre propre compte' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isBlocked: block,
        blockedAt: block ? new Date() : null,
        blockedBy: block ? auth.userId : null,
        isActive: block ? false : true,
      },
    })

    await auditLog(
      auth.userId,
      block ? 'block' : 'unblock',
      'User',
      user.id,
      { isBlocked: user.isBlocked },
      { isBlocked: block }
    )

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isBlocked: updated.isBlocked,
        isActive: updated.isActive,
      },
      message: block ? 'Utilisateur bloqué' : 'Utilisateur débloqué',
    })
  } catch (error) {
    console.error('Block/unblock error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
