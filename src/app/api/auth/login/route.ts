import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createToken } from '@/lib/auth'

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
        },
      })
    }

    // ─── Normal login flow ───
    const user = await db.user.findUnique({ where: { email } })
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

    // Create JWT token
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
