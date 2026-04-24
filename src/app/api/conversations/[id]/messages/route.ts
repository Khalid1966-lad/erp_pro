import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/conversations/[id]/messages — Get messages in a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // Verify user is a participant
    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Parse query params for pagination
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')

    const where: Record<string, unknown> = { conversationId: id }
    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    // Fetch messages ordered by createdAt desc, then reverse for chronological order
    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    })

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse()

    // Mark all messages in this conversation as read for this user
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
      data: { lastReadAt: new Date() },
    })

    return NextResponse.json({
      messages: chronologicalMessages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.sender.name,
        content: m.content,
        createdAt: m.createdAt,
      })),
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error('Messages list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/conversations/[id]/messages — Send a message
const sendMessageSchema = z.object({
  content: z.string().min(1, 'Le contenu du message est requis').max(5000, 'Message trop long'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params

    // Verify user is a participant
    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    const body = await req.json()
    const { content } = sendMessageSchema.parse(body)

    // Create the message
    const message = await db.message.create({
      data: {
        conversationId: id,
        senderId: auth.userId,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    })

    // Update conversation.updatedAt
    await db.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    // Create notifications for the other participant(s)
    const otherParticipants = await db.conversationParticipant.findMany({
      where: {
        conversationId: id,
        userId: { not: auth.userId },
      },
      select: { userId: true },
    })

    if (otherParticipants.length > 0) {
      const preview = content.length > 80 ? content.substring(0, 80) + '...' : content

      await db.notification.createMany({
        data: otherParticipants.map((op) => ({
          userId: op.userId,
          title: 'Nouveau message',
          message: preview,
          type: 'message',
          category: 'message',
          actionUrl: 'messages',
          entityType: 'Conversation',
          entityId: id,
        })),
      })
    }

    await auditLog(auth.userId, 'create', 'Message', message.id, null, {
      conversationId: id,
      content,
    })

    return NextResponse.json(
      {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.sender.name,
        content: message.content,
        createdAt: message.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Message send error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
