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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
  FileOutput,
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
  ChevronDown,
  UserCog,
  FileQuestion,
  ArrowLeftRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import Image from 'next/image'
import React, { useState, useEffect } from 'react'

interface NavItem {
  id: ViewId
  label: string
  icon: React.ReactNode
  color: string
  permission?: string
  superAdminOnly?: boolean
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
      { id: 'dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="h-4 w-4" />, color: 'text-sky-500' }
    ]
  },
  {
    title: 'Ventes',
    icon: <ShoppingCart className="h-4 w-4" />,
    items: [
      { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" />, color: 'text-violet-500', permission: 'clients:read' },
      { id: 'products', label: 'Produits', icon: <Package className="h-4 w-4" />, color: 'text-amber-500', permission: 'products:read' },
      { id: 'quotes', label: 'Devis', icon: <FileText className="h-4 w-4" />, color: 'text-cyan-500', permission: 'quotes:read' },
      { id: 'sales-orders', label: 'Commandes', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-emerald-500', permission: 'sales_orders:read' },
      { id: 'preparations', label: 'Préparations', icon: <ClipboardList className="h-4 w-4" />, color: 'text-blue-500', permission: 'preparations:read' },
      { id: 'delivery-notes', label: 'Bons de livraison', icon: <Truck className="h-4 w-4" />, color: 'text-teal-600', permission: 'delivery_notes:read' },
      { id: 'invoices', label: 'Factures', icon: <Receipt className="h-4 w-4" />, color: 'text-rose-500', permission: 'invoices:read' },
      { id: 'credit-notes', label: 'Avoirs', icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-500', permission: 'credit_notes:read' }
    ]
  },
  {
    title: 'Achats',
    icon: <Truck className="h-4 w-4" />,
    items: [
      { id: 'suppliers', label: 'Fournisseurs', icon: <Truck className="h-4 w-4" />, color: 'text-indigo-500', permission: 'suppliers:read' },
      { id: 'price-requests', label: 'Demandes de prix', icon: <FileQuestion className="h-4 w-4" />, color: 'text-purple-500', permission: 'purchase_orders:read' },
      { id: 'supplier-quotes', label: 'Devis fournisseurs', icon: <FileText className="h-4 w-4" />, color: 'text-sky-500', permission: 'purchase_orders:read' },
      { id: 'purchase-orders', label: 'Commandes fournisseurs', icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-teal-500', permission: 'purchase_orders:read' },
      { id: 'receptions', label: 'Réceptions', icon: <Warehouse className="h-4 w-4" />, color: 'text-lime-600', permission: 'receptions:read' },
      { id: 'supplier-returns', label: 'Bons de retour', icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-500', permission: 'purchase_orders:read' },
      { id: 'supplier-credit-notes', label: 'Avoirs fournisseurs', icon: <ArrowLeftRight className="h-4 w-4" />, color: 'text-teal-500', permission: 'purchase_orders:read' },
      { id: 'supplier-invoices', label: 'Factures fournisseurs', icon: <Receipt className="h-4 w-4" />, color: 'text-rose-500', permission: 'purchase_orders:read' }
    ]
  },
  {
    title: 'Stock',
    icon: <Box className="h-4 w-4" />,
    items: [
      { id: 'stock-movements', label: 'Mouvements', icon: <Box className="h-4 w-4" />, color: 'text-slate-400', permission: 'stock:read' },
      { id: 'stock-alerts', label: 'Alertes stock', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-500', permission: 'stock:read' },
      { id: 'inventory', label: 'Inventaires', icon: <ClipboardList className="h-4 w-4" />, color: 'text-yellow-500', permission: 'stock:read' }
    ]
  },
  {
    title: 'Production',
    icon: <Factory className="h-4 w-4" />,
    items: [
      { id: 'bom', label: 'Nomenclatures', icon: <Network className="h-4 w-4" />, color: 'text-pink-500', permission: 'bom:read' },
      { id: 'routing', label: 'Gammes', icon: <Route className="h-4 w-4" />, color: 'text-fuchsia-500', permission: 'routing:read' },
      { id: 'workstations', label: 'Postes de travail', icon: <Cog className="h-4 w-4" />, color: 'text-stone-500', permission: 'workstations:read' },
      { id: 'work-orders', label: 'Ordres de fabrication', icon: <Factory className="h-4 w-4" />, color: 'text-green-600', permission: 'work_orders:read' }
    ]
  },
  {
    title: 'Finance',
    icon: <Landmark className="h-4 w-4" />,
    items: [
      { id: 'cash-registers', label: 'Caisses', icon: <CreditCard className="h-4 w-4" />, color: 'text-emerald-500', permission: 'cash:read' },
      { id: 'bank-accounts', label: 'Banque', icon: <Landmark className="h-4 w-4" />, color: 'text-blue-600', permission: 'bank:read' },
      { id: 'payments', label: 'Paiements', icon: <CreditCard className="h-4 w-4" />, color: 'text-violet-400', permission: 'payments:read' },
      { id: 'accounting', label: 'Comptabilité', icon: <BookOpen className="h-4 w-4" />, color: 'text-amber-600', permission: 'accounting:read' }
    ]
  },
  {
    title: 'Administration',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { id: 'users', label: 'Utilisateurs', icon: <UserCog className="h-4 w-4" />, color: 'text-emerald-500', superAdminOnly: true },
      { id: 'audit-log', label: 'Journal d\'audit', icon: <Shield className="h-4 w-4" />, color: 'text-slate-500' },
      { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" />, color: 'text-gray-400' },
      { id: 'guide', label: "Guide d'utilisation", icon: <BookOpen className="h-4 w-4" />, color: 'text-emerald-500' }
    ]
  }
]

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
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

// ─── Logo component: uses custom uploaded logo if set, else default ───
function SidebarLogo() {
  const { sidebarOpen } = useNavStore()
  const [logoSrc, setLogoSrc] = useState('/logo.png')

  useEffect(() => {
    // Check if a custom logo was uploaded (stored in settings as company_logo_url)
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settingsMap?.company_logo_url) {
          setLogoSrc(data.settingsMap.company_logo_url)
        }
      })
      .catch(() => {})
  }, [])

  const size = sidebarOpen ? 'w-8 h-8' : 'w-8 h-8'

  return (
    <div className={cn('relative shrink-0', size)}>
      <Image
        src={logoSrc}
        alt="GEMA ERP PRO"
        fill
        className="object-contain"
        unoptimized={logoSrc.startsWith('/api/')}
      />
    </div>
  )
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
      <div className="flex items-center gap-3 px-3 h-14 border-b border-border shrink-0">
        <SidebarLogo />
        {sidebarOpen && (
          <span className="font-bold text-base tracking-tight truncate">GEMA ERP PRO</span>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 py-2">
        <nav className="space-y-1 px-2">
          {navigation.map((group) => {
            const isCollapsed = collapsedGroups.has(group.title)
            const hasActiveItem = group.items.some((item) => item.id === currentView)
            const visibleItems = group.items.filter((item) => {
              if (item.superAdminOnly && user?.role !== 'super_admin' && !user?.isSuperAdmin) return false
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
                            {currentView === item.id
                              ? item.icon
                              : React.isValidElement(item.icon)
                                ? React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                                    className: cn('h-4 w-4', item.color),
                                  })
                                : item.icon
                            }
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

      {/* Version footer */}
      <div className="border-t border-border px-4 py-2 shrink-0">
        {sidebarOpen ? (
          <p className="text-[10px] text-muted-foreground text-center">
            GEMA ERP PRO v{APP_VERSION}
          </p>
        ) : (
          <p className="text-[9px] text-muted-foreground text-center leading-none">v{APP_VERSION}</p>
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
          'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card transition-all duration-200 shrink-0 overflow-hidden',
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
        <SheetContent side="left" className="w-64 p-0 overflow-hidden">
          <SheetTitle className="sr-only">Navigation GEMA ERP PRO</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ERPHeader() {
  const { user, logout } = useAuthStore()
  const { currentView, sidebarOpen, toggleSidebar, setCurrentView } = useNavStore()

  const viewLabels: Record<ViewId, string> = {
    'dashboard': 'Tableau de bord',
    'clients': 'Clients',
    'products': 'Produits',
    'quotes': 'Devis',
    'sales-orders': 'Commandes clients',
    'preparations': 'Préparations',
    'invoices': 'Factures',
    'credit-notes': 'Avoirs',
    'delivery-notes': 'Bons de livraison',
    'suppliers': 'Fournisseurs',
    'purchase-orders': 'Commandes fournisseur',
    'receptions': 'Réceptions',
    'price-requests': 'Demandes de prix',
    'supplier-quotes': 'Devis fournisseurs',
    'supplier-invoices': 'Factures fournisseurs',
    'supplier-returns': 'Bons de retour',
    'supplier-credit-notes': 'Avoirs fournisseurs',
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
    'audit-log': "Journal d'audit",
    'users': 'Utilisateurs',
    'guide': "Guide d'utilisation",
    'profile': 'Mon Profil'
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full px-1 py-1 pr-3 hover:bg-accent transition-colors outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-tight">{user.name}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{roleLabels[user.role] || user.role}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground leading-none">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('profile')} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              Mon Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
