import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/conversations/[id]/messages/[messageId] — Delete a message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id, messageId } = await params

    // Verify user is a participant of this conversation
    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Verify the message exists and belongs to this conversation
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true },
    })

    if (!message || message.conversationId !== id) {
      return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
    }

    // Only allow the sender to delete their own message (or super_admin)
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { isSuperAdmin: true },
    })

    if (message.senderId !== auth.userId && !user?.isSuperAdmin) {
      return NextResponse.json({ error: 'Vous ne pouvez supprimer que vos propres messages' }, { status: 403 })
    }

    // Delete the message
    await db.message.delete({
      where: { id: messageId },
    })

    // Check if conversation is now empty and clean up if so
    const remainingMessages = await db.message.count({
      where: { conversationId: id },
    })

    if (remainingMessages === 0) {
      await db.conversation.delete({ where: { id } })
    }

    await auditLog(auth.userId, 'delete', 'Message', messageId, null, {
      conversationId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Message delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
