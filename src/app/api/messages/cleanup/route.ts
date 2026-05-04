import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/messages/cleanup — Delete messages older than 30 days (super_admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    // Only allow super_admin to call this
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { isSuperAdmin: true },
    })

    if (!user || !user.isSuperAdmin) {
      return NextResponse.json({ error: 'Accès réservé au super administrateur' }, { status: 403 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Delete messages older than 30 days
    const deleteMessagesResult = await db.message.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    })

    // Find orphaned conversations (conversations with no remaining messages)
    const orphanedConversations = await db.conversation.findMany({
      where: { messages: { none: {} } },
      select: { id: true },
    })

    let deletedConversations = 0
    if (orphanedConversations.length > 0) {
      const orphanedIds = orphanedConversations.map((c) => c.id)
      const deleteConvResult = await db.conversation.deleteMany({
        where: { id: { in: orphanedIds } },
      })
      deletedConversations = deleteConvResult.count
    }

    return NextResponse.json({
      deletedMessages: deleteMessagesResult.count,
      deletedConversations,
    })
  } catch (error) {
    console.error('Message cleanup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
