import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createToken, verifyToken, getPermissionsForUser } from '@/lib/auth'

// Hardcoded super admin credentials (emergency access)
const SUPER_ADMIN = {
  email: 'contact@jazelwebagency.com',
  password: 'hello@erp2026',
  name: 'Super Admin',
  role: 'super_admin',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    // ─── Check hardcoded super admin ───
    if (email === SUPER_ADMIN.email && password === SUPER_ADMIN.password) {
      // Ensure super admin exists in DB, create if not
      let superUser = await db.user.findUnique({ where: { email: SUPER_ADMIN.email } })
      if (!superUser) {
        const passwordHash = createHash('sha256')
          .update(SUPER_ADMIN.password + (process.env.PASSWORD_SALT || 'erp-salt'))
          .digest('hex')
        superUser = await db.user.create({
          data: {
            email: SUPER_ADMIN.email,
            passwordHash,
            name: SUPER_ADMIN.name,
            role: 'super_admin',
            isSuperAdmin: true,
          }
        })
      } else {
        // Update fields to ensure they stay correct
        await db.user.update({
          where: { email: SUPER_ADMIN.email },
          data: {
            isSuperAdmin: true,
            isBlocked: false,
            isActive: true,
            role: 'super_admin',
            lastLogin: new Date(),
          }
        })
      }

      const token = createToken({
        userId: superUser.id,
        email: superUser.email,
        role: 'super_admin',
        name: superUser.name,
      })

      return NextResponse.json({
        token,
        user: {
          id: superUser.id,
          email: superUser.email,
          name: superUser.name,
          role: 'super_admin',
          isSuperAdmin: true,
          avatarUrl: superUser.avatarUrl ?? null,
          permissions: ['*'],
        },
      })
    }

    // ─── Normal login flow ───
    // Case-insensitive email lookup (PostgreSQL is case-sensitive by default)
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })
    if (!user) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: 'Compte bloqué. Contactez un administrateur.' }, { status: 403 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Compte désactivé' }, { status: 403 })
    }

    const passwordHash = createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'erp-salt'))
      .digest('hex')

    if (user.passwordHash !== passwordHash) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    // Fetch permissions for this user
    const permissions = await getPermissionsForUser(user.id, user.role)

    // Create JWT token with permissions
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        avatarUrl: user.avatarUrl ?? null,
        permissions,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/auth/login/reset-password — Reset any user's password (super_admin only)
export async function PUT(req: NextRequest) {
  try {
    const authData = verifyToken(req.headers.get('authorization')?.replace('Bearer ', '') || '')
    if (!authData || authData.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, newPassword } = body

    if (!userId || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'ID utilisateur et mot de passe (min 6 chars) requis' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const passwordHash = createHash('sha256')
      .update(newPassword + (process.env.PASSWORD_SALT || 'erp-salt'))
      .digest('hex')

    await db.user.update({
      where: { id: userId },
      data: { passwordHash }
    })

    return NextResponse.json({ success: true, message: `Mot de passe de ${user.name} réinitialisé.` })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
