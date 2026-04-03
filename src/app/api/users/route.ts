import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { requireAuth, auditLog } from '@/lib/auth'

// GET /api/users — List all users (admin/super_admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isSuperAdmin: true,
        isBlocked: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        blockedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Users list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/users — Create user (admin/super_admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { email, password, name, role, phone } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, mot de passe et nom sont requis' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
    }

    const validRoles = ['admin', 'commercial', 'buyer', 'storekeeper', 'prod_manager', 'operator', 'accountant', 'cashier', 'direction']
    const userRole = role && validRoles.includes(role) ? role : 'operator'

    // Only super_admin can create admin users
    if (userRole === 'admin' && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Seul un super administrateur peut créer un admin' }, { status: 403 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 })
    }

    const passwordHash = createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'erp-salt'))
      .digest('hex')

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: userRole,
        phone: phone || null,
      },
    })

    await auditLog(auth.userId, 'create', 'User', user.id, null, { email, name, role: userRole })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        isSuperAdmin: user.isSuperAdmin,
        isBlocked: user.isBlocked,
        isActive: user.isActive,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('User create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/users — Update user (admin/super_admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, name, role, phone, password } = body

    if (!id) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // Cannot modify super admin (except by another super admin)
    if (existing.isSuperAdmin && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Impossible de modifier un super administrateur' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (name) updateData.name = name
    if (phone !== undefined) updateData.phone = phone || null

    if (role) {
      const validRoles = ['admin', 'commercial', 'buyer', 'storekeeper', 'prod_manager', 'operator', 'accountant', 'cashier', 'direction']
      if (validRoles.includes(role)) {
        // Only super_admin can change role to admin
        if (role === 'admin' && auth.role !== 'super_admin') {
          return NextResponse.json({ error: 'Seul un super administrateur peut attribuer le rôle admin' }, { status: 403 })
        }
        updateData.role = role
      }
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
      }
      updateData.passwordHash = createHash('sha256')
        .update(password + (process.env.PASSWORD_SALT || 'erp-salt'))
        .digest('hex')
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
    })

    await auditLog(auth.userId, 'update', 'User', user.id, existing, updateData)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        isSuperAdmin: user.isSuperAdmin,
        isBlocked: user.isBlocked,
        isActive: user.isActive,
      },
    })
  } catch (error) {
    console.error('User update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
