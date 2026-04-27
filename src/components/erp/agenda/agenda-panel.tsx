'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useNavStore } from '@/lib/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet'
import {
  CalendarDays, FileText, ShoppingCart, ClipboardList, Truck, Receipt,
  Package, Factory, RotateCcw, AlertTriangle, ChevronRight, RefreshCw,
  Clock, TrendingUp, ArrowDownToLine, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, addDays, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Types ──
interface AgendaStats {
  activeQuotes: number
  pendingOrders: number
  pendingPreparations: number
  upcomingDeliveries: number
  pendingInvoices: number
  activeWorkOrders: number
  pendingPurchaseOrders: number
  stockAlerts: number
  overdueInvoices: number
}

interface AgendaData {
  stats: AgendaStats
  quotes: AgendaItem[]
  orders: AgendaItem[]
  preparations: PreparationItem[]
  deliveryNotes: DeliveryItem[]
  invoices: InvoiceItem[]
  workOrders: WorkOrderItem[]
  purchaseOrders: PurchaseOrderItem[]
  stockAlerts: StockAlertItem[]
  upcomingInvoices: InvoiceItem[]
}

interface AgendaItem {
  id: string; number: string; status: string
  clientName: string; totalTTC: number; date?: string
}

interface PreparationItem {
  id: string; number: string; status: string
  orderNumber: string; clientName: string; createdAt: string
}

interface DeliveryItem {
  id: string; number: string; status: string
  clientName: string; plannedDate: string | null; totalTTC: number
}

interface InvoiceItem {
  id: string; number: string; status: string
  clientName: string; totalTTC: number; amountPaid: number; dueDate: string
}

interface WorkOrderItem {
  id: string; number: string; status: string
  productRef: string; productDesignation: string
  quantity: number; plannedDate: string | null
}

interface PurchaseOrderItem {
  id: string; number: string; status: string
  supplierName: string; totalTTC: number; expectedDate: string
}

interface StockAlertItem {
  id: string; reference: string; designation: string
  currentStock: number; minStock: number
}

// ── Status label helpers ──
const quoteStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Envoyé', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  accepted: { label: 'Accepté', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  expired: { label: 'Expiré', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
}

const orderStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_preparation: { label: 'En préparation', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  prepared: { label: 'Préparée', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  partially_delivered: { label: 'Partiellement livrée', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

const prepStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Terminée', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

const invoiceStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  validated: { label: 'Validée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  sent: { label: 'Envoyée', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  paid: { label: 'Payée', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  partially_paid: { label: 'Partiellement payée', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  overdue: { label: 'En retard', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

const workOrderStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  planned: { label: 'Planifié', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  closed: { label: 'Fermé', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

const poStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Envoyée', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  partially_received: { label: 'Partiellement reçue', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  received: { label: 'Reçue', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

const deliveryStatusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  confirmed: { label: 'Confirmé', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  delivered: { label: 'Livré', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' }
}

// ── Helpers ──
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'dd MMM yyyy', { locale: fr })
  } catch { return '—' }
}

function fmtRelative(d: string | null | undefined) {
  if (!d) return ''
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr })
  } catch { return '' }
}

function fmtMoney(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 }).format(amount)
}

