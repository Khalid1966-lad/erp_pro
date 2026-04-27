'use client'

import {
  Bell,
  BellRing,
  CheckCheck,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Package,
  Truck,
  Banknote,
  Archive,
  Trash2,
  Factory,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useNotificationStore, type NotificationItem } from '@/lib/stores'
import { useNavStore, type ViewId } from '@/lib/stores'
import { useAuthStore } from '@/lib/stores'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Time ago helper ───────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffHr < 24) return `il y a ${diffHr}h`
  if (diffDay === 1) return 'hier'
  if (diffDay < 7) return `il y a ${diffDay}j`
  if (diffDay < 30) return `il y a ${Math.floor(diffDay / 7)} sem.`
  if (diffDay < 365) return `il y a ${Math.floor(diffDay / 30)} mois`
  return `il y a ${Math.floor(diffDay / 365)} an${Math.floor(diffDay / 365) > 1 ? 's' : ''}`
}

// ─── Icon mappings ─────────────────────────────────────────────────────────
const typeIcons: Record<NotificationItem['type'], { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  success: { icon: CheckCircle, color: 'text-emerald-500' },
  task: { icon: Clock, color: 'text-violet-500' },
  deadline: { icon: Clock, color: 'text-orange-500' },
}

const categoryIcons: Record<NotificationItem['category'], { icon: typeof Package; color: string }> = {
  order: { icon: Package, color: 'text-cyan-500' },
  delivery: { icon: Truck, color: 'text-teal-500' },
  production: { icon: Factory, color: 'text-green-600' },
  payment: { icon: Banknote, color: 'text-amber-500' },
  stock: { icon: Archive, color: 'text-slate-400' },
  message: { icon: MessageSquare, color: 'text-violet-400' },
  system: { icon: Info, color: 'text-blue-500' },
}

// ─── Component ─────────────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { notifications, unreadCount, setNotifications, markAsRead, clearAll } =
    useNotificationStore()
  const { setCurrentView } = useNavStore()
  const token = useAuthStore((s) => s.token)

  // ── Fetch notifications on mount & every 30 seconds ──
  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications)
      }
    } catch {
      // silent
    }
  }, [token, setNotifications])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // ── Mark all as read ──
  const handleMarkAllRead = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      })
      if (res.ok) {
        const ids = notifications.map((n) => n.id)
        markAsRead(ids)
        toast.success('Toutes les notifications marquées comme lues')
      }
    } catch {
      toast.error('Erreur lors du marquage des notifications')
    } finally {
      setLoading(false)
    }
  }, [token, notifications, markAsRead])

  // ── Mark single as read ──
  const handleMarkSingleRead = useCallback(
    async (notification: NotificationItem) => {
      if (!token || notification.isRead) return
      try {
        const res = await fetch('/api/notifications', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ids: [notification.id] }),
        })
        if (res.ok) {
          markAsRead([notification.id])
        }
      } catch {
        // silent
      }
    },
    [token, markAsRead]
  )

  // ── Delete notification ──
  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (!token) return
      try {
        const res = await fetch('/api/notifications', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id }),
        })
        if (res.ok) {
          // Remove from store by refetching
          fetchNotifications()
          toast.success('Notification supprimée')
        }
      } catch {
        toast.error('Erreur lors de la suppression')
      }
    },
    [token, fetchNotifications]
  )

  // ── Click notification item ──
  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      // Mark as read
      await handleMarkSingleRead(notification)

      // Navigate if actionUrl is a valid ViewId
      if (notification.actionUrl) {
        setCurrentView(notification.actionUrl as ViewId)
      }

      setOpen(false)
    },
    [handleMarkSingleRead, setCurrentView]
  )

  // ── Render icon for a notification ──
  const getNotificationIcon = (notification: NotificationItem) => {
    const category = categoryIcons[notification.category]
    const type = typeIcons[notification.type]
    // Prefer type icon if it exists and is not the default info
    if (notification.type !== 'info' && type) {
      const IconComp = type.icon
      return <IconComp className={cn('h-4 w-4', type.color)} />
    }
    if (category) {
      const IconComp = category.icon
      return <IconComp className={cn('h-4 w-4', category.color)} />
    }
    const DefaultIcon = Info
    return <DefaultIcon className="h-4 w-4 text-blue-500" />
  }

  const BellIcon = unreadCount > 0 ? BellRing : Bell

  return (
    <>
      {/* ── Bell button ── */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen(true)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none bg-red-500 text-white border-0"
            variant="destructive"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* ── Sheet panel ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
            )}
          </div>

          {/* Notification list */}
          <ScrollArea className="flex-1 min-h-0">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucune notification</p>
                <p className="text-xs mt-1">Les nouvelles notifications apparaîtront ici</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50',
                      !notification.isRead && 'bg-accent/20'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleNotificationClick(notification)
                      }
                    }}
                  >
                    {/* Unread dot */}
                    {!notification.isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}

                    {/* Category icon */}
                    <div className="mt-0.5 shrink-0">
                      {getNotificationIcon(notification)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 overflow-hidden pl-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{notification.title}</span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      className={cn(
                        'absolute right-2 top-2 h-6 w-6 rounded-full flex items-center justify-center',
                        'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                        'opacity-0 group-hover:opacity-100 transition-opacity'
                      )}
                      onClick={(e) => handleDelete(e, notification.id)}
                      aria-label="Supprimer la notification"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
