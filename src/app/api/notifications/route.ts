import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/notifications — List notifications for the authenticated user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20')))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const category = searchParams.get('category')

    const where: Prisma.NotificationWhereInput = {
      userId: auth.userId,
    }

    if (unreadOnly) {
      where.isRead = false
    }

    if (category) {
      where.category = category
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          userId: auth.userId,
          isRead: false,
        },
      }),
    ])

    return NextResponse.json({
      notifications,
      unreadCount,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Notifications list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/notifications — Create a notification (admin only, or system)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Only admin or super_admin can create notifications for other users
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      userId,
      title,
      message,
      type = 'info',
      category = 'system',
      entityType,
      entityId,
      actionUrl,
      broadcast = false,
    } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Le titre et le message sont obligatoires' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes = ['info', 'warning', 'error', 'success', 'task', 'deadline']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Valeurs autorisées: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate notification category
    const validCategories = ['system', 'order', 'delivery', 'production', 'payment', 'stock', 'message']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Catégorie invalide. Valeurs autorisées: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Broadcast to all active users
    if (broadcast) {
      const activeUsers = await db.user.findMany({
        where: { isActive: true, isBlocked: false },
        select: { id: true },
      })

      if (activeUsers.length === 0) {
        return NextResponse.json(
          { error: 'Aucun utilisateur actif trouvé' },
          { status: 404 }
        )
      }

      const notifications = await db.notification.createMany({
        data: activeUsers.map((user) => ({
          userId: user.id,
          title,
          message,
          type,
          category,
          entityType: entityType || null,
          entityId: entityId || null,
          actionUrl: actionUrl || null,
        })),
      })

      return NextResponse.json(
        { message: `Notification envoyée à ${notifications.count} utilisateurs`, count: notifications.count },
        { status: 201 }
      )
    }

    // Single user notification
    if (!userId) {
      return NextResponse.json(
        { error: 'userId est requis (sauf en mode broadcast)' },
        { status: 400 }
      )
    }

    // Verify target user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur cible introuvable' }, { status: 404 })
    }

    const notification = await db.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        category,
        entityType: entityType || null,
        entityId: entityId || null,
        actionUrl: actionUrl || null,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    console.error('Notification create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/notifications — Mark notifications as read
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { ids, all } = body as { ids?: string[]; all?: boolean }

    if (all) {
      // Mark all unread notifications as read
      const count = await db.notification.updateMany({
        where: {
          userId: auth.userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })

      return NextResponse.json({ markedCount: count.count })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific notifications as read
      const count = await db.notification.updateMany({
        where: {
          id: { in: ids },
          userId: auth.userId, // Only own notifications
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })

      return NextResponse.json({ markedCount: count.count })
    }

    return NextResponse.json(
      { error: 'Fournir ids (tableau) ou all (true)' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    console.error('Notification update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/notifications — Delete a notification (own only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id } = body as { id?: string }

    if (!id) {
      return NextResponse.json({ error: 'id est requis' }, { status: 400 })
    }

    // Only allow deleting own notifications
    const notification = await db.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 })
    }

    if (notification.userId !== auth.userId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    await db.notification.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Notification supprimée' })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    console.error('Notification delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
