'use client'

import { useAuthStore, useNavStore, type ViewId } from '@/lib/stores'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  ShoppingCart,
  ClipboardList,
  Receipt,
  RotateCcw,
  Truck,
  Warehouse,
  ArrowDownToLine,
  Box,
  AlertTriangle,
  Cog,
  Network,
  Route,
  Settings,
  Building2,
  Landmark,
  CreditCard,
  BookOpen,
  Shield,
  LogOut,
  Menu,
  Factory,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface NavItem {
  id: ViewId
  label: string
  icon: React.ReactNode
  permission?: string
}

interface NavGroup {
  title: string
  icon: React.ReactNode
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: 'Tableau de bord',
    icon: <LayoutDashboard className="h-4 w-4" />,
    items: [
      { id: 'dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="h-4 w-4" /> }
    ]
  },
  {
    title: 'Commercial',
    icon: <ShoppingCart className="h-4 w-4" />,
    items: [
      { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" />, permission: 'clients:read' },
      { id: 'products', label: 'Produits', icon: <Package className="h-4 w-4" />, permission: 'products:read' },
      { id: 'quotes', label: 'Devis', icon: <FileText className="h-4 w-4" />, permission: 'quotes:read' },
      { id: 'sales-orders', label: 'Commandes', icon: <ShoppingCart className="h-4 w-4" />, permission: 'sales_orders:read' },
      { id: 'preparations', label: 'Préparations', icon: <ClipboardList className="h-4 w-4" />, permission: 'preparations:read' },
      { id: 'invoices', label: 'Factures', icon: <Receipt className="h-4 w-4" />, permission: 'invoices:read' },
      { id: 'credit-notes', label: 'Avoirs', icon: <RotateCcw className="h-4 w-4" />, permission: 'credit_notes:read' }
    ]
  },
  {
    title: 'Achats',
    icon: <Truck className="h-4 w-4" />,
    items: [
      { id: 'suppliers', label: 'Fournisseurs', icon: <Truck className="h-4 w-4" />, permission: 'suppliers:read' },
      { id: 'purchase-orders', label: 'Commandes fournisseur', icon: <ArrowDownToLine className="h-4 w-4" />, permission: 'purchase_orders:read' },
      { id: 'receptions', label: 'Réceptions', icon: <Warehouse className="h-4 w-4" />, permission: 'receptions:read' }
    ]
  },
  {
    title: 'Stock',
    icon: <Box className="h-4 w-4" />,
    items: [
      { id: 'stock-movements', label: 'Mouvements', icon: <Box className="h-4 w-4" />, permission: 'stock:read' },
      { id: 'stock-alerts', label: 'Alertes stock', icon: <AlertTriangle className="h-4 w-4" />, permission: 'stock:read' },
      { id: 'inventory', label: 'Inventaires', icon: <ClipboardList className="h-4 w-4" />, permission: 'stock:read' }
    ]
  },
  {
    title: 'Production',
    icon: <Factory className="h-4 w-4" />,
    items: [
      { id: 'bom', label: 'Nomenclatures', icon: <Network className="h-4 w-4" />, permission: 'bom:read' },
      { id: 'routing', label: 'Gammes', icon: <Route className="h-4 w-4" />, permission: 'routing:read' },
      { id: 'workstations', label: 'Postes de travail', icon: <Cog className="h-4 w-4" />, permission: 'workstations:read' },
      { id: 'work-orders', label: 'Ordres de fabrication', icon: <Factory className="h-4 w-4" />, permission: 'work_orders:read' }
    ]
  },
  {
    title: 'Finance',
    icon: <Landmark className="h-4 w-4" />,
    items: [
      { id: 'cash-registers', label: 'Caisses', icon: <CreditCard className="h-4 w-4" />, permission: 'cash:read' },
      { id: 'bank-accounts', label: 'Banque', icon: <Landmark className="h-4 w-4" />, permission: 'bank:read' },
      { id: 'payments', label: 'Paiements', icon: <CreditCard className="h-4 w-4" />, permission: 'payments:read' },
      { id: 'accounting', label: 'Comptabilité', icon: <BookOpen className="h-4 w-4" />, permission: 'accounting:read' }
    ]
  },
  {
    title: 'Administration',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { id: 'audit-log', label: 'Journal d\'audit', icon: <Shield className="h-4 w-4" /> },
      { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" /> }
    ]
  }
]

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  buyer: 'Acheteur',
  storekeeper: 'Magasinier',
  prod_manager: 'Resp. Production',
  operator: 'Opérateur',
  accountant: 'Comptable',
  cashier: 'Caissier',
  direction: 'Direction'
}

