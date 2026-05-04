import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { requireAuth, auditLog } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Only authenticated admin users can create new users
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé - administrateur requis' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, mot de passe et nom requis' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 })
    }

    const passwordHash = createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'erp-salt'))
      .digest('hex')

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'operator' // Always default to operator, no role escalation
      }
    })

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'register',
        entity: 'User',
        entityId: user.id
      }
    })

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
