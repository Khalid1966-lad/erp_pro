import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { requireAuth, auditLog } from '@/lib/auth'

// GET /api/profile — Get current user profile
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isSuperAdmin: true,
        isActive: true,
        isBlocked: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Profile get error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/profile — Update current user profile (name, phone, password)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { name, phone, currentPassword, newPassword } = body

    const user = await db.user.findUnique({ where: { id: auth.userId } })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    // Update name
    if (name && name.trim()) {
      updateData.name = name.trim()
    }

    // Update phone
    if (phone !== undefined) {
      updateData.phone = phone || null
    }

    // Change password (requires current password verification)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Mot de passe actuel requis pour en définir un nouveau' }, { status: 400 })
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
      }

      // Verify current password
      const currentHash = createHash('sha256')
        .update(currentPassword + (process.env.PASSWORD_SALT || 'erp-salt'))
        .digest('hex')

      if (user.passwordHash !== currentHash) {
        return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })
      }

      updateData.passwordHash = createHash('sha256')
        .update(newPassword + (process.env.PASSWORD_SALT || 'erp-salt'))
        .digest('hex')
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification à effectuer' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: auth.userId },
      data: updateData,
    })

    await auditLog(auth.userId, 'update_profile', 'User', user.id, null, updateData)

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        phone: updated.phone,
        isSuperAdmin: updated.isSuperAdmin,
      },
      message: newPassword ? 'Profil et mot de passe mis à jour' : 'Profil mis à jour',
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
