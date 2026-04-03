'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertTriangle, PackageX, ArrowDownRight, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'

interface ProductAlert {
  id: string
  reference: string
  designation: string
  currentStock: number
  minStock: number
  maxStock: number
  unit: string
  productType: string
}

const productTypeLabels: Record<string, string> = {
  raw_material: 'Matière première',
  semi_finished: 'Semi-fini',
  finished: 'Produit fini',
}

export default function StockAlertsView() {
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [outOfStock, setOutOfStock] = useState(0)
  const [belowMinStock, setBelowMinStock] = useState(0)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all')

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ alerts: ProductAlert[]; total: number; outOfStock: number; belowMinStock: number }>(
        '/stock?view=alerts'
      )
      setAlerts(data.alerts || [])
      setOutOfStock(data.outOfStock)
      setBelowMinStock(data.belowMinStock)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des alertes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const filteredAlerts = useMemo(() => {
    let result = alerts
    if (severityFilter === 'critical') {
      result = result.filter((a) => a.currentStock <= 0)
    } else if (severityFilter === 'warning') {
      result = result.filter((a) => a.currentStock > 0 && a.currentStock <= a.minStock)
    }
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (a) => a.reference.toLowerCase().includes(s) || a.designation.toLowerCase().includes(s)
      )
    }
    return result
  }, [alerts, severityFilter, search])

  const criticalAlerts = alerts.filter((a) => a.currentStock <= 0)
  const warningAlerts = alerts.filter((a) => a.currentStock > 0 && a.currentStock <= a.minStock)

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Alertes de stock</h2>
          <Badge variant="secondary">{alerts.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <PackageX className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{outOfStock}</p>
              <p className="text-sm text-red-600/80">Rupture de stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <ArrowDownRight className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{belowMinStock}</p>
              <p className="text-sm text-orange-600/80">En dessous du min.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{alerts.length}</p>
              <p className="text-sm text-muted-foreground">Total alertes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence ou désignation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'critical', 'warning'] as const).map((sev) => (
            <Button
              key={sev}
              variant={severityFilter === sev ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSeverityFilter(sev)}
            >
              {sev === 'all' ? 'Toutes' : sev === 'critical' ? 'Ruptures' : 'Warnings'}
            </Button>
          ))}
        </div>
      </div>

      {/* Alert Cards */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>{alerts.length === 0 ? 'Aucune alerte de stock.' : 'Aucune alerte correspondant aux filtres.'}</p>
            <p className="text-sm">Tous les produits sont à un niveau de stock acceptable.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAlerts.map((alert) => {
            const isCritical = alert.currentStock <= 0
            const isWarning = !isCritical && alert.currentStock <= alert.minStock
            const stockPercent = alert.maxStock > 0
              ? Math.round((alert.currentStock / alert.maxStock) * 100)
              : 0
            const minPercent = alert.maxStock > 0
              ? Math.round((alert.minStock / alert.maxStock) * 100)
              : 0

            return (
              <Card
                key={alert.id}
                className={`border-l-4 ${
                  isCritical
                    ? 'border-l-red-500 bg-red-50/30'
                    : isWarning
                    ? 'border-l-orange-500 bg-orange-50/30'
                    : 'border-l-yellow-500'
                }`}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={
                        isCritical
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : 'bg-orange-100 text-orange-800 border-orange-200'
                      }
                    >
                      {isCritical ? 'Rupture' : 'Bas'}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{alert.reference}</span>
                  </div>
                  <CardTitle className="text-sm font-medium mt-1">{alert.designation}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-3">
                    {/* Stock bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Stock actuel</span>
                        <span className={`font-mono font-bold ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                          {alert.currentStock.toLocaleString('fr-FR')} {alert.unit}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isCritical
                              ? 'bg-red-500'
                              : isWarning
                              ? 'bg-orange-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min(stockPercent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                        <span>Min: {alert.minStock.toLocaleString('fr-FR')}</span>
                        <span>Max: {alert.maxStock.toLocaleString('fr-FR')}</span>
                      </div>
                      {/* Min stock indicator line */}
                      <div className="relative w-full h-0">
                        <div
                          className="absolute -top-1 w-0.5 h-4 bg-slate-400"
                          style={{ left: `${Math.min(minPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {productTypeLabels[alert.productType] || alert.productType}
                      </span>
                      {isCritical ? (
                        <span className="text-xs font-medium text-red-600">
                          Manque {-alert.currentStock.toLocaleString('fr-FR')} unités
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-orange-600">
                          {(alert.minStock - alert.currentStock).toLocaleString('fr-FR')} en dessous du min
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
