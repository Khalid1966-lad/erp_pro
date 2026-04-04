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
  } | null
  isAuthenticated: boolean
  login: (token: string, user: { id: string; email: string; name: string; role: string; isSuperAdmin?: boolean }) => void
  logout: () => void
  setUser: (user: { id: string; email: string; name: string; role: string; isSuperAdmin?: boolean }) => void
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
  | 'suppliers'
  | 'purchase-orders'
  | 'receptions'
  | 'stock-movements'
  | 'inventory'
  | 'stock-alerts'
  | 'bom'
  | 'routing'
  | 'workstations'
  | 'work-orders'
  | 'cash-registers'
  | 'bank-accounts'
  | 'payments'
  | 'accounting'
  | 'settings'
  | 'audit-log'
  | 'users'
  | 'profile'
  | 'guide'

export interface NavState {
  currentView: ViewId
  sidebarOpen: boolean
  setCurrentView: (view: ViewId) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useNavStore = create<NavState>()((set) => ({
  currentView: 'dashboard',
  sidebarOpen: true,
  setCurrentView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open })
}))
