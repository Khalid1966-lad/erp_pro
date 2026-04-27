'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Percent,
  Banknote,
  AlertTriangle,
  Clock,
  FileText,
  ShoppingCart,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
  Factory,
  Wallet,
  Landmark,
  AlertCircle,
  Activity,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  revenueByMonth: { month: string; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  grossMargin: number
  marginRate: number
  ordersByStatus: {
    pending: number
    confirmed: number
    in_preparation: number
    delivered: number
    cancelled: number
  }
  quotesByStatus: {
    draft: number
    sent: number
    accepted: number
    rejected: number
    expired: number
  }
  lowStockProducts: {
    id: string
    reference: string
    designation: string
    currentStock: number
    minStock: number
  }[]
  workOrdersByStatus: {
    draft: number
    planned: number
    in_progress: number
    completed: number
    closed: number
  }
  overdueInvoices: number
  totalStockValue: number
  cashBalance: number
  bankBalance: number
  recentActivity: {
    id: string
    action: string
    entity: string
    createdAt: string
    user?: { name: string }
  }[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  orange: '#f97316',
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  purple: '#a855f7',
  yellow: '#eab308',
} as const

const ORDER_STATUS_COLORS = [
  CHART_COLORS.yellow,   // pending
  CHART_COLORS.blue,     // confirmed
  CHART_COLORS.orange,   // in_preparation
  CHART_COLORS.green,    // delivered
  CHART_COLORS.red,      // cancelled
] as const

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  in_preparation: 'En préparation',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

const QUOTE_STATUS_COLORS = [
  CHART_COLORS.blue,     // draft
  CHART_COLORS.orange,   // sent
  CHART_COLORS.green,    // accepted
  CHART_COLORS.red,      // rejected
  CHART_COLORS.purple,   // expired
] as const

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  expired: 'Expirée',
}

const WORK_ORDER_COLORS: Record<string, string> = {
  draft: CHART_COLORS.blue,
  planned: CHART_COLORS.purple,
  in_progress: CHART_COLORS.orange,
  completed: CHART_COLORS.green,
  closed: CHART_COLORS.red,
}

const WORK_ORDER_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  closed: 'Fermée',
}

// ── Animated Counter Hook ────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration: number = 1200, enabled: boolean = true) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let start = 0
    const startTime = performance.now()

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (target - start) * eased)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [target, duration, enabled])

  return display
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR')
}

function formatPercent(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + ' %'
}

// ── Skeleton Loaders ─────────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-36 mb-1" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Custom Recharts Tooltip ──────────────────────────────────────────────────

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 text-sm font-medium text-foreground">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm text-muted-foreground">
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ── Pie Chart Legend ─────────────────────────────────────────────────────────

interface PieLegendProps {
  payload?: { value: string; color: string }[]
}

function PieLegendCustom({ payload }: PieLegendProps) {
  if (!payload) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stagger wrapper ─────────────────────────────────────────────────────────

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
}

// ── KPI Card Component ──────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string
  rawValue: number
  subtitle?: React.ReactNode
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  isPercent?: boolean
}

