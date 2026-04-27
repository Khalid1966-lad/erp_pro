import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/conversations — List conversations for the authenticated user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    // Find all conversation participant records for this user
    const participants = await db.conversationParticipant.findMany({
      where: { userId: auth.userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, name: true, role: true, lastSeen: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    })

    // Build conversation list with unread counts and other participants
    const conversations = participants
      .map((p) => {
        const conversation = p.conversation
        const lastMessage = conversation.messages[0] || null
        const otherParticipants = conversation.participants
          .filter((cp) => cp.userId !== auth.userId)
          .map((cp) => ({
            id: cp.user.id,
            name: cp.user.name,
            role: cp.user.role,
            lastSeen: cp.user.lastSeen,
            isOnline: cp.user.lastSeen
              ? new Date(cp.user.lastSeen).getTime() > Date.now() - 30 * 1000
              : false,
          }))

        // Count unread messages: messages where createdAt > participant.lastReadAt
        // and senderId !== current user
        const unreadCount = conversation.messages.filter((m) => {
          if (!p.lastReadAt) return m.senderId !== auth.userId
          return (
            m.senderId !== auth.userId &&
            m.createdAt > p.lastReadAt!
          )
        }).length

        return {
          id: conversation.id,
          isGroup: conversation.isGroup,
          name: conversation.name,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessage: lastMessage
            ? {
                senderId: lastMessage.sender.id,
                senderName: lastMessage.sender.name,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
              }
            : null,
          participants: otherParticipants,
          unreadCount,
        }
      })
      // Sort by last message createdAt desc, conversations without messages go to the end
      .sort((a, b) => {
        const dateA = a.lastMessage?.createdAt || a.createdAt
        const dateB = b.lastMessage?.createdAt || b.createdAt
        return dateB.getTime() - dateA.getTime()
      })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Conversations list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/conversations — Create a new 1-on-1 conversation
const createConversationSchema = z.object({
  participantId: z.string().min(1, 'participantId est requis'),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { participantId } = createConversationSchema.parse(body)

    // Cannot create conversation with yourself
    if (participantId === auth.userId) {
      return NextResponse.json(
        { error: 'Impossible de créer une conversation avec vous-même' },
        { status: 400 }
      )
    }

    // Verify the other user exists
    const otherUser = await db.user.findUnique({
      where: { id: participantId },
      select: { id: true, name: true, role: true, lastSeen: true },
    })
    if (!otherUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Check if a 1-on-1 conversation already exists between these 2 users
    const existingParticipants = await db.conversationParticipant.findMany({
      where: {
        userId: auth.userId,
        conversation: {
          isGroup: false,
          participants: {
            some: { userId: participantId },
          },
        },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, name: true, role: true, lastSeen: true } },
              },
            },
          },
        },
      },
    })

    // Filter to only 1-on-1 conversations (exactly 2 participants)
    const existingConversation = existingParticipants.find(
      (ep) => ep.conversation.participants.length === 2
    )

    if (existingConversation) {
      const conv = existingConversation.conversation
      const other = conv.participants.find((cp) => cp.userId !== auth.userId)

      return NextResponse.json({
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.name,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        participants: other
          ? [{
              id: other.user.id,
              name: other.user.name,
              role: other.user.role,
              lastSeen: other.user.lastSeen,
              isOnline: other.user.lastSeen
                ? new Date(other.user.lastSeen).getTime() > Date.now() - 30 * 1000
                : false,
            }]
          : [],
      })
    }

    // Create new 1-on-1 conversation
    const conversation = await db.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId: auth.userId },
            { userId: participantId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, lastSeen: true } },
          },
        },
      },
    })

    await auditLog(auth.userId, 'create', 'Conversation', conversation.id, null, {
      participantId,
    })

    const otherParticipant = conversation.participants.find((cp) => cp.userId !== auth.userId)

    return NextResponse.json(
      {
        id: conversation.id,
        isGroup: conversation.isGroup,
        name: conversation.name,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: otherParticipant
          ? [{
              id: otherParticipant.user.id,
              name: otherParticipant.user.name,
              role: otherParticipant.user.role,
              lastSeen: otherParticipant.user.lastSeen,
              isOnline: otherParticipant.user.lastSeen
                ? new Date(otherParticipant.user.lastSeen).getTime() > Date.now() - 30 * 1000
                : false,
            }]
          : [],
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Conversation create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
