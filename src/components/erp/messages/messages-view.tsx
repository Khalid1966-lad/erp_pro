'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import {
  Send,
  Search,
  Plus,
  MessageSquare,
  MoreVertical,
  Users,
  ArrowLeft,
  CheckCheck,
  Paperclip,
  Smile,
  Circle,
  Loader2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  name: string
  role: string
  isOnline?: boolean
  lastSeen?: string
}

interface Conversation {
  id: string
  isGroup: boolean
  name?: string
  createdAt: string
  updatedAt: string
  participants: Participant[]
  lastMessage?: {
    senderId: string
    senderName: string
    content: string
    createdAt: string
  } | null
  unreadCount: number
}

interface Message {
  id: string
  conversationId?: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
}

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  isActive?: boolean
  isBlocked?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-orange-500',
    'bg-emerald-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-teal-500',
    'bg-rose-500',
    'bg-lime-600',
    'bg-fuchsia-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (messageDate.getTime() === today.getTime()) return "Aujourd'hui"
  if (messageDate.getTime() === yesterday.getTime()) return 'Hier'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatMessageTime(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  if (messageDate.getTime() === today.getTime()) return timeStr
  if (messageDate.getTime() === yesterday.getTime()) return `Hier`

  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
  return `${dayNames[date.getDay()]} ${hh}:${mm}`
}

function formatConversationTime(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const messageDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const timeStr = `${hh}:${mm}`

  if (messageDate.getTime() === today.getTime()) return timeStr
  if (messageDate.getTime() === yesterday.getTime()) return 'Hier'

  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
  return `${dayNames[d.getDay()]}`
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return "À l'instant"
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays < 7) return `Il y a ${diffDays}j`

  return formatDate(date)
}

// ── Emoji Data ──────────────────────────────────────────────────────────────

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  },
  {
    name: 'Gestes',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
  },
  {
    name: 'Cœurs',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  },
  {
    name: 'Objets',
    emojis: ['⭐', '🌟', '✨', '⚡', '🔥', '💥', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎯', '🚀', '💡', '📌', '📎', '✅', '❌', '⭕', '💯', '🔔', '📧', '💬', '🕐', '📅'],
  },
]

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  commercial: 'Commercial',
  buyer: 'Acheteur',
  storekeeper: 'Magasinier',
  prod_manager: 'Resp. Production',
  operator: 'Opérateur',
  accountant: 'Comptable',
  cashier: 'Caissier',
  direction: 'Direction',
}

// ── Group Messages by Date ──────────────────────────────────────────────────

interface GroupedMessages {
  dateLabel: string
  dateKey: string
  messages: Message[]
}

function groupMessagesByDate(messages: Message[]): GroupedMessages[] {
  const groups: GroupedMessages[] = []
  let currentGroup: GroupedMessages | null = null

  for (const msg of messages) {
    const d = new Date(msg.createdAt)
    const label = formatDate(d)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if (!currentGroup || currentGroup.dateKey !== key) {
      currentGroup = { dateLabel: label, dateKey: key, messages: [] }
      groups.push(currentGroup)
    }
    currentGroup.messages.push(msg)
  }

  return groups
}

// ── Conversation Skeleton ───────────────────────────────────────────────────

function ConversationItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-3 w-10 rounded bg-muted animate-pulse" />
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MessagesView() {
  const { user } = useAuthStore()

  // State
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [hasMore, setHasMore] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevMessageCountRef = useRef(0)

  // ── Active conversation data ──────────────────────────────────────────────

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  const displayMessages = useMemo(() => messages, [messages])
  const groupedMessages = useMemo(() => groupMessagesByDate(displayMessages), [displayMessages])

  // ── Responsive detection ─────────────────────────────────────────────────

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ── Auto-scroll to bottom ────────────────────────────────────────────────

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom('smooth')
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length, scrollToBottom])

  // ── API Calls ────────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.get<{ conversations: Conversation[] }>('/conversations')
      setConversations(data.conversations)
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [])

  const fetchMessages = useCallback(async (conversationId: string, scrollTo = true) => {
    try {
      const data = await api.get<{ messages: Message[]; hasMore: boolean }>(
        `/conversations/${conversationId}/messages?limit=50`
      )
      setMessages(data.messages)
      setHasMore(data.hasMore)
      if (scrollTo) {
        // Use requestAnimationFrame to ensure DOM has updated before scrolling
        requestAnimationFrame(() => scrollToBottom('instant'))
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
  }, [scrollToBottom])

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !activeConversationId || sendingMessage) return

    const content = newMessage.trim()
    setNewMessage('')

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      senderId: user?.id || '',
      senderName: user?.name || 'Vous',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom('instant')

    // Resize textarea back
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      setSendingMessage(true)
      const sentMsg = await api.post<Message>(`/conversations/${activeConversationId}/messages`, { content })
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? sentMsg : m))
      )
      // Refresh conversation list to update lastMessage
      fetchConversations()
    } catch (err) {
      console.error('Failed to send message:', err)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    } finally {
      setSendingMessage(false)
    }
  }, [newMessage, activeConversationId, sendingMessage, user, scrollToBottom, fetchConversations])

  const createConversation = useCallback(async (userId: string) => {
    try {
      const conversation = await api.post<Conversation>('/conversations', { participantId: userId })
      setShowNewConversation(false)
      setSelectedUserId('')
      setUserSearch('')
      setActiveConversationId(conversation.id)
      setShowMobileChat(true)
      // Refresh conversation list
      await fetchConversations()
      // Load messages
      await fetchMessages(conversation.id)
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }, [fetchConversations, fetchMessages])

  const deleteMessage = useCallback(async (messageId: string, conversationId: string) => {
    setDeletingMessageId(messageId)
    setConfirmDeleteId(null)
    try {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}`)
      // Remove from local state
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      fetchConversations()
    } catch (err) {
      console.error('Failed to delete message:', err)
    } finally {
      setDeletingMessageId(null)
    }
  }, [fetchConversations])

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserItem[] }>('/users')
      setUsers(data.users.filter((u) => u.id !== user?.id && u.isActive && !u.isBlocked))
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }, [user?.id])

  // ── Load initial data ────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([fetchConversations()])
      setLoading(false)
    }
    init()
  }, [fetchConversations])

  // ── Load messages when conversation changes ──────────────────────────────

  useEffect(() => {
    if (activeConversationId) {
      setMessages([])
      setHasMore(false)
      fetchMessages(activeConversationId)
    } else {
      setMessages([])
    }
  }, [activeConversationId, fetchMessages])

  // ── Polling every 5 seconds ─────────────────────────────────────────────

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      // Update presence heartbeat (every 15s is fine within 5s polling)
      api.post('/presence').catch(() => {})
      fetchConversations()
      if (activeConversationId) {
        // Silently refresh messages
        api.get<{ messages: Message[]; hasMore: boolean }>(
          `/conversations/${activeConversationId}/messages?limit=50`
        ).then((data) => {
          setMessages(data.messages)
          setHasMore(data.hasMore)
        }).catch(() => {})
      }
    }, 5000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [activeConversationId, fetchConversations])

  // ── Load users when dialog opens ─────────────────────────────────────────

  useEffect(() => {
    if (showNewConversation && users.length === 0) {
      fetchUsers()
    }
  }, [showNewConversation, users.length, fetchUsers])

  // ── Filter conversations by search ───────────────────────────────────────

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.participants.some((p) => p.name.toLowerCase().includes(q))
    )
  }, [conversations, searchQuery])

  // ── Filter users by search in dialog ─────────────────────────────────────

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role && ROLE_LABELS[u.role]?.toLowerCase().includes(q))
    )
  }, [users, userSearch])

  // ── Select conversation handler ──────────────────────────────────────────

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId)
    setShowMobileChat(true)
  }, [])

  // ── Handle back button on mobile ─────────────────────────────────────────

  const handleBack = useCallback(() => {
    setShowMobileChat(false)
  }, [])

  // ── Keyboard handler for textarea ────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  // ── Auto-resize textarea ────────────────────────────────────────────────

  const handleInsertEmoji = useCallback((emoji: string) => {
    setNewMessage((prev) => prev + emoji)
    // Focus the textarea
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const filteredEmojiCategories = useMemo(() => {
    if (!emojiSearch.trim()) return EMOJI_CATEGORIES
    const q = emojiSearch.toLowerCase()
    return EMOJI_CATEGORIES
      .map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((e) => e.includes(q)),
      }))
      .filter((cat) => cat.emojis.length > 0)
  }, [emojiSearch])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    const maxRows = 4
    const lineHeight = 20 // approximate line height
    const maxHeight = lineHeight * maxRows
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  // ── Render helpers (inline to avoid nested component remount on parent re-render) ──

  const renderConversationItem = useCallback((conv: Conversation) => {
    const isActive = conv.id === activeConversationId
    const displayName = conv.isGroup
      ? conv.name || conv.participants.map((p) => p.name.split(' ')[0]).join(', ')
      : conv.participants[0]?.name || 'Inconnu'
    const initials = conv.isGroup
      ? conv.participants.slice(0, 2).map((p) => getInitials(p.name)).join('')
      : getInitials(displayName)

    return (
      <button
        key={conv.id}
        onClick={() => handleSelectConversation(conv.id)}
        className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors rounded-lg mx-1 mb-0.5 ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50 text-foreground'
        }`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(displayName)}`}>
            {initials}
          </div>
          {conv.isGroup && (
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background border-2 border-background flex items-center justify-center">
              <Users className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          )}
          {/* Online indicator — only show green dot when user is online */}
          {!conv.isGroup && conv.participants[0]?.isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-semibold truncate ${isActive ? '' : 'text-foreground'}`}>
              {displayName}
            </span>
            {conv.lastMessage && (
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {formatConversationTime(conv.lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {conv.lastMessage ? (
                <>
                  {conv.lastMessage.senderName && (
                    <span className="text-muted-foreground/70">
                      {conv.lastMessage.senderId === user?.id ? 'Vous: ' : `${conv.lastMessage.senderName.split(' ')[0]}: `}
                    </span>
                  )}
                  {conv.lastMessage.content.length > 40
                    ? conv.lastMessage.content.substring(0, 40) + '...'
                    : conv.lastMessage.content}
                </>
              ) : (
                'Aucun message'
              )}
            </p>
            {conv.unreadCount > 0 && (
              <span className="flex-shrink-0 flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }, [activeConversationId, user?.id])

  const renderMessageBubble = useCallback((msg: Message, isFirstInGroup: boolean, isLastInGroup: boolean) => {
    const isMine = msg.senderId === user?.id

    return (
      <div
        key={msg.id}
        className={`group flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${
          isFirstInGroup ? 'mt-3' : 'mt-0.5'
        }`}
      >
        {/* Avatar — show for other users' first message in group */}
        {!isMine && isFirstInGroup && (
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 ${getAvatarColor(msg.senderName)}`}>
            {getInitials(msg.senderName)}
          </div>
        )}
        {!isMine && !isFirstInGroup && <div className="w-8 flex-shrink-0" />}

        {/* Bubble */}
        <div className={`max-w-[75%] md:max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
          {/* Sender name for group conversations */}
          {!isMine && activeConversation?.isGroup && isFirstInGroup && (
            <p className="text-[11px] font-medium text-muted-foreground mb-1 ml-1">
              {msg.senderName}
            </p>
          )}
          <div
            className={`rounded-2xl px-3.5 py-2 ${
              isMine
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-muted-foreground rounded-bl-md'
            } ${isFirstInGroup ? (isMine ? 'rounded-br-md rounded-tr-2xl' : 'rounded-bl-md rounded-tl-2xl') : ''} ${
              isLastInGroup ? (isMine ? 'rounded-br-2xl rounded-tr-md' : 'rounded-bl-2xl rounded-tl-md') : ''
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          </div>
          {/* Meta row: time + checkmark + delete button (CSS group-hover, no React state) */}
          <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            {isMine && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDeleteId(msg.id)
                }}
                disabled={deletingMessageId === msg.id}
                className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                type="button"
                title="Supprimer le message"
              >
                {deletingMessageId === msg.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              {formatMessageTime(new Date(msg.createdAt))}
            </span>
            {isMine && (
              <CheckCheck className="h-3 w-3 text-muted-foreground/40" />
            )}
          </div>
        </div>
      </div>
    )
  }, [user?.id, activeConversation?.isGroup, deletingMessageId])

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 flex rounded-lg border overflow-hidden bg-background shadow-sm">
        {/* ── Left Panel: Conversation List ──────────────────────────────── */}
        <div
          className={`${
            isMobile
              ? showMobileChat
                ? 'hidden'
                : 'w-full'
              : 'w-80 flex-shrink-0'
          } flex flex-col border-r bg-background`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Messages</h2>
              <p className="text-xs text-muted-foreground">
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''}`
                  : 'Aucune conversation'}
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setShowNewConversation(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nouvelle conversation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1 overflow-hidden">
            {loading ? (
              <div className="py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ConversationItemSkeleton key={i} />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {searchQuery ? 'Aucun résultat' : 'Aucune conversation'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 text-center">
                  {searchQuery
                    ? 'Essayez un autre terme de recherche'
                    : 'Commencez une nouvelle conversation avec un collègue'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowNewConversation(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Nouvelle conversation
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-1">
                {filteredConversations.map((conv) => renderConversationItem(conv))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Right Panel: Active Chat ──────────────────────────────────── */}
        <div
          className={`${
            isMobile
              ? showMobileChat
                ? 'flex'
                : 'hidden'
              : 'flex'
          } flex-1 flex-col min-w-0 bg-background`}
        >
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-background/50 dark:bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                Messagerie
              </h3>
              <p className="text-sm text-muted-foreground/70 max-w-[280px] text-center">
                Sélectionnez une conversation ou commencez une nouvelle discussion
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                {/* Back button on mobile */}
                {isMobile && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}

                {/* Avatar */}
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${getAvatarColor(
                  activeConversation.isGroup
                    ? activeConversation.name || 'Groupe'
                    : activeConversation.participants[0]?.name || 'Inconnu'
                )}`}>
                  {activeConversation.isGroup
                    ? (activeConversation.name
                        ? getInitials(activeConversation.name)
                        : activeConversation.participants.slice(0, 2).map((p) => getInitials(p.name)).join(''))
                    : getInitials(activeConversation.participants[0]?.name || 'Inconnu')}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">
                    {activeConversation.isGroup
                      ? activeConversation.name || activeConversation.participants.map((p) => p.name.split(' ')[0]).join(', ')
                      : activeConversation.participants[0]?.name || 'Inconnu'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {!activeConversation.isGroup && activeConversation.participants[0]?.isOnline && (
                      <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {!activeConversation.isGroup && activeConversation.participants[0]
                        ? ROLE_LABELS[activeConversation.participants[0].role] || activeConversation.participants[0].role
                        : `${activeConversation.participants.length + 1} membres`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {activeConversation.isGroup && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Users className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Membres</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'hsl(var(--border)) transparent',
                }}
              >
                {/* Load older messages button */}
                {hasMore && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      disabled={loadingOlder}
                      onClick={async () => {
                        if (!activeConversationId || !messages.length) return
                        setLoadingOlder(true)
                        try {
                          const before = messages[0].createdAt
                          const data = await api.get<{ messages: Message[]; hasMore: boolean }>(
                            `/conversations/${activeConversationId}/messages?limit=50&before=${encodeURIComponent(before)}`
                          )
                          setMessages((prev) => [...data.messages, ...prev])
                          setHasMore(data.hasMore)
                        } catch (err) {
                          console.error('Failed to load older messages:', err)
                        } finally {
                          setLoadingOlder(false)
                        }
                      }}
                    >
                      {loadingOlder ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      Charger les messages précédents
                    </Button>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium">Aucun message</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Envoyez le premier message pour démarrer la conversation
                    </p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.dateKey}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-4 first:mt-0">
                        <Separator className="flex-1" />
                        <span className="text-[11px] font-medium text-muted-foreground/70 px-2 flex-shrink-0">
                          {group.dateLabel}
                        </span>
                        <Separator className="flex-1" />
                      </div>

                      {/* Messages */}
                      {group.messages.map((msg, idx) => {
                        const isFirstInGroup =
                          idx === 0 ||
                          group.messages[idx - 1].senderId !== msg.senderId
                        const isLastInGroup =
                          idx === group.messages.length - 1 ||
                          group.messages[idx + 1]?.senderId !== msg.senderId

                        return renderMessageBubble(msg, isFirstInGroup, isLastInGroup)
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t bg-background px-4 py-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Écrire un message..."
                      value={newMessage}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      disabled={sendingMessage}
                      rows={1}
                      className="min-h-[40px] max-h-[100px] resize-none rounded-xl pr-10 py-2.5 text-sm bg-muted/50 border-0 focus-visible:ring-1"
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            type="button"
                            tabIndex={-1}
                          >
                            <Smile className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0" align="end" side="top">
                          {/* Emoji Search */}
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Rechercher un emoji..."
                              value={emojiSearch}
                              onChange={(e) => setEmojiSearch(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>

                          {/* Category Tabs */}
                          {!emojiSearch.trim() && (
                            <div className="flex border-b px-2 gap-1">
                              {EMOJI_CATEGORIES.map((cat, idx) => (
                                <button
                                  key={cat.name}
                                  onClick={() => setActiveEmojiCategory(idx)}
                                  className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors rounded-t-md ${
                                    activeEmojiCategory === idx
                                      ? 'text-primary border-b-2 border-primary bg-muted/50'
                                      : 'text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Emoji Grid */}
                          <ScrollArea className="h-[200px] overflow-y-auto">
                            <div className="p-2">
                              {filteredEmojiCategories.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                  Aucun emoji trouvé
                                </p>
                              ) : (
                                filteredEmojiCategories.map((cat) => (
                                  <div key={cat.name} className="mb-1">
                                    {!emojiSearch.trim() && (
                                      <p className="text-[10px] font-medium text-muted-foreground/60 px-1 py-1 uppercase tracking-wider">
                                        {cat.name}
                                      </p>
                                    )}
                                    <div className="grid grid-cols-8 gap-0.5">
                                      {cat.emojis.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => handleInsertEmoji(emoji)}
                                          className="h-9 w-9 flex items-center justify-center text-lg hover:bg-muted rounded-md transition-colors cursor-pointer"
                                          type="button"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    className="h-10 w-10 rounded-xl flex-shrink-0"
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 ml-1">
                  Appuyez sur Entrée pour envoyer, Shift+Entrée pour un retour à la ligne
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Conversation Dialog — inlined to avoid nested component remount on parent re-render */}
      <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Nouvelle conversation
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un utilisateur pour commencer une conversation.
            </DialogDescription>
          </DialogHeader>

          {/* Search users */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Users list */}
          <ScrollArea className="max-h-[300px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">
                  {users.length === 0
                    ? 'Aucun utilisateur disponible'
                    : 'Aucun résultat trouvé'}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedUserId === u.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${getAvatarColor(u.name)}`}>
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    {ROLE_LABELS[u.role] && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 flex-shrink-0">
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowNewConversation(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => selectedUserId && createConversation(selectedUserId)}
              disabled={!selectedUserId}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Message Confirmation Dialog ──────────────────────────── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer le message
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingMessageId}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId && activeConversationId) {
                  deleteMessage(confirmDeleteId, activeConversationId)
                }
              }}
              disabled={!!deletingMessageId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMessageId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