function KpiCard({ title, value, rawValue, subtitle, icon, iconBg, iconColor, isPercent = false }: KpiCardProps) {
  const animatedValue = useAnimatedNumber(
    isPercent ? Math.round(rawValue * 10) : rawValue,
    1000
  )

  return (
    <motion.div variants={staggerItem}>
      <Card className="kpi-card cursor-default">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {title}
          </CardDescription>
          <div className={`rounded-lg ${iconBg} p-2`}>
            <span className={iconColor}>{icon}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="kpi-value text-2xl font-bold tracking-tight">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.get<DashboardData>('/dashboard')
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Erreur de chargement</h2>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchDashboard}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Réessayer
        </button>
      </div>
    )
  }

  // ── Compute order totals ─────────────────────────────────────────────────

  const totalOrders = data
    ? Object.values(data.ordersByStatus).reduce((a, b) => a + b, 0)
    : 0

  const totalQuotes = data
    ? Object.values(data.quotesByStatus).reduce((a, b) => a + b, 0)
    : 0

  const totalWorkOrders = data
    ? Object.values(data.workOrdersByStatus).reduce((a, b) => a + b, 0)
    : 0

  // ── Transform pie data ──────────────────────────────────────────────────

  const ordersPieData = data
    ? Object.entries(data.ordersByStatus)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({
          name: ORDER_STATUS_LABELS[key] || key,
          value,
        }))
    : []

  const quotesPieData = data
    ? Object.entries(data.quotesByStatus)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({
          name: QUOTE_STATUS_LABELS[key] || key,
          value,
        }))
    : []

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Page header */}
      <motion.div variants={staggerItem}>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre activité
        </p>
      </motion.div>

      {/* ── Row 1: KPI Cards ──────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            {/* CA Total */}
            <KpiCard
              title="CA Total"
              value={formatCurrency(data!.totalRevenue)}
              rawValue={data!.totalRevenue}
              icon={<TrendingUp className="h-4 w-4" />}
              iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              iconColor="text-emerald-600 dark:text-emerald-400"
              subtitle={`Charges : ${formatCurrency(data!.totalExpenses)}`}
            />

            {/* Marge brute */}
            <KpiCard
              title="Marge brute"
              value={formatCurrency(data!.grossMargin)}
              rawValue={data!.grossMargin}
              icon={<DollarSign className="h-4 w-4" />}
              iconBg="bg-sky-50 dark:bg-sky-950/40"
              iconColor="text-sky-600 dark:text-sky-400"
              subtitle={
                data!.marginRate >= 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    Bonne rentabilité
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <ArrowDownRight className="h-3 w-3" />
                    Attention
                  </span>
                )
              }
            />

            {/* Taux de marge */}
            <KpiCard
              title="Taux de marge"
              value={formatPercent(data!.marginRate)}
              rawValue={data!.marginRate}
              icon={<Percent className="h-4 w-4" />}
              iconBg="bg-violet-50 dark:bg-violet-950/40"
              iconColor="text-violet-600 dark:text-violet-400"
              isPercent
              subtitle={`Sur CA de ${formatCurrency(data!.totalRevenue)}`}
            />

            {/* Valeur stock */}
            <KpiCard
              title="Valeur stock"
              value={formatCurrency(data!.totalStockValue)}
              rawValue={data!.totalStockValue}
              icon={<Package className="h-4 w-4" />}
              iconBg="bg-amber-50 dark:bg-amber-950/40"
              iconColor="text-amber-600 dark:text-amber-400"
              subtitle={
                data!.lowStockProducts.length > 0 && (
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3 w-3" />
                    {data!.lowStockProducts.length} produit
                    {data!.lowStockProducts.length > 1 ? 's' : ''} en alerte
                  </span>
                )
              }
            />
          </>
        )}
      </motion.div>

      {/* ── Row 2: Revenue Chart + Financial Summary ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue Area Chart */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card className="chart-card">
              <CardHeader>
                <CardTitle>Chiffre d&apos;affaires mensuel</CardTitle>
                <CardDescription>
                  Évolution du CA par mois sur l&apos;année
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data!.revenueByMonth}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) =>
                          `${(v / 1000).toLocaleString('fr-FR')}k`
                        }
                        tickLine={false}
                        axisLine={false}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={CHART_COLORS.blue}
                        strokeWidth={2.5}
                        fill="url(#caGradient)"
                        name="CA"
                        dot={{ fill: CHART_COLORS.blue, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Financial Summary */}
        <motion.div
          variants={staggerContainer}
          className="space-y-4"
        >
          {loading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : (
            <>
              {/* Cash Balance */}
              <motion.div variants={staggerItem}>
                <Card className="kpi-card cursor-default">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5" />
                      Solde caisse
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="kpi-value text-xl font-bold">
                      {formatCurrency(data!.cashBalance)}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Bank Balance */}
              <motion.div variants={staggerItem}>
                <Card className="kpi-card cursor-default">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                      <Landmark className="h-3.5 w-3.5" />
                      Solde bancaire
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="kpi-value text-xl font-bold">
                      {formatCurrency(data!.bankBalance)}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Overdue Invoices Alert */}
              <motion.div variants={staggerItem}>
                <Card
                  className={`kpi-card cursor-default ${
                    data!.overdueInvoices > 0
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-950/20'
                      : ''
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                      <AlertCircle
                        className={
                          data!.overdueInvoices > 0
                            ? 'h-3.5 w-3.5 text-red-600 dark:text-red-400'
                            : 'h-3.5 w-3.5'
                        }
                      />
                      Factures impayées
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="kpi-value text-xl font-bold">
                        {data!.overdueInvoices}
                      </span>
                      {data!.overdueInvoices > 0 && (
                        <Badge variant="destructive" className="badge-pulse">En retard</Badge>
                      )}
                      {data!.overdueInvoices === 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          À jour
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Row 3: Orders Pipeline + Quotes Pipeline ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Orders Pie Chart */}
        <motion.div variants={staggerItem}>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card className="chart-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Commandes ({totalOrders})
                </CardTitle>
                <CardDescription>
                  Répartition des commandes par statut
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordersPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {ordersPieData.map((_, idx) => (
                          <Cell
                            key={`order-${idx}`}
                            fill={ORDER_STATUS_COLORS[idx % ORDER_STATUS_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} commande${value > 1 ? 's' : ''}`,
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: '12px',
                        }}
                      />
                      <Legend content={<PieLegendCustom />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Quotes Pie Chart */}
        <motion.div variants={staggerItem}>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card className="chart-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Devis ({totalQuotes})
                </CardTitle>
                <CardDescription>
                  Répartition des devis par statut
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={quotesPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {quotesPieData.map((_, idx) => (
                          <Cell
                            key={`quote-${idx}`}
                            fill={QUOTE_STATUS_COLORS[idx % QUOTE_STATUS_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} devis`,
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: '12px',
                        }}
                      />
                      <Legend content={<PieLegendCustom />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* ── Row 4: Work Orders Status ──────────────────────────────────── */}
      <motion.div variants={staggerItem}>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <Card className="chart-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Ordres de travail ({totalWorkOrders})
              </CardTitle>
              <CardDescription>
                Répartition par statut
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(data!.workOrdersByStatus).map(([key, count]) => {
                  const pct =
                    totalWorkOrders > 0
                      ? Math.round((count / totalWorkOrders) * 100)
                      : 0
                  return (
                    <div
                      key={key}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {WORK_ORDER_LABELS[key]}
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: WORK_ORDER_COLORS[key] }}
                        >
                          {count}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2"
                        style={
                          {
                            '--progress-color': WORK_ORDER_COLORS[key],
                          } as React.CSSProperties
                        }
                      />
                      <p className="text-[10px] text-right text-muted-foreground">
                        {pct}%
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* ── Row 5: Low Stock + Recent Activity ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <motion.div variants={staggerItem}>
          {loading ? (
            <TableSkeleton />
          ) : (
            <Card className="h-full overflow-hidden chart-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Alertes stock
                  {data!.lowStockProducts.length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {data!.lowStockProducts.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Produits sous le seuil minimum de stock
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {data!.lowStockProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="mb-2 h-8 w-8" />
                    <p className="text-sm">Aucune alerte de stock</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto scrollbar-visible max-h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Réf.</TableHead>
                          <TableHead>Désignation</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Min</TableHead>
                          <TableHead className="text-right">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.lowStockProducts.map((product) => {
                          const ratio =
                            product.minStock > 0
                              ? product.currentStock / product.minStock
                              : 0
                          const isCritical = ratio <= 0.25
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-mono text-xs">
                                {product.reference}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate text-sm">
                                {product.designation}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatNumber(product.currentStock)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatNumber(product.minStock)}
                              </TableCell>
                              <TableCell className="text-right">
                                {isCritical ? (
                                  <Badge
                                    variant="destructive"
                                    className="gap-1 text-[10px]"
                                  >
                                    <AlertCircle className="h-3 w-3" />
                                    Critique
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 text-[10px]"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    Bas
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={staggerItem}>
          {loading ? (
            <TableSkeleton />
          ) : (
            <Card className="h-full overflow-hidden chart-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activité récente
                </CardTitle>
                <CardDescription>
                  Dernières actions effectuées
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-hidden">
                {data!.recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="mb-2 h-8 w-8" />
                    <p className="text-sm">Aucune activité récente</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto scrollbar-visible max-h-[360px]">
                    <div className="space-y-1">
                      {data!.recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted/50 transition-colors table-row-hover"
                        >
                          <div className="mt-0.5 rounded-full bg-muted p-1.5">
                            <CircleDot className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-tight break-words">
                              <span className="font-medium">
                                {activity.user?.name || 'Système'}
                              </span>
                              {` `}
                              <span className="text-muted-foreground">
                                {activity.action.toLowerCase()}
                              </span>
                              {` `}
                              <Badge
                                variant="secondary"
                                className="mx-1 text-[10px] px-1.5 py-0 max-w-[140px] truncate align-middle"
                              >
                                {activity.entity}
                              </Badge>
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.createdAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
