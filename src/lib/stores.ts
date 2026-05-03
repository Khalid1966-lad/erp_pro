import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthState {
  token: string | null
  user: {
    id: string
    email: string
    name: string
    role: string
    isSuperAdmin?: boolean
    avatarUrl?: string
  } | null
  isAuthenticated: boolean
  login: (token: string, user: { id: string; email: string; name: string; role: string; isSuperAdmin?: boolean; avatarUrl?: string }) => void
  logout: () => void
  setUser: (user: { id: string; email: string; name: string; role: string; isSuperAdmin?: boolean; avatarUrl?: string }) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      setUser: (user) => set({ user })
    }),
    {
      name: 'gema-erp-auth'
    }
  )
)

export type ViewId =
  | 'dashboard'
  | 'clients'
  | 'products'
  | 'quotes'
  | 'sales-orders'
  | 'preparations'
  | 'invoices'
  | 'credit-notes'
  | 'delivery-notes'
  | 'customer-returns'
  | 'suppliers'
  | 'purchase-orders'
  | 'receptions'
  | 'price-requests'
  | 'supplier-quotes'
  | 'price-comparison'
  | 'supplier-invoices'
  | 'supplier-returns'
  | 'supplier-credit-notes'
  | 'stock-movements'
  | 'inventory'
  | 'stock-alerts'
  | 'lots'
  | 'bom'
  | 'routing'
  | 'workstations'
  | 'work-orders'
  | 'equipements'
  | 'maintenance'
  | 'cash-registers'
  | 'bank-accounts'
  | 'effets'
  | 'payments'
  | 'accounting'
  | 'settings'
  | 'audit-log'
  | 'users'
  | 'profile'
  | 'guide'
  | 'messages'
  | 'financial-reports'
  | 'quality-control'

export interface NavState {
  currentView: ViewId
  sidebarOpen: boolean
  helpTarget: { section: string; sub?: string } | null
  previousView: ViewId | null
  comparisonPriceRequestId: string | null
  /** Params passed from dashboard clicks to pre-filter views */
 navigationParams: Record<string, string> | null
  setCurrentView: (view: ViewId, params?: Record<string, string> | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openHelp: (section: string, sub?: string) => void
  clearHelp: () => void
  openComparison: (priceRequestId: string) => void
}

export const useNavStore = create<NavState>()((set) => ({
  currentView: 'dashboard',
  sidebarOpen: true,
  helpTarget: null,
  previousView: null,
  comparisonPriceRequestId: null,
  navigationParams: null,
  setCurrentView: (view, params) => set((s) => ({
    currentView: view,
    previousView: s.currentView === 'guide' ? s.previousView : s.currentView,
    navigationParams: params ?? null,
  })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openHelp: (section, sub) => set((s) => ({
    helpTarget: { section, sub },
    previousView: s.currentView === 'guide' ? s.previousView : s.currentView,
    currentView: 'guide',
  })),
  clearHelp: () => set({ helpTarget: null }),
  openComparison: (priceRequestId) => set((s) => ({
    previousView: s.currentView,
    currentView: 'price-comparison',
    comparisonPriceRequestId: priceRequestId,
  })),
}))

// ═══ Notification Store ═══
export interface NotificationItem {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success' | 'task' | 'deadline'
  category: 'system' | 'order' | 'delivery' | 'production' | 'payment' | 'stock' | 'message'
  entityType?: string
  entityId?: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

export interface NotificationState {
  unreadCount: number
  notifications: NotificationItem[]
  setUnreadCount: (count: number) => void
  setNotifications: (notifications: NotificationItem[]) => void
  addNotification: (notification: NotificationItem) => void
  markAsRead: (ids: string[]) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  notifications: [],
  setUnreadCount: (count) => set({ unreadCount: count }),
  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.isRead).length
  }),
  addNotification: (notification) => set((s) => {
    const exists = s.notifications.some(n => n.id === notification.id)
    if (exists) return s
    const newNotifications = [notification, ...s.notifications].slice(0, 50)
    return {
      notifications: newNotifications,
      unreadCount: newNotifications.filter(n => !n.isRead).length
    }
  }),
  markAsRead: (ids) => set((s) => ({
    notifications: s.notifications.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n),
    unreadCount: Math.max(0, s.unreadCount - ids.filter(id => s.notifications.some(n => n.id === id && !n.isRead)).length)
  })),
  clearAll: () => set({ notifications: [], unreadCount: 0 })
}))
