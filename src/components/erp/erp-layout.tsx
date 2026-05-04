'use client'

import { useAuthStore, useNavStore, type ViewId } from '@/lib/stores'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
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
  ShieldCheck,
  LogOut,
  Menu,
  Factory,
  ChevronDown,
  UserCog,
  FileQuestion,
  ArrowLeftRight,
  MessageSquare,
  BarChart3,
  ClipboardCheck,
  Layers,
  Wrench,
  Briefcase,
  Sun,
  Moon,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import Image from 'next/image'
import { motion } from 'framer-motion'
import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { NotificationBell } from '@/components/erp/notifications/notification-bell'
import { AgendaButton } from '@/components/erp/agenda/agenda-panel'

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
      { id: 'dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="h-4 w-4" />, color: 'text-sky-500', permission: 'dashboard:read' }
    ]
  },
  {
    title: 'Ventes',
    icon: <ShoppingCart className="h-4 w-4" />,
    items: [
      { id: 'clients', label: 'Clients', icon: <Users className="h-4 w-4" />, color: 'text-violet-500', permission: 'clients:read' },
      { id: 'quotes', label: 'Devis', icon: <FileText className="h-4 w-4" />, color: 'text-cyan-500', permission: 'quotes:read' },
      { id: 'sales-orders', label: 'Commandes', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-emerald-500', permission: 'sales_orders:read' },
      { id: 'preparations', label: 'Préparations', icon: <ClipboardList className="h-4 w-4" />, color: 'text-blue-500', permission: 'preparations:read' },
      { id: 'delivery-notes', label: 'Bons de livraison', icon: <Truck className="h-4 w-4" />, color: 'text-teal-600', permission: 'delivery_notes:read' },
      { id: 'customer-returns', label: 'Bons de retour clients', icon: <RotateCcw className="h-4 w-4" />, color: 'text-amber-600', permission: 'customer_returns:read' },
      { id: 'invoices', label: 'Factures', icon: <Receipt className="h-4 w-4" />, color: 'text-rose-500', permission: 'invoices:read' },
      { id: 'credit-notes', label: 'Avoirs', icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-500', permission: 'credit_notes:read' }
    ]
  },
  {
    title: 'Achats',
    icon: <Truck className="h-4 w-4" />,
    items: [
      { id: 'suppliers', label: 'Fournisseurs', icon: <Truck className="h-4 w-4" />, color: 'text-indigo-500', permission: 'suppliers:read' },
      { id: 'price-requests', label: 'Demandes de prix', icon: <FileQuestion className="h-4 w-4" />, color: 'text-purple-500', permission: 'price_requests:read' },
      { id: 'supplier-quotes', label: 'Devis fournisseurs', icon: <FileText className="h-4 w-4" />, color: 'text-sky-500', permission: 'supplier_quotes:read' },
      { id: 'purchase-orders', label: 'Commandes fournisseurs', icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-teal-500', permission: 'purchase_orders:read' },
      { id: 'receptions', label: 'Réceptions', icon: <Warehouse className="h-4 w-4" />, color: 'text-lime-600', permission: 'receptions:read' },
      { id: 'supplier-returns', label: 'Bons de retour', icon: <RotateCcw className="h-4 w-4" />, color: 'text-orange-500', permission: 'supplier_returns:read' },
      { id: 'supplier-credit-notes', label: 'Avoirs fournisseurs', icon: <ArrowLeftRight className="h-4 w-4" />, color: 'text-teal-500', permission: 'supplier_credit_notes:read' },
      { id: 'supplier-invoices', label: 'Factures fournisseurs', icon: <Receipt className="h-4 w-4" />, color: 'text-rose-500', permission: 'supplier_invoices:read' }
    ]
  },
  {
    title: 'Stock',
    icon: <Box className="h-4 w-4" />,
    items: [
      { id: 'products', label: 'Produits', icon: <Package className="h-4 w-4" />, color: 'text-amber-500', permission: 'products:read' },
      { id: 'stock-movements', label: 'Mouvements', icon: <Box className="h-4 w-4" />, color: 'text-slate-400', permission: 'stock_movements:read' },
      { id: 'stock-alerts', label: 'Alertes stock', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-500', permission: 'stock_alerts:read' },
      { id: 'inventory', label: 'Inventaires', icon: <ClipboardList className="h-4 w-4" />, color: 'text-yellow-500', permission: 'inventory:read' },
      { id: 'lots', label: 'Lots de stock', icon: <Layers className="h-4 w-4" />, color: 'text-violet-500', permission: 'stock_lots:read' }
    ]
  },
  {
    title: 'Production',
    icon: <Factory className="h-4 w-4" />,
    items: [
      { id: 'bom', label: 'Nomenclatures', icon: <Network className="h-4 w-4" />, color: 'text-pink-500', permission: 'bom:read' },
      { id: 'routing', label: 'Gammes', icon: <Route className="h-4 w-4" />, color: 'text-fuchsia-500', permission: 'routing:read' },
      { id: 'workstations', label: 'Postes de travail', icon: <Cog className="h-4 w-4" />, color: 'text-stone-500', permission: 'workstations:read' },
      { id: 'work-orders', label: 'Ordres de fabrication', icon: <Factory className="h-4 w-4" />, color: 'text-green-600', permission: 'work_orders:read' },
      { id: 'equipements', label: 'Équipements', icon: <Cog className="h-4 w-4" />, color: 'text-orange-500', permission: 'equipments:read' },
      { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" />, color: 'text-amber-500', permission: 'maintenance:read' },
      { id: 'quality-control', label: 'Contrôle qualité', icon: <ClipboardCheck className="h-4 w-4" />, color: 'text-cyan-600', permission: 'quality_control:read' }
    ]
  },
  {
    title: 'Finance',
    icon: <Landmark className="h-4 w-4" />,
    items: [
      { id: 'cash-registers', label: 'Caisses', icon: <CreditCard className="h-4 w-4" />, color: 'text-emerald-500', permission: 'cash:read' },
      { id: 'bank-accounts', label: 'Banque', icon: <Landmark className="h-4 w-4" />, color: 'text-blue-600', permission: 'bank:read' },
      { id: 'payments', label: 'Paiements', icon: <CreditCard className="h-4 w-4" />, color: 'text-violet-400', permission: 'payments:read' },
      { id: 'effets', label: 'Chèques & Effets', icon: <FileText className="h-4 w-4" />, color: 'text-orange-500', permission: 'effets_cheques:read' },
      { id: 'accounting', label: 'Comptabilité', icon: <BookOpen className="h-4 w-4" />, color: 'text-amber-600', permission: 'accounting:read' },
      { id: 'financial-reports', label: 'États financiers', icon: <BarChart3 className="h-4 w-4" />, color: 'text-violet-500', permission: 'financial_reports:read' }
    ]
  },
  {
    title: 'Communication',
    icon: <MessageSquare className="h-4 w-4" />,
    items: [
      { id: 'messages', label: 'Messagerie', icon: <MessageSquare className="h-4 w-4" />, color: 'text-sky-500', permission: 'messages:read' }
    ]
  },
  {
    title: 'Administration',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { id: 'users', label: 'Utilisateurs', icon: <UserCog className="h-4 w-4" />, color: 'text-emerald-500', superAdminOnly: true },
      { id: 'roles', label: 'Rôles & Permissions', icon: <ShieldCheck className="h-4 w-4" />, color: 'text-amber-500', superAdminOnly: true },
      { id: 'audit-log', label: "Journal d'audit", icon: <Shield className="h-4 w-4" />, color: 'text-slate-500', permission: 'audit_log:read' },
      { id: 'settings', label: 'Paramètres', icon: <Settings className="h-4 w-4" />, color: 'text-gray-400', permission: 'settings:read' },
      { id: 'guide', label: "Guide d'utilisation", icon: <BookOpen className="h-4 w-4" />, color: 'text-emerald-500', permission: 'guide:read' }
    ]
  },
  {
    title: 'Ressources Humaines',
    icon: <UserCog className="h-4 w-4" />,
    items: [
      { id: 'employees', label: 'Salariés', icon: <Users className="h-4 w-4" />, color: 'text-violet-500', permission: 'employees:read' },
      { id: 'employee-functions', label: 'Fonctions', icon: <Briefcase className="h-4 w-4" />, color: 'text-orange-500', permission: 'employees:read' }
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

// ─── Logo component: always shows the GEMA ERP PRO app logo ───
function SidebarLogo() {
  const { sidebarOpen } = useNavStore()
  const size = sidebarOpen ? 'w-9 h-9' : 'w-8 h-8'

  return (
    <div className={cn('relative shrink-0', size)}>
      <Image
        src="/logo.png"
        alt="GEMA ERP PRO"
        fill
        className="object-contain"
        priority
      />
    </div>
  )
}

function SidebarContent() {
  const { user, logout, hasPermission } = useAuthStore()
  const { currentView, setCurrentView, sidebarOpen } = useNavStore()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Check if a nav item is accessible to the current user
  const isItemAccessible = (item: NavItem): boolean => {
    // Super admin bypasses all checks
    if (user?.role === 'super_admin' || user?.isSuperAdmin) return true
    // superAdminOnly items
    if (item.superAdminOnly) return false
    // Items without permission requirement are always accessible
    if (!item.permission) return true
    return hasPermission(item.permission)
  }

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
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold text-sm tracking-tight truncate">GEMA ERP PRO</span>
            <span className="text-[10px] text-muted-foreground truncate">Production & Gestion</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 py-2">
        <nav className="space-y-1 px-2">
          {navigation.map((group) => {
            const isCollapsed = collapsedGroups.has(group.title)
            const hasActiveItem = group.items.some((item) => item.id === currentView)

            return (
              <div key={group.title} className="mb-1">
                {sidebarOpen ? (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={cn(
                      'flex items-center w-full gap-2 px-2 py-1.5 text-[11px] font-bold text-black dark:text-white uppercase tracking-wider hover:text-foreground transition-colors rounded-md',
                      hasActiveItem && !isCollapsed && 'text-foreground'
                    )}
                  >
                    <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', isCollapsed && '-rotate-90')} />
                    <span>{group.title}</span>
                  </button>
                ) : (
                  /* Collapsed mode: show group icon with tooltip instead of a divider */
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        'flex items-center justify-center w-full py-1.5 rounded-md cursor-default',
                        hasActiveItem && 'text-foreground/70'
                      )}>
                        <span className="shrink-0 text-muted-foreground/50">{group.icon}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-semibold text-xs">
                      {group.title}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Show items always when collapsed, only when not collapsed when open */}
                {(sidebarOpen ? !isCollapsed : true) && (
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map((item) => {
                      const isActive = currentView === item.id
                      const accessible = isItemAccessible(item)
                      const handleClick = () => {
                        if (!accessible) {
                          toast.error('Accès restreint', {
                            description: 'Vous n\'avez pas la permission d\'accéder à cette section.'
                          })
                          return
                        }
                        setCurrentView(item.id)
                      }
                      return (
                        <Tooltip key={item.id} delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleClick}
                              className={cn(
                                'sidebar-nav-item relative flex items-center gap-3 w-full px-3 py-[7px] text-[13px] rounded-lg transition-all duration-150 group',
                                !sidebarOpen && 'justify-center px-2',
                                !accessible && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
                                accessible && isActive
                                  ? 'sidebar-nav-active font-medium text-foreground'
                                  : accessible && 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                              )}
                            >
                              {/* Active indicator bar */}
                              {isActive && accessible && (
                                <span className="sidebar-active-bar absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                              )}
                              {/* Icon */}
                              <span className={cn(
                                'shrink-0 transition-colors',
                                isActive && accessible
                                  ? 'text-primary'
                                  : !accessible ? 'text-muted-foreground' : item.color
                              )}>
                                {item.icon}
                              </span>
                              {sidebarOpen && (
                                <span className="truncate flex items-center gap-1.5">
                                  {item.label}
                                  {!accessible && <Lock className="h-3 w-3 text-muted-foreground" />}
                                </span>
                              )}
                              {/* Lock icon in collapsed mode */}
                              {!sidebarOpen && !accessible && (
                                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
                                  <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                </span>
                              )}
                            </button>
                          </TooltipTrigger>
                          {!sidebarOpen && (
                            <TooltipContent side="right" className="font-medium">
                              <span className="flex items-center gap-1.5">
                                {item.label}
                                {!accessible && <Lock className="h-3 w-3" />}
                              </span>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      )
                    })}
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
          <p className="text-[10px] text-muted-foreground/60 text-center">
            GEMA ERP PRO v{APP_VERSION}
          </p>
        ) : (
          <p className="text-[9px] text-muted-foreground/50 text-center leading-none">v{APP_VERSION}</p>
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
          'hidden md:flex flex-col h-screen sticky top-0 border-r border-border bg-card transition-[width] duration-200 ease-out shrink-0 overflow-hidden',
          sidebarOpen ? 'w-[260px]' : 'w-[62px]'
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
        <SheetContent side="left" className="w-[260px] p-0 overflow-hidden">
          <SheetTitle className="sr-only">Navigation GEMA ERP PRO</SheetTitle>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-lg hover:bg-muted"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </motion.div>
    </Button>
  )
}

// ─── Update check button (small icon + tooltip) ───
function UpdateCheckButton() {
  const [checking, setChecking] = useState(false)

  const handleCheck = () => {
    const fn = (window as unknown as Record<string, unknown>).__pwaCheckUpdates as (() => Promise<void>) | undefined
    if (!fn) return
    setChecking(true)
    fn().finally(() => setTimeout(() => setChecking(false), 2000))
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg hover:bg-muted"
          onClick={handleCheck}
          disabled={checking}
          aria-label="Vérifier les mises à jour"
        >
          <motion.div
            animate={checking ? { rotate: 360 } : { rotate: 0 }}
            transition={checking ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Vérifier les mises à jour
      </TooltipContent>
    </Tooltip>
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
    'customer-returns': 'Bons de retour clients',
    'suppliers': 'Fournisseurs',
    'purchase-orders': 'Commandes fournisseur',
    'receptions': 'Réceptions',
    'price-requests': 'Demandes de prix',
    'supplier-quotes': 'Devis fournisseurs',
    'price-comparison': 'Comparateur de prix',
    'supplier-invoices': 'Factures fournisseurs',
    'supplier-returns': 'Bons de retour',
    'supplier-credit-notes': 'Avoirs fournisseurs',
    'stock-movements': 'Mouvements de stock',
    'inventory': 'Inventaires',
    'stock-alerts': 'Alertes stock',
    'lots': 'Lots de stock',
    'bom': 'Nomenclatures (BOM)',
    'routing': 'Gammes opératoires',
    'workstations': 'Postes de travail',
    'work-orders': 'Ordres de fabrication',
    'equipements': 'Équipements',
    'maintenance': 'Maintenance',
    'cash-registers': 'Caisses',
    'bank-accounts': 'Banque',
    'payments': 'Paiements',
    'effets': 'Chèques & Effets',
    'accounting': 'Comptabilité',
    'financial-reports': 'États financiers',
    'quality-control': 'Contrôle qualité',
    'employees': 'Salariés',
    'employee-functions': 'Fonctions',
    'settings': 'Paramètres',
    'audit-log': "Journal d'audit",
    'users': 'Utilisateurs',
    'roles': 'Rôles & Permissions',
    'guide': "Guide d'utilisation",
    'profile': 'Mon Profil',
    'messages': 'Messagerie'
  }

  return (
    <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 border-b border-border/60 px-4 md:px-6 flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex h-8 w-8 rounded-lg hover:bg-muted"
        onClick={toggleSidebar}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="md:hidden w-8" />
      <motion.h1
        key={currentView}
        className="font-semibold text-base"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {viewLabels[currentView] || currentView}
      </motion.h1>
      <div className="flex-1" />
      {user && (
        <>
          <AgendaButton />
          <UpdateCheckButton />
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full px-1 py-1 pr-3 hover:bg-accent/60 transition-colors outline-none">
              <Avatar className="h-8 w-8 ring-2 ring-border/50">
                <AvatarImage src={user.avatarUrl || ''} alt={user.name || ''} />
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
        </>
      )}
    </header>
  )
}