function getDueDateStyle(dueDate: string) {
  const due = new Date(dueDate)
  const daysLeft = differenceInDays(due, new Date())
  if (daysLeft < 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (daysLeft === 0) return 'text-orange-600 dark:text-orange-400 font-semibold'
  if (daysLeft <= 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

function getDueDateLabel(dueDate: string) {
  const due = new Date(dueDate)
  if (isToday(due)) return "Aujourd'hui"
  if (isTomorrow(due)) return 'Demain'
  const daysLeft = differenceInDays(due, new Date())
  if (daysLeft < 0) return `${Math.abs(daysLeft)}j de retard`
  if (daysLeft <= 7) return `Dans ${daysLeft}j`
  return fmtDate(dueDate)
}

// ── Stat Card ──
function StatCard({ icon, label, value, color, onClick }: {
  icon: React.ReactNode; label: string; value: number; color: string; onClick?: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl p-3 text-left transition-all cursor-pointer border border-border/50 hover:border-border hover:shadow-sm group',
        'bg-gradient-to-br from-card to-card/80'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('rounded-lg p-1.5 shrink-0', color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={cn('text-2xl font-bold tracking-tight leading-none', value > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
        </div>
      </div>
      {value > 0 && (
        <div className="absolute top-0 right-0 w-16 h-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/5" />
      )}
    </motion.button>
  )
}

// ── Agenda Item Row ──
function AgendaRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer',
        'hover:bg-muted/50 border border-transparent hover:border-border/50'
      )}
    >
      {children}
    </motion.div>
  )
}

// ── Empty State ──
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-muted-foreground/30 mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ── Loading Skeleton ──
function AgendaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ── Main Agenda Panel ──
function AgendaPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { setCurrentView } = useNavStore()
  const [data, setData] = useState<AgendaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchAgenda = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<AgendaData>('/agenda?days=30')
      setData(res)
    } catch (err) {
      console.error('Erreur chargement agenda:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchAgenda()
  }, [open, fetchAgenda])

  const navigateTo = (view: string) => {
    setCurrentView(view as 'quotes' | 'sales-orders' | 'preparations' | 'invoices' | 'work-orders')
    onOpenChange(false)
  }

  const totalPending = data ? (
    data.stats.pendingOrders + data.stats.pendingPreparations +
    data.stats.overdueInvoices + data.stats.pendingPurchaseOrders +
    data.stats.stockAlerts
  ) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border/50 bg-gradient-to-b from-card to-card/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-primary/10 p-2">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">Mon Agenda</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {data ? `Mis à jour ${fmtRelative(new Date().toISOString())}` : 'Chargement...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalPending > 0 && (
                <Badge variant="default" className="text-[11px] px-2 py-0.5 rounded-full font-semibold">
                  {totalPending} en cours
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAgenda} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4">
              {loading && !data ? (
                <AgendaSkeleton />
              ) : data ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4 mt-0">
                    {/* Stat Cards Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <StatCard
                        icon={<FileText className="h-3.5 w-3.5 text-blue-500" />}
                        label="Devis actifs"
                        value={data.stats.activeQuotes}
                        color="bg-blue-100 dark:bg-blue-900/30"
                      />
                      <StatCard
                        icon={<ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />}
                        label="Commandes"
                        value={data.stats.pendingOrders}
                        color="bg-emerald-100 dark:bg-emerald-900/30"
                      />
                      <StatCard
                        icon={<ClipboardList className="h-3.5 w-3.5 text-indigo-500" />}
                        label="Préparations"
                        value={data.stats.pendingPreparations}
                        color="bg-indigo-100 dark:bg-indigo-900/30"
                      />
                      <StatCard
                        icon={<Truck className="h-3.5 w-3.5 text-teal-500" />}
                        label="Livraisons"
                        value={data.stats.upcomingDeliveries}
                        color="bg-teal-100 dark:bg-teal-900/30"
                      />
                      <StatCard
                        icon={<Receipt className="h-3.5 w-3.5 text-rose-500" />}
                        label="Factures"
                        value={data.stats.pendingInvoices}
                        color="bg-rose-100 dark:bg-rose-900/30"
                      />
                      <StatCard
                        icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        label="En retard"
                        value={data.stats.overdueInvoices}
                        color="bg-red-100 dark:bg-red-900/30"
                      />
                      <StatCard
                        icon={<Factory className="h-3.5 w-3.5 text-green-600" />}
                        label="Ordres fabr."
                        value={data.stats.activeWorkOrders}
                        color="bg-green-100 dark:bg-green-900/30"
                      />
                      <StatCard
                        icon={<ArrowDownToLine className="h-3.5 w-3.5 text-orange-500" />}
                        label="Cmds fourn."
                        value={data.stats.pendingPurchaseOrders}
                        color="bg-orange-100 dark:bg-orange-900/30"
                      />
                      <StatCard
                        icon={<Package className="h-3.5 w-3.5 text-amber-500" />}
                        label="Alertes stock"
                        value={data.stats.stockAlerts}
                        color="bg-amber-100 dark:bg-amber-900/30"
                      />
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Échéances à venir
                      </h3>
                      <div className="space-y-1">
                        {data.upcomingInvoices.filter(i => i.dueDate && differenceInDays(new Date(i.dueDate), new Date()) <= 7).length > 0 ? (
                          data.upcomingInvoices
                            .filter(i => i.dueDate && differenceInDays(new Date(i.dueDate), new Date()) <= 7)
                            .slice(0, 5)
                            .map(invoice => (
                              <AgendaRow key={invoice.id} onClick={() => navigateTo('invoices')}>
                                <div className={cn(
                                  'rounded-lg p-1.5 shrink-0',
                                  isPast(new Date(invoice.dueDate)) && invoice.status !== 'paid'
                                    ? 'bg-red-100 dark:bg-red-900/30'
                                    : isToday(new Date(invoice.dueDate))
                                      ? 'bg-orange-100 dark:bg-orange-900/30'
                                      : 'bg-muted'
                                )}>
                                  <Receipt className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{invoice.number}</span>
                                    <span className="text-xs text-muted-foreground truncate">{invoice.clientName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-mono">{fmtMoney(invoice.totalTTC - invoice.amountPaid)}</span>
                                    <span className={cn('text-[11px]', getDueDateStyle(invoice.dueDate))}>
                                      {getDueDateLabel(invoice.dueDate)}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                              </AgendaRow>
                            ))
                        ) : (
                          <div className="text-center py-4">
                            <Clock className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">Aucune échéance imminente</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Activité récente
                      </h3>
                      <div className="space-y-1">
                        {data.preparations.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('preparations')}>
                            <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-1.5 shrink-0">
                              <ClipboardList className="h-3.5 w-3.5 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{data.preparations[0].number}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {data.preparations[0].clientName} — {data.preparations[0].orderNumber}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0', prepStatusLabels[data.preparations[0].status]?.color)}>
                              {prepStatusLabels[data.preparations[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.orders.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('sales-orders')}>
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-1.5 shrink-0">
                              <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{data.orders[0].number}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {data.orders[0].clientName} — {fmtMoney(data.orders[0].totalTTC)}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0', orderStatusLabels[data.orders[0].status]?.color)}>
                              {orderStatusLabels[data.orders[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.workOrders.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('work-orders')}>
                            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-1.5 shrink-0">
                              <Factory className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{data.workOrders[0].number}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {data.workOrders[0].productDesignation} — Qté: {data.workOrders[0].quantity}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0', workOrderStatusLabels[data.workOrders[0].status]?.color)}>
                              {workOrderStatusLabels[data.workOrders[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.preparations.length === 0 && data.orders.length === 0 && data.workOrders.length === 0 && (
                          <div className="text-center py-4">
                            <TrendingUp className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">Aucune activité récente</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Orders Tab */}
                  <TabsContent value="orders" className="space-y-1 mt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Devis & Commandes
                    </h3>
                    {data.quotes.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-2">Devis</p>
                        {data.quotes.map(q => (
                          <AgendaRow key={q.id} onClick={() => navigateTo('quotes')}>
                            <div className="rounded-lg bg-sky-100 dark:bg-sky-900/30 p-1.5 shrink-0">
                              <FileText className="h-3.5 w-3.5 text-sky-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{q.number}</span>
                                <span className="text-xs text-muted-foreground truncate">{q.clientName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono">{fmtMoney(q.totalTTC)}</span>
                                {q.validUntil && (
                                  <span className={cn('text-[11px]', getDueDateStyle(q.validUntil))}>
                                    Expire {getDueDateLabel(q.validUntil)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', quoteStatusLabels[q.status]?.color)}>
                              {quoteStatusLabels[q.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                    {data.orders.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-2">Commandes clients</p>
                        {data.orders.map(o => (
                          <AgendaRow key={o.id} onClick={() => navigateTo('sales-orders')}>
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-1.5 shrink-0">
                              <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{o.number}</span>
                                <span className="text-xs text-muted-foreground truncate">{o.clientName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono">{fmtMoney(o.totalTTC)}</span>
                                {o.deliveryDate && <span className="text-[11px] text-muted-foreground">Livraison {fmtDate(o.deliveryDate)}</span>}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', orderStatusLabels[o.status]?.color)}>
                              {orderStatusLabels[o.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                    {data.quotes.length === 0 && data.orders.length === 0 && (
                      <EmptyState icon={<ShoppingCart className="h-8 w-8" />} message="Aucun devis ou commande en cours" />
                    )}
                  </TabsContent>

                  {/* Preparations Tab */}
                  <TabsContent value="preparations" className="space-y-1 mt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Préparations en cours
                    </h3>
                    {data.preparations.length > 0 ? (
                      data.preparations.map(p => (
                        <AgendaRow key={p.id} onClick={() => navigateTo('preparations')}>
                          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-1.5 shrink-0">
                            <ClipboardList className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{p.number}</span>
                              <span className="text-xs text-muted-foreground truncate">{p.clientName}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">Cmd: {p.orderNumber}</span>
                              <span className="text-[11px] text-muted-foreground">{fmtRelative(p.createdAt)}</span>
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', prepStatusLabels[p.status]?.color)}>
                            {prepStatusLabels[p.status]?.label}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<ClipboardList className="h-8 w-8" />} message="Aucune préparation en cours" />
                    )}

                    {data.deliveryNotes.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-3">Livraisons planifiées</p>
                        {data.deliveryNotes.map(d => (
                          <AgendaRow key={d.id}>
                            <div className="rounded-lg bg-teal-100 dark:bg-teal-900/30 p-1.5 shrink-0">
                              <Truck className="h-3.5 w-3.5 text-teal-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{d.number}</span>
                                <span className="text-xs text-muted-foreground truncate">{d.clientName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono">{fmtMoney(d.totalTTC)}</span>
                                {d.plannedDate && <span className="text-[11px] text-muted-foreground">{fmtDate(d.plannedDate)}</span>}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', deliveryStatusLabels[d.status]?.color)}>
                              {deliveryStatusLabels[d.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                  </TabsContent>

                  {/* Invoices Tab */}
                  <TabsContent value="invoices" className="space-y-1 mt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Factures
                    </h3>
                    {data.invoices.length > 0 ? (
                      data.invoices.map(inv => (
                        <AgendaRow key={inv.id} onClick={() => navigateTo('invoices')}>
                          <div className={cn(
                            'rounded-lg p-1.5 shrink-0',
                            inv.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' :
                            inv.status === 'paid' ? 'bg-green-100 dark:bg-green-900/30' :
                            'bg-rose-100 dark:bg-rose-900/30'
                          )}>
                            <Receipt className={cn(
                              'h-3.5 w-3.5',
                              inv.status === 'overdue' ? 'text-red-500' :
                              inv.status === 'paid' ? 'text-green-500' :
                              'text-rose-500'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{inv.number}</span>
                              <span className="text-xs text-muted-foreground truncate">{inv.clientName}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono">{fmtMoney(inv.totalTTC - inv.amountPaid)}</span>
                              <span className={cn('text-[11px]', getDueDateStyle(inv.dueDate))}>
                                {getDueDateLabel(inv.dueDate)}
                              </span>
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', invoiceStatusLabels[inv.status]?.color)}>
                            {invoiceStatusLabels[inv.status]?.label}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Receipt className="h-8 w-8" />} message="Aucune facture en cours" />
                    )}

                    {data.upcomingInvoices.length > 0 && data.invoices.length === 0 && (
                      <EmptyState icon={<Receipt className="h-8 w-8" />} message="Aucune facture en cours" />
                    )}
                  </TabsContent>

                  {/* Production Tab */}
                  <TabsContent value="production" className="space-y-1 mt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Production
                    </h3>
                    {data.workOrders.length > 0 ? (
                      data.workOrders.map(w => (
                        <AgendaRow key={w.id} onClick={() => navigateTo('work-orders')}>
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-1.5 shrink-0">
                            <Factory className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{w.number}</span>
                              <span className="text-xs text-muted-foreground truncate">{w.productRef}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground truncate">{w.productDesignation}</span>
                              <span className="text-[11px] text-muted-foreground">Qté: {w.quantity}</span>
                              {w.plannedDate && <span className="text-[11px] text-muted-foreground">{fmtDate(w.plannedDate)}</span>}
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', workOrderStatusLabels[w.status]?.color)}>
                            {workOrderStatusLabels[w.status]?.label}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Factory className="h-8 w-8" />} message="Aucun ordre de fabrication actif" />
                    )}

                    {data.purchaseOrders.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-3">Commandes fournisseurs</p>
                        {data.purchaseOrders.map(po => (
                          <AgendaRow key={po.id}>
                            <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-1.5 shrink-0">
                              <ArrowDownToLine className="h-3.5 w-3.5 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{po.number}</span>
                                <span className="text-xs text-muted-foreground truncate">{po.supplierName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono">{fmtMoney(po.totalTTC)}</span>
                                <span className="text-[11px] text-muted-foreground">{fmtDate(po.expectedDate)}</span>
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', poStatusLabels[po.status]?.color)}>
                              {poStatusLabels[po.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                  </TabsContent>

                  {/* Alerts Tab */}
                  <TabsContent value="alerts" className="space-y-1 mt-0">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Alertes stock
                    </h3>
                    {data.stockAlerts.length > 0 ? (
                      data.stockAlerts.map(s => (
                        <AgendaRow key={s.id} onClick={() => navigateTo('stock-alerts')}>
                          <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-1.5 shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium font-mono truncate">{s.reference}</span>
                              <span className="text-xs text-muted-foreground truncate">{s.designation}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono text-red-600 dark:text-red-400">
                                Stock: {s.currentStock}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Min: {s.minStock}
                              </span>
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                            {s.currentStock === 0 ? 'Rupture' : 'Bas'}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Package className="h-8 w-8" />} message="Aucune alerte de stock" />
                    )}

                    {data.overdueInvoices > 0 && data.upcomingInvoices.filter(i => isPast(new Date(i.dueDate)) && i.status !== 'paid').length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-3">Factures en retard</p>
                        {data.upcomingInvoices
                          .filter(i => isPast(new Date(i.dueDate)) && i.status !== 'paid')
                          .map(inv => (
                            <AgendaRow key={inv.id} onClick={() => navigateTo('invoices')}>
                              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-1.5 shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{inv.number}</span>
                                  <span className="text-xs text-muted-foreground truncate">{inv.clientName}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs font-mono text-red-600 dark:text-red-400">{fmtMoney(inv.totalTTC - inv.amountPaid)}</span>
                                  <span className="text-[11px] text-red-600 dark:text-red-400">
                                    Retard: {Math.abs(differenceInDays(new Date(inv.dueDate), new Date()))}j
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            </AgendaRow>
                          ))}
                      </>
                    )}
                  </TabsContent>

                  {/* Tabs Navigation */}
                  <div className="sticky bottom-0 bg-background/90 backdrop-blur-sm pt-3 pb-1 -mx-1">
                    <TabsList className="w-full h-9 bg-muted/50">
                      <TabsTrigger value="overview" className="text-[11px] flex-1 h-7 gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className="hidden sm:inline">Vue</span>
                      </TabsTrigger>
                      <TabsTrigger value="orders" className="text-[11px] flex-1 h-7 gap-1">
                        <ShoppingCart className="h-3 w-3" />
                        <span className="hidden sm:inline">Ventes</span>
                      </TabsTrigger>
                      <TabsTrigger value="preparations" className="text-[11px] flex-1 h-7 gap-1">
                        <ClipboardList className="h-3 w-3" />
                        <span className="hidden sm:inline">Prép.</span>
                      </TabsTrigger>
                      <TabsTrigger value="invoices" className="text-[11px] flex-1 h-7 gap-1">
                        <Receipt className="h-3 w-3" />
                        <span className="hidden sm:inline">Fact.</span>
                      </TabsTrigger>
                      <TabsTrigger value="production" className="text-[11px] flex-1 h-7 gap-1">
                        <Factory className="h-3 w-3" />
                        <span className="hidden sm:inline">Prod.</span>
                      </TabsTrigger>
                      <TabsTrigger value="alerts" className="text-[11px] flex-1 h-7 gap-1 relative">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="hidden sm:inline">Alertes</span>
                        {data.stats.stockAlerts + data.stats.overdueInvoices > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>
              ) : (
                <AgendaSkeleton />
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Exported Agenda Button (used in header) ──
export function AgendaButton() {
  const [open, setOpen] = useState(false)
  const [badgeCount, setBadgeCount] = useState(0)

  // Fetch minimal count on mount
  useEffect(() => {
    api.get<{ stats: AgendaStats }>('/agenda?days=30')
      .then(res => {
        const s = res.stats
        setBadgeCount(s.pendingOrders + s.pendingPreparations + s.overdueInvoices + s.stockAlerts + s.activeWorkOrders)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg hover:bg-muted relative"
        onClick={() => setOpen(true)}
        aria-label="Mon agenda"
      >
        <CalendarDays className="h-4 w-4" />
        {badgeCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </motion.span>
        )}
      </Button>
      <AgendaPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
