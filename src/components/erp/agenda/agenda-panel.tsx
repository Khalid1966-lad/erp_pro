'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { useNavStore } from '@/lib/stores'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  CalendarDays, ChevronLeft, ChevronRight, FileText, ShoppingCart,
  ClipboardList, Truck, Receipt, Package, Factory, AlertTriangle,
  RefreshCw, Clock, TrendingUp, ArrowDownToLine, Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
  format, formatDistanceToNow, isPast, isToday, isTomorrow,
  differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths,
  subMonths, getDate
} from 'date-fns'
import { fr } from 'date-fns/locale'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

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
  validUntil?: string; deliveryDate?: string
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

interface CalendarEvent {
  date: string
  color: string
}

// ═══════════════════════════════════════════
// Status label helpers
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Formatting helpers
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// Mini Calendar Component
// ═══════════════════════════════════════════

function MiniCalendar({
  events,
  onDayClick,
}: {
  events: CalendarEvent[]
  onDayClick?: (date: Date) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const eventMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      if (!map[e.date].includes(e.color)) map[e.date].push(e.color)
    }
    return map
  }, [events])

  const weekDays = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

  return (
    <div className="w-full overflow-hidden">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-1 pb-2 min-w-0">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold truncate min-w-0">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-muted-foreground uppercase py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const dayEvents = eventMap[key]

          return (
            <button
              key={key}
              onClick={() => onDayClick?.(day)}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors overflow-hidden',
                'hover:bg-muted/60 cursor-pointer',
                !inMonth && 'opacity-30',
                today && 'bg-primary/10 hover:bg-primary/15'
              )}
            >
              <span
                className={cn(
                  'text-xs leading-none',
                  today && 'font-bold text-primary'
                )}
              >
                {getDate(day)}
              </span>
              {dayEvents && dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((color, i) => (
                    <span
                      key={i}
                      className={cn('h-1 w-1 rounded-full shrink-0', color)}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════

function StatCard({ icon, label, value, color, onClick }: {
  icon: React.ReactNode; label: string; value: number; color: string; onClick?: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full relative overflow-hidden rounded-xl p-2 sm:p-3 text-left transition-all cursor-pointer border border-border/50 hover:border-border hover:shadow-sm group',
        'bg-gradient-to-br from-card to-card/80'
      )}
    >
      <div className="flex items-start gap-1.5 sm:gap-2 min-w-0">
        <div className={cn('rounded-lg p-1 sm:p-1.5 shrink-0', color)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className={cn('text-lg sm:text-2xl font-bold tracking-tight leading-none', value > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
            {value}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
        </div>
      </div>
      {value > 0 && (
        <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/5" />
      )}
    </motion.button>
  )
}

// ═══════════════════════════════════════════
// Agenda Item Row
// ═══════════════════════════════════════════

function AgendaRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-colors cursor-pointer min-w-0',
        'hover:bg-muted/50 border border-transparent hover:border-border/50 overflow-hidden'
      )}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-muted-foreground/30 mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ═══════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════

function AgendaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] sm:h-[72px] rounded-xl" />
        ))}
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 sm:h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Tab definitions
// ═══════════════════════════════════════════

const TABS = [
  { value: 'overview', icon: Eye, label: 'Vue d\'ensemble' },
  { value: 'orders', icon: ShoppingCart, label: 'Ventes' },
  { value: 'preparations', icon: ClipboardList, label: 'Préparations' },
  { value: 'invoices', icon: Receipt, label: 'Factures' },
  { value: 'production', icon: Factory, label: 'Production' },
  { value: 'alerts', icon: AlertTriangle, label: 'Alertes' },
  { value: 'calendar', icon: CalendarDays, label: 'Calendrier' },
] as const

// ═══════════════════════════════════════════
// Main Agenda Panel
// ═══════════════════════════════════════════

function AgendaPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { setCurrentView } = useNavStore()
  const [data, setData] = useState<AgendaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

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

  // Build calendar events from agenda data
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!data) return []
    const evts: CalendarEvent[] = []
    for (const inv of [...data.invoices, ...data.upcomingInvoices]) {
      if (inv.dueDate) {
        try {
          evts.push({ date: format(new Date(inv.dueDate), 'yyyy-MM-dd'), color: 'bg-red-500' })
        } catch { /* skip */ }
      }
    }
    for (const d of data.deliveryNotes) {
      if (d.plannedDate) {
        try {
          evts.push({ date: format(new Date(d.plannedDate), 'yyyy-MM-dd'), color: 'bg-teal-500' })
        } catch { /* skip */ }
      }
    }
    for (const w of data.workOrders) {
      if (w.plannedDate) {
        try {
          evts.push({ date: format(new Date(w.plannedDate), 'yyyy-MM-dd'), color: 'bg-green-500' })
        } catch { /* skip */ }
      }
    }
    for (const po of data.purchaseOrders) {
      if (po.expectedDate) {
        try {
          evts.push({ date: format(new Date(po.expectedDate), 'yyyy-MM-dd'), color: 'bg-orange-500' })
        } catch { /* skip */ }
      }
    }
    return evts
  }, [data])

  // Filter upcoming invoices by selected calendar date
  const filteredUpcoming = useMemo(() => {
    if (!data) return []
    let invoices = data.upcomingInvoices
    if (selectedDate) {
      invoices = invoices.filter(inv => {
        if (!inv.dueDate) return false
        try {
          return isSameDay(new Date(inv.dueDate), selectedDate)
        } catch { return false }
      })
    }
    return invoices.filter(i => i.dueDate && differenceInDays(new Date(i.dueDate), new Date()) <= 7)
  }, [data, selectedDate])

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(prev => prev && isSameDay(prev, date) ? null : date)
  }, [])

  const clearDateFilter = useCallback(() => {
    setSelectedDate(null)
  }, [])

  // Day events grouped by type for calendar tab
  const dayEvents = useMemo(() => {
    if (!data || !selectedDate) return null
    const key = format(selectedDate, 'yyyy-MM-dd')
    const groups: { type: string; color: string; icon: React.ReactNode; items: { number: string; name: string; amount?: string }[] }[] = []

    // Invoices
    const invItems = [...data.invoices, ...data.upcomingInvoices].filter(inv => {
      if (!inv.dueDate) return false
      try { return isSameDay(new Date(inv.dueDate), selectedDate) } catch { return false }
    })
    if (invItems.length > 0) {
      groups.push({
        type: 'Factures', color: 'bg-red-500', icon: <Receipt className="h-3 w-3" />,
        items: invItems.map(inv => ({
          number: inv.number,
          name: inv.clientName,
          amount: fmtMoney(inv.totalTTC - inv.amountPaid)
        }))
      })
    }

    // Deliveries
    const delItems = data.deliveryNotes.filter(d => {
      if (!d.plannedDate) return false
      try { return isSameDay(new Date(d.plannedDate), selectedDate) } catch { return false }
    })
    if (delItems.length > 0) {
      groups.push({
        type: 'Livraisons', color: 'bg-teal-500', icon: <Truck className="h-3 w-3" />,
        items: delItems.map(d => ({
          number: d.number,
          name: d.clientName,
          amount: fmtMoney(d.totalTTC)
        }))
      })
    }

    // Work orders
    const woItems = data.workOrders.filter(w => {
      if (!w.plannedDate) return false
      try { return isSameDay(new Date(w.plannedDate), selectedDate) } catch { return false }
    })
    if (woItems.length > 0) {
      groups.push({
        type: 'OF', color: 'bg-green-500', icon: <Factory className="h-3 w-3" />,
        items: woItems.map(w => ({
          number: w.number,
          name: w.productDesignation,
          amount: `Qté: ${w.quantity}`
        }))
      })
    }

    // Purchase orders
    const poItems = data.purchaseOrders.filter(po => {
      if (!po.expectedDate) return false
      try { return isSameDay(new Date(po.expectedDate), selectedDate) } catch { return false }
    })
    if (poItems.length > 0) {
      groups.push({
        type: 'Cmds fourn.', color: 'bg-orange-500', icon: <ArrowDownToLine className="h-3 w-3" />,
        items: poItems.map(po => ({
          number: po.number,
          name: po.supplierName,
          amount: fmtMoney(po.totalTTC)
        }))
      })
    }

    return groups.length > 0 ? groups : null
  }, [data, selectedDate])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] md:w-[460px] p-0 overflow-hidden flex flex-col gap-0"
      >
        {/* ── Header (shrink-0) ── */}
        <div className="shrink-0 border-b border-border/50 bg-gradient-to-b from-card to-card/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 pt-4 pb-1 min-w-0 gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="rounded-xl bg-primary/10 p-1.5 sm:p-2 shrink-0">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <SheetTitle className="text-sm sm:text-base font-semibold truncate block">Mon Agenda</SheetTitle>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {data ? `Mis à jour ${fmtRelative(new Date().toISOString())}` : 'Chargement...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedDate && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 rounded-full cursor-pointer hover:bg-muted"
                  onClick={clearDateFilter}
                >
                  {format(selectedDate, 'dd/MM')} ✕
                </Badge>
              )}
              {totalPending > 0 && (
                <Badge variant="default" className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold">
                  {totalPending} en cours
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={fetchAgenda} disabled={loading}>
                <RefreshCw className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Tabs Container (flex-1, min-h-0, overflow-hidden) ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {loading && !data ? (
            <div className="p-3 sm:p-4">
              <AgendaSkeleton />
            </div>
          ) : data ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* ── Dropdown selector (shrink-0) ── */}
              <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-border/50 bg-muted/30">
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Sélectionner une vue" />
                  </SelectTrigger>
                  <SelectContent>
                    {TABS.map((tab) => (
                      <SelectItem key={tab.value} value={tab.value} className="gap-2">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── ScrollArea (flex-1, min-h-0) ── */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 sm:p-4">
                  {/* ═══ Overview Tab ═══ */}
                  {activeTab === 'overview' && (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Stat Cards Grid: 2 cols mobile, 3 cols sm+ */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      <StatCard
                        icon={<FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500" />}
                        label="Devis actifs"
                        value={data.stats.activeQuotes}
                        color="bg-blue-100 dark:bg-blue-900/30"
                      />
                      <StatCard
                        icon={<ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />}
                        label="Commandes"
                        value={data.stats.pendingOrders}
                        color="bg-emerald-100 dark:bg-emerald-900/30"
                      />
                      <StatCard
                        icon={<ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-500" />}
                        label="Préparations"
                        value={data.stats.pendingPreparations}
                        color="bg-indigo-100 dark:bg-indigo-900/30"
                      />
                      <StatCard
                        icon={<Truck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-teal-500" />}
                        label="Livraisons"
                        value={data.stats.upcomingDeliveries}
                        color="bg-teal-100 dark:bg-teal-900/30"
                      />
                      <StatCard
                        icon={<Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-500" />}
                        label="Factures"
                        value={data.stats.pendingInvoices}
                        color="bg-rose-100 dark:bg-rose-900/30"
                      />
                      <StatCard
                        icon={<AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />}
                        label="En retard"
                        value={data.stats.overdueInvoices}
                        color="bg-red-100 dark:bg-red-900/30"
                      />
                      <StatCard
                        icon={<Factory className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />}
                        label="Ordres fabr."
                        value={data.stats.activeWorkOrders}
                        color="bg-green-100 dark:bg-green-900/30"
                      />
                      <StatCard
                        icon={<ArrowDownToLine className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-500" />}
                        label="Cmds fourn."
                        value={data.stats.pendingPurchaseOrders}
                        color="bg-orange-100 dark:bg-orange-900/30"
                      />
                      <StatCard
                        icon={<Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />}
                        label="Alertes stock"
                        value={data.stats.stockAlerts}
                        color="bg-amber-100 dark:bg-amber-900/30"
                      />
                    </div>

                    {/* Échéances à venir */}
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between px-1 mb-2 min-w-0">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                          {selectedDate ? `Échéances du ${format(selectedDate, 'dd MMM', { locale: fr })}` : 'Échéances à venir'}
                        </h3>
                        {selectedDate && (
                          <button
                            onClick={clearDateFilter}
                            className="text-[10px] text-primary hover:underline shrink-0 ml-2"
                          >
                            Voir tout
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1">
                        {filteredUpcoming.length > 0 ? (
                          filteredUpcoming.slice(0, 5).map(invoice => (
                            <AgendaRow key={invoice.id} onClick={() => navigateTo('invoices')}>
                              <div className={cn(
                                'rounded-lg p-1 sm:p-1.5 shrink-0',
                                isPast(new Date(invoice.dueDate)) && invoice.status !== 'paid'
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : isToday(new Date(invoice.dueDate))
                                    ? 'bg-orange-100 dark:bg-orange-900/30'
                                    : 'bg-muted'
                              )}>
                                <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                  <span className="text-xs sm:text-sm font-medium truncate">{invoice.number}</span>
                                  <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{invoice.clientName}</span>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                  <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(invoice.totalTTC - invoice.amountPaid)}</span>
                                  <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(invoice.dueDate))}>
                                    {getDueDateLabel(invoice.dueDate)}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            </AgendaRow>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/20 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">
                              {selectedDate ? 'Aucune échéance ce jour' : 'Aucune échéance imminente'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activité récente */}
                    <div className="min-w-0 overflow-hidden">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                        Activité récente
                      </h3>
                      <div className="space-y-0.5 sm:space-y-1">
                        {data.preparations.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('preparations')}>
                            <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-1 sm:p-1.5 shrink-0">
                              <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs sm:text-sm font-medium truncate">{data.preparations[0].number}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">
                                {data.preparations[0].clientName} — {data.preparations[0].orderNumber}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', prepStatusLabels[data.preparations[0].status]?.color)}>
                              {prepStatusLabels[data.preparations[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.orders.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('sales-orders')}>
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-1 sm:p-1.5 shrink-0">
                              <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs sm:text-sm font-medium truncate">{data.orders[0].number}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">
                                {data.orders[0].clientName} — {fmtMoney(data.orders[0].totalTTC)}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', orderStatusLabels[data.orders[0].status]?.color)}>
                              {orderStatusLabels[data.orders[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.workOrders.length > 0 && (
                          <AgendaRow onClick={() => navigateTo('work-orders')}>
                            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-1 sm:p-1.5 shrink-0">
                              <Factory className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs sm:text-sm font-medium truncate">{data.workOrders[0].number}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">
                                {data.workOrders[0].productDesignation} — Qté: {data.workOrders[0].quantity}
                              </p>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', workOrderStatusLabels[data.workOrders[0].status]?.color)}>
                              {workOrderStatusLabels[data.workOrders[0].status]?.label}
                            </Badge>
                          </AgendaRow>
                        )}
                        {data.preparations.length === 0 && data.orders.length === 0 && data.workOrders.length === 0 && (
                          <div className="text-center py-4">
                            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/20 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">Aucune activité récente</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* ═══ Ventes Tab ═══ */}
                  {activeTab === 'orders' && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                      Devis & Commandes
                    </h3>
                    {data.quotes.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-2">Devis</p>
                        {data.quotes.map(q => (
                          <AgendaRow key={q.id} onClick={() => navigateTo('quotes')}>
                            <div className="rounded-lg bg-sky-100 dark:bg-sky-900/30 p-1 sm:p-1.5 shrink-0">
                              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-sky-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-medium truncate">{q.number}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{q.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(q.totalTTC)}</span>
                                {q.validUntil && (
                                  <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(q.validUntil))}>
                                    Expire {getDueDateLabel(q.validUntil)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', quoteStatusLabels[q.status]?.color)}>
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
                            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-1 sm:p-1.5 shrink-0">
                              <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-medium truncate">{o.number}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{o.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(o.totalTTC)}</span>
                                {o.deliveryDate && <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:inline">Liv. {fmtDate(o.deliveryDate)}</span>}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', orderStatusLabels[o.status]?.color)}>
                              {orderStatusLabels[o.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                    {data.quotes.length === 0 && data.orders.length === 0 && (
                      <EmptyState icon={<ShoppingCart className="h-8 w-8" />} message="Aucun devis ou commande en cours" />
                    )}
                  </div>
                  )}

                  {/* ═══ Préparations Tab ═══ */}
                  {activeTab === 'preparations' && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                      Préparations en cours
                    </h3>
                    {data.preparations.length > 0 ? (
                      data.preparations.map(p => (
                        <AgendaRow key={p.id} onClick={() => navigateTo('preparations')}>
                          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-1 sm:p-1.5 shrink-0">
                            <ClipboardList className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-medium truncate">{p.number}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{p.clientName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Cmd: {p.orderNumber}</span>
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:inline">{fmtRelative(p.createdAt)}</span>
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', prepStatusLabels[p.status]?.color)}>
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
                            <div className="rounded-lg bg-teal-100 dark:bg-teal-900/30 p-1 sm:p-1.5 shrink-0">
                              <Truck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-teal-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-medium truncate">{d.number}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{d.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(d.totalTTC)}</span>
                                {d.plannedDate && (
                                  <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(d.plannedDate))}>
                                    {getDueDateLabel(d.plannedDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', deliveryStatusLabels[d.status]?.color)}>
                              {deliveryStatusLabels[d.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                  </div>
                  )}

                  {/* ═══ Factures Tab ═══ */}
                  {activeTab === 'invoices' && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                      Factures
                    </h3>
                    {data.invoices.length > 0 ? (
                      data.invoices.map(inv => (
                        <AgendaRow key={inv.id} onClick={() => navigateTo('invoices')}>
                          <div className={cn(
                            'rounded-lg p-1 sm:p-1.5 shrink-0',
                            inv.status === 'overdue'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : inv.status === 'paid'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-rose-100 dark:bg-rose-900/30'
                          )}>
                            <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-medium truncate">{inv.number}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{inv.clientName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                              <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(inv.totalTTC)}</span>
                              {inv.amountPaid > 0 && (
                                <span className="text-[10px] sm:text-[11px] text-green-600 dark:text-green-400 truncate hidden sm:inline">
                                  Payé {fmtMoney(inv.amountPaid)}
                                </span>
                              )}
                              <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(inv.dueDate))}>
                                {getDueDateLabel(inv.dueDate)}
                              </span>
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', invoiceStatusLabels[inv.status]?.color)}>
                            {invoiceStatusLabels[inv.status]?.label}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Receipt className="h-8 w-8" />} message="Aucune facture en cours" />
                    )}
                  </div>
                  )}

                  {/* ═══ Production Tab ═══ */}
                  {activeTab === 'production' && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                      Ordres de fabrication
                    </h3>
                    {data.workOrders.length > 0 ? (
                      data.workOrders.map(w => (
                        <AgendaRow key={w.id} onClick={() => navigateTo('work-orders')}>
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-1 sm:p-1.5 shrink-0">
                            <Factory className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-medium truncate">{w.number}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{w.productRef}</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{w.productDesignation}</span>
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">Qté: {w.quantity}</span>
                              {w.plannedDate && (
                                <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(w.plannedDate))}>
                                  {getDueDateLabel(w.plannedDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', workOrderStatusLabels[w.status]?.color)}>
                            {workOrderStatusLabels[w.status]?.label}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Factory className="h-8 w-8" />} message="Aucun ordre de fabrication en cours" />
                    )}

                    {/* Purchase Orders */}
                    {data.purchaseOrders.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-3">Commandes fournisseurs</p>
                        {data.purchaseOrders.map(po => (
                          <AgendaRow key={po.id}>
                            <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-1 sm:p-1.5 shrink-0">
                              <ArrowDownToLine className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-medium truncate">{po.number}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{po.supplierName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                <span className="text-[10px] sm:text-xs font-mono truncate">{fmtMoney(po.totalTTC)}</span>
                                <span className={cn('text-[10px] sm:text-[11px] truncate', getDueDateStyle(po.expectedDate))}>
                                  {getDueDateLabel(po.expectedDate)}
                                </span>
                              </div>
                            </div>
                            <Badge className={cn('text-[10px] px-1 sm:px-1.5 py-0 shrink-0', poStatusLabels[po.status]?.color)}>
                              {poStatusLabels[po.status]?.label}
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                  </div>
                  )}

                  {/* ═══ Alertes Tab ═══ */}
                  {activeTab === 'alerts' && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 truncate">
                      Alertes stock
                    </h3>
                    {data.stockAlerts.length > 0 ? (
                      data.stockAlerts.map(s => (
                        <AgendaRow key={s.id}>
                          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-1 sm:p-1.5 shrink-0">
                            <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm font-medium truncate">{s.reference}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{s.designation}</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                              <span className={cn('text-[10px] sm:text-xs font-mono truncate', s.currentStock <= 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-amber-600 dark:text-amber-400')}>
                                Stock: {s.currentStock}
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                                Min: {s.minStock}
                              </span>
                            </div>
                          </div>
                          <Badge className="text-[10px] px-1 sm:px-1.5 py-0 shrink-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {s.currentStock <= 0 ? 'Rupture' : 'Bas'}
                          </Badge>
                        </AgendaRow>
                      ))
                    ) : (
                      <EmptyState icon={<Package className="h-8 w-8" />} message="Aucune alerte stock" />
                    )}

                    {/* Overdue Invoices */}
                    {data.invoices.filter(i => i.status === 'overdue').length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 pt-3">Factures en retard</p>
                        {data.invoices.filter(i => i.status === 'overdue').map(inv => (
                          <AgendaRow key={inv.id} onClick={() => navigateTo('invoices')}>
                            <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-1 sm:p-1.5 shrink-0">
                              <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-medium truncate">{inv.number}</span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:inline">{inv.clientName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                                <span className="text-[10px] sm:text-xs font-mono truncate text-red-600 dark:text-red-400 font-semibold">
                                  {fmtMoney(inv.totalTTC - inv.amountPaid)}
                                </span>
                                <span className="text-[10px] sm:text-[11px] text-red-600 dark:text-red-400 truncate">
                                  {getDueDateLabel(inv.dueDate)}
                                </span>
                              </div>
                            </div>
                            <Badge className="text-[10px] px-1 sm:px-1.5 py-0 shrink-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                              Retard
                            </Badge>
                          </AgendaRow>
                        ))}
                      </>
                    )}
                  </div>
                  )}

                  {/* ═══ Calendrier Tab ═══ */}
                  {activeTab === 'calendar' && (
                  <div className="space-y-3">
                    <MiniCalendar events={calendarEvents} onDayClick={handleDayClick} />

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
                      {[
                        { color: 'bg-red-500', label: 'Factures' },
                        { color: 'bg-teal-500', label: 'Livraisons' },
                        { color: 'bg-green-500', label: 'OF' },
                        { color: 'bg-orange-500', label: 'Cmds fourn.' },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', l.color)} />
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground">{l.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Selected day events */}
                    {selectedDate && (
                      <div className="border-t border-border/50 pt-3 space-y-2">
                        <div className="flex items-center justify-between min-w-0">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: fr })}
                          </h4>
                          <button
                            onClick={clearDateFilter}
                            className="text-[10px] text-primary hover:underline shrink-0 ml-2"
                          >
                            Effacer
                          </button>
                        </div>
                        {dayEvents && dayEvents.length > 0 ? (
                          dayEvents.map(group => (
                            <div key={group.type} className="space-y-1">
                              <div className="flex items-center gap-1.5 px-1">
                                <span className={cn('h-2 w-2 rounded-full shrink-0', group.color)} />
                                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  {group.type}
                                </span>
                              </div>
                              {group.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 overflow-hidden"
                                >
                                  <span className="text-xs font-medium truncate min-w-0">{item.number}</span>
                                  <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate min-w-0 flex-1">{item.name}</span>
                                  {item.amount && (
                                    <span className="text-[10px] sm:text-[11px] font-mono shrink-0 text-muted-foreground">{item.amount}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <CalendarDays className="h-5 w-5 text-muted-foreground/20 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">Aucun événement ce jour</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ═══════════════════════════════════════════
// Exported AgendaButton
// ═══════════════════════════════════════════

export function AgendaButton() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<AgendaData | null>(null)

  const fetchBadgeCount = useCallback(async () => {
    try {
      const res = await api.get<AgendaData>('/agenda?days=30')
      setData(res)
    } catch {
      // Silently fail — badge just won't show
    }
  }, [])

  useEffect(() => {
    // Refresh every 2 minutes; initial fetch via setTimeout (async) to avoid lint rule
    const timer = setTimeout(fetchBadgeCount, 0)
    const interval = setInterval(fetchBadgeCount, 120000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [fetchBadgeCount])

  const badgeCount = data
    ? data.stats.pendingOrders + data.stats.pendingPreparations +
      data.stats.overdueInvoices + data.stats.stockAlerts +
      data.stats.activeWorkOrders
    : 0

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'agenda"
      >
        <CalendarDays className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Button>
      <AgendaPanel open={open} onOpenChange={setOpen} />
    </>
  )
}

export { AgendaPanel }
export default AgendaPanel
