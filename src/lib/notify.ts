// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Notification Helper
// ═══════════════════════════════════════════════════════════════
// Utility to send notifications to users from any API route.
// Uses fire-and-forget approach (non-blocking).

import { db } from '@/lib/db'

export type NotifyType = 'info' | 'warning' | 'error' | 'success' | 'task' | 'deadline'
export type NotifyCategory = 'system' | 'order' | 'delivery' | 'production' | 'payment' | 'stock' | 'message'

interface NotifyOptions {
  userId: string
  title: string
  message: string
  type?: NotifyType
  category?: NotifyCategory
  entityType?: string
  entityId?: string
  actionUrl?: string
}

/**
 * Send a notification to a specific user.
 * Fire-and-forget — does not throw on error.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: opts.userId,
        title: opts.title,
        message: opts.message,
        type: opts.type ?? 'info',
        category: opts.category ?? 'system',
        entityType: opts.entityType,
        entityId: opts.entityId,
        actionUrl: opts.actionUrl,
      },
    })
  } catch (error) {
    console.error('[Notify] Failed to send notification:', error)
  }
}

/**
 * Broadcast a notification to all active users.
 * Fire-and-forget — does not throw on error.
 */
export async function notifyAll(opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { isActive: true, isBlocked: false },
      select: { id: true },
    })
    for (const user of users) {
      await db.notification.create({
        data: {
          userId: user.id,
          title: opts.title,
          message: opts.message,
          type: opts.type ?? 'info',
          category: opts.category ?? 'system',
          entityType: opts.entityType,
          entityId: opts.entityId,
          actionUrl: opts.actionUrl,
        },
      })
    }
  } catch (error) {
    console.error('[Notify] Failed to broadcast notification:', error)
  }
}

/**
 * Notify all admins and super_admins.
 */
export async function notifyAdmins(opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { isActive: true, isBlocked: false, role: { in: ['admin', 'super_admin'] } },
      select: { id: true },
    })
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          title: opts.title,
          message: opts.message,
          type: opts.type ?? 'info',
          category: opts.category ?? 'system',
          entityType: opts.entityType,
          entityId: opts.entityId,
          actionUrl: opts.actionUrl,
        },
      })
    }
  } catch (error) {
    console.error('[Notify] Failed to notify admins:', error)
  }
}

/**
 * Notify all users with a specific role.
 */
export async function notifyByRole(role: string, opts: Omit<NotifyOptions, 'userId'>): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { isActive: true, isBlocked: false, role },
      select: { id: true },
    })
    for (const user of users) {
      await db.notification.create({
        data: {
          userId: user.id,
          title: opts.title,
          message: opts.message,
          type: opts.type ?? 'info',
          category: opts.category ?? 'system',
          entityType: opts.entityType,
          entityId: opts.entityId,
          actionUrl: opts.actionUrl,
        },
      })
    }
  } catch (error) {
    console.error(`[Notify] Failed to notify role ${role}:`, error)
  }
}
