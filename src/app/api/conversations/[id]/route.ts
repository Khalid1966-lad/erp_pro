import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE /api/conversations/[id] — Delete an entire conversation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // Verify user is a participant of this conversation
    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Check if user is super_admin
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { isSuperAdmin: true },
    })

    // Delete all messages in the conversation
    await db.message.deleteMany({
      where: { conversationId: id },
    })

    // Delete all participants
    await db.conversationParticipant.deleteMany({
      where: { conversationId: id },
    })

    // Delete the conversation
    await db.conversation.delete({
      where: { id },
    })

    await auditLog(auth.userId, 'delete', 'Conversation', id, null, {
      isSuperAdmin: user?.isSuperAdmin ?? false,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Conversation delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