function SidebarContent() {
  const { user, logout } = useAuthStore()
  const { currentView, setCurrentView, sidebarOpen } = useNavStore()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <Factory className="w-5 h-5 text-primary-foreground" />
        </div>
        {sidebarOpen && (
          <span className="font-bold text-lg tracking-tight">GEMA ERP PRO</span>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {navigation.map((group) => {
            const isCollapsed = collapsedGroups.has(group.title)
            const hasActiveItem = group.items.some((item) => item.id === currentView)
            const visibleItems = group.items.filter((item) => {
              if (!item.permission) return true
              return true
            })

            if (visibleItems.length === 0) return null

            return (
              <div key={group.title} className="mb-1">
                {sidebarOpen ? (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={cn(
                      'flex items-center w-full gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors'
                    )}
                  >
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isCollapsed && '-rotate-90')} />
                    <span>{group.title}</span>
                  </button>
                ) : (
                  <div className="h-px bg-border my-2" />
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
                      <Tooltip key={item.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCurrentView(item.id)}
                            className={cn(
                              'flex items-center gap-3 w-full px-2 py-1.5 text-sm rounded-md transition-colors',
                              currentView === item.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                          >
                            {item.icon}
                            {sidebarOpen && <span>{item.label}</span>}
                          </button>
                        </TooltipTrigger>
                        {!sidebarOpen && (
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-border p-3 shrink-0">
        {sidebarOpen && user ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{roleLabels[user.role] || user.role}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function ERPSidebar() {
  const { sidebarOpen, toggleSidebar } = useNavStore()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card transition-all duration-200 shrink-0',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-3 left-3 z-50 bg-background shadow-sm border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation GEMA ERP PRO</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ERPHeader() {
  const { user } = useAuthStore()
  const { currentView, sidebarOpen, toggleSidebar } = useNavStore()

  const viewLabels: Record<ViewId, string> = {
    'dashboard': 'Tableau de bord',
    'clients': 'Clients',
    'products': 'Produits',
    'quotes': 'Devis',
    'sales-orders': 'Commandes clients',
    'preparations': 'Préparations',
    'invoices': 'Factures',
    'credit-notes': 'Avoirs',
    'suppliers': 'Fournisseurs',
    'purchase-orders': 'Commandes fournisseur',
    'receptions': 'Réceptions',
    'stock-movements': 'Mouvements de stock',
    'inventory': 'Inventaires',
    'stock-alerts': 'Alertes stock',
    'bom': 'Nomenclatures (BOM)',
    'routing': 'Gammes opératoires',
    'workstations': 'Postes de travail',
    'work-orders': 'Ordres de fabrication',
    'cash-registers': 'Caisses',
    'bank-accounts': 'Banque',
    'payments': 'Paiements',
    'accounting': 'Comptabilité',
    'settings': 'Paramètres',
    'audit-log': "Journal d'audit"
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 md:px-6 flex items-center gap-4">
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex h-8 w-8"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="md:hidden w-8" />
      <h1 className="font-semibold text-lg">{viewLabels[currentView] || currentView}</h1>
      <div className="flex-1" />
      {user && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{user.name}</span>
        </div>
      )}
    </header>
  )
}
