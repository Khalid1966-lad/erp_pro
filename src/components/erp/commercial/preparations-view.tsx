'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  ClipboardList, MoreVertical, Play, CheckCircle, XCircle, Eye, Trash2, Package,
  Plus, RefreshCw, AlertTriangle, ShoppingCart, Factory, Loader2, ChevronRight, FileText, Search, Printer, Truck, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { HelpButton } from '@/components/erp/shared/help-button'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

interface ProductInfo {
  id: string
  reference: string
  designation: string
  currentStock: number
  productNature: string
  unit: string
}
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

interface PrepLine {
  id: string
  preparationOrderId: string
  salesOrderLineId: string
  productId: string
  product: ProductInfo
  quantityRequested: number
  quantityPrepared: number
  stockAvailable: number
  deficit: number
  hasDeficit: boolean
  suggestion: { action: string; target: string } | null
  notes: string | null
}

interface SalesOrderLineInfo {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  quantityPrepared: number
  quantityDelivered: number
  product?: ProductInfo
}

interface Preparation {
  id: string
  number: string
  status: string
  completedAt: string | null
  notes: string | null
  createdAt: string
  totalLines: number
  preparedLines: number
  fullyPreparedLines: number
  progressPercent: number
  lines: PrepLine[]
  salesOrder: {
    id: string
    number: string
    status: string
    client: { id: string; name: string }
    lines: SalesOrderLineInfo[]
  }
}

interface SalesOrderOption {
  id: string
  number: string
  status: string
  client: { id: string; name: string }
  lines: Array<{
    id: string
    productId: string
    quantity: number
    quantityPrepared: number
    product: ProductInfo
  }>
}

interface StockCheckResult {
  preparationId: string
  preparationNumber: string
  status: string
  totalLines: number
  deficitLines: number
  lines: Array<{
    id: string
    productId: string
    productReference: string
    productDesignation: string
    productNature: string
    productNatureLabel: string
    unit: string
    stockAvailable: number
    stockAvailableAtCreation: number
    quantityRequested: number
    quantityPrepared: number
    deficit: number
    hasDeficit: boolean
    suggestion: { action: string; target: string } | null
  }>
}

// ═══════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

const productNatureLabels: Record<string, string> = {
  matiere_premiere: 'Matière première',
  semi_fini: 'Semi-fini',
  produit_fini: 'Produit fini',
}

const productNatureColors: Record<string, string> = {
  matiere_premiere: 'bg-amber-100 text-amber-800',
  semi_fini: 'bg-purple-100 text-purple-800',
  produit_fini: 'bg-emerald-100 text-emerald-800',
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    pending: { icon: <Clock className="h-4 w-4" />, color: 'text-yellow-500' },
    in_progress: { icon: <Play className="h-4 w-4" />, color: 'text-blue-500' },
    completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
    cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
  }
  const c = config[status]
  if (!c) return null
  return <span className={c.color}>{c.icon}</span>
}

function IconLegend({ items }: { items: Array<{ icon: React.ReactNode; label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={item.color}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

const preparationLegendItems = [
  { icon: <Clock className="h-3.5 w-3.5" />, label: 'En attente', color: 'text-yellow-500' },
  { icon: <Play className="h-3.5 w-3.5" />, label: 'En cours', color: 'text-blue-500' },
  { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Terminée', color: 'text-green-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulée', color: 'text-red-500' },
]

// ═══════════════════════════════════════════════════════
// Progress Badge Component
// ═══════════════════════════════════════════════════════

function ProgressBadge({ percent }: { percent: number }) {
  const color =
    percent >= 100
      ? 'text-green-700 bg-green-50'
      : percent > 0
        ? 'text-amber-700 bg-amber-50'
        : 'text-gray-500 bg-gray-50'
  return (
    <Badge variant="outline" className={`font-mono text-xs ${color}`}>
      {percent}%
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════

export default function PreparationsView() {
  // ── State ──
  const isSuperAdmin = useIsSuperAdmin()
  const [preparations, setPreparations] = useState<Preparation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [salesOrders, setSalesOrders] = useState<SalesOrderOption[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [createPreview, setCreatePreview] = useState<SalesOrderOption | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPrep, setSelectedPrep] = useState<Preparation | null>(null)
  const [stockCheckData, setStockCheckData] = useState<StockCheckResult | null>(null)
  const [loadingStockCheck, setLoadingStockCheck] = useState(false)

  // Inline expansion
  const [expandedPrepId, setExpandedPrepId] = useState<string | null>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Fetch preparations ──
  const fetchPreparations = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ preparations: Preparation[]; total: number }>(
        `/preparations?${params.toString()}`,
      )
      setPreparations(data.preparations)
      setExpandedPrepId(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur chargement préparations'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchPreparations()
  }, [fetchPreparations])

  // ── Fetch sales orders for create dialog ──
  const fetchSalesOrders = useCallback(async () => {
    try {
      const data = await api.get<{ salesOrders: SalesOrderOption[] }>(
        '/sales-orders?status=confirmed&status=in_preparation&limit=100',
      )
      // Filter to get only confirmed and in_preparation
      const filtered = data.salesOrders.filter(
        (so) => so.status === 'confirmed' || so.status === 'in_preparation',
      )
      setSalesOrders(filtered)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur chargement commandes'
      toast.error(message)
    }
  }, [])

  // ── Open create dialog ──
  const openCreate = async () => {
    setSelectedOrderId('')
    setCreatePreview(null)
    setCreateNotes('')
    setCreateOpen(true)
    await fetchSalesOrders()
  }

  // ── Select order for create preview ──
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    const order = salesOrders.find((so) => so.id === orderId)
    setCreatePreview(order || null)
  }

  // ── Create preparation ──
  const handleCreate = async () => {
    if (!selectedOrderId) {
      toast.error('Veuillez sélectionner une commande')
      return
    }
    try {
      setCreating(true)
      const result = await api.post<Preparation>('/preparations', {
        salesOrderId: selectedOrderId,
        notes: createNotes || undefined,
      })
      toast.success(`Préparation ${result.number} créée avec succès`)
      setCreateOpen(false)
      fetchPreparations()
      // Open detail of created prep
      setSelectedPrep(result as unknown as Preparation)
      setDetailOpen(true)
      fetchStockCheck(result.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur création'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  // ── Fetch stock check for a preparation ──
  const fetchStockCheck = async (prepId: string) => {
    try {
      setLoadingStockCheck(true)
      const data = await api.get<StockCheckResult>(`/preparations?id=${prepId}&stockCheck=true`)
      setStockCheckData(data)
    } catch (err: unknown) {
      console.error('Stock check error:', err)
    } finally {
      setLoadingStockCheck(false)
    }
  }

  // ── Open detail dialog ──
  const openDetail = (prep: Preparation) => {
    setSelectedPrep(prep)
    setDetailOpen(true)
    fetchStockCheck(prep.id)
  }

  // ── Start preparation ──
  const handleStart = async (id: string) => {
    try {
      await api.put('/preparations', { id, action: 'start' })
      toast.success('Préparation démarrée')
      fetchPreparations()
      if (selectedPrep?.id === id) {
        setSelectedPrep((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    }
  }

  // ── Cancel preparation ──
  const handleCancel = async (id: string) => {
    try {
      await api.put('/preparations', { id, action: 'cancel' })
      toast.success('Préparation annulée')
      setDetailOpen(false)
      setSelectedPrep(null)
      fetchPreparations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur annulation'
      toast.error(message)
    }
  }

  // ── Delete preparation ──
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/preparations?id=${deleteId}`)
      toast.success('Préparation supprimée')
      setDeleteId(null)
      fetchPreparations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur suppression'
      toast.error(message)
    }
  }

  // ── Update line quantity ──
  const handleUpdateLine = async (lineId: string, quantityPrepared: number) => {
    if (!selectedPrep) return
    try {
      await api.put('/preparations', {
        id: selectedPrep.id,
        action: 'updateLine',
        lineId,
        quantityPrepared,
      })
      // Update local state
      setSelectedPrep((prev) => {
        if (!prev) return prev
        const updatedLines = prev.lines.map((l) =>
          l.id === lineId ? { ...l, quantityPrepared } : l,
        )
        const fullyPreparedLines = updatedLines.filter(
          (l) => l.quantityPrepared >= l.quantityRequested,
        ).length
        const progressPercent =
          prev.totalLines > 0 ? Math.round((fullyPreparedLines / prev.totalLines) * 100) : 0
        return {
          ...prev,
          lines: updatedLines,
          fullyPreparedLines,
          progressPercent,
        }
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur mise à jour'
      toast.error(message)
    }
  }

  // ── Validate preparation ──
  const handleValidate = async () => {
    if (!selectedPrep) return
    const hasZeroLines = selectedPrep.lines.every((l) => l.quantityPrepared <= 0)
    if (hasZeroLines) {
      toast.error('Au moins une ligne doit avoir une quantité préparée')
      return
    }

    try {
      setSaving(true)
      const result = await api.put<Preparation>('/preparations', {
        id: selectedPrep.id,
        action: 'validate',
        notes: selectedPrep.notes || undefined,
      })

      // Show warnings if any
      if ('warnings' in result && Array.isArray((result as Record<string, unknown>).warnings) && (result as Record<string, unknown[]>).warnings.length > 0) {
        const warnings = (result as Record<string, unknown[]>).warnings as Array<{ productDesignation: string; deficit: number }>
        toast.warning(
          `Préparation validée avec ${warnings.length} avertissement(s) de stock`,
          { description: warnings.map((w) => `${w.productDesignation}: déficit ${w.deficit}`).join(', ') },
        )
      } else {
        toast.success(`Préparation ${selectedPrep.number} validée avec succès`)
      }

      setDetailOpen(false)
      setSelectedPrep(null)
      fetchPreparations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur validation'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ── Navigate to purchase orders or work orders ──
  const navigateTo = (target: string) => {
    window.dispatchEvent(
      new CustomEvent('erp:navigate', { detail: { target } }),
    )
  }

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Préparations de commande</h2>
          <Badge variant="secondary">{preparations.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="preparations" />
          <Button variant="outline" size="sm" onClick={fetchPreparations}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle préparation
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par N°, commande, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminée</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <Table>
              <IconLegend items={preparationLegendItems} />
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead className="hidden md:table-cell">Créée le</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preparations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter !== 'all'
                        ? 'Aucune préparation trouvée pour ce statut.'
                        : 'Aucune préparation enregistrée.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  preparations.map((prep) => (
                    <TableRow
                      key={prep.id}
                      className={cn("cursor-pointer", expandedPrepId === prep.id && "bg-primary/5 border-l-2 border-l-primary")}
                      onClick={() => setExpandedPrepId(expandedPrepId === prep.id ? null : prep.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(prep.status)}
                          <span className="font-mono font-medium">{prep.number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{prep.salesOrder.number}</TableCell>
                      <TableCell>{prep.salesOrder.client.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[prep.status] || ''}>
                          {statusLabels[prep.status] || prep.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={prep.progressPercent} className="h-2 flex-1" />
                          <ProgressBadge percent={prep.progressPercent} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {format(new Date(prep.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(prep)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {prep.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent('erp:navigate-delivery-notes', {
                                    detail: { salesOrderId: prep.salesOrder.id, preparationId: prep.id },
                                  }),
                                )
                              }}
                              title="Générer BL"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          {(prep.status === 'pending' || prep.status === 'in_progress' || prep.status === 'cancelled') && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {prep.status === 'pending' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleStart(prep.id)}>
                                      <Play className="h-4 w-4 mr-2" />
                                      Démarrer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCancel(prep.id)}>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Annuler
                                    </DropdownMenuItem>
                                    {isSuperAdmin && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteId(prep.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                {prep.status === 'in_progress' && (
                                  <DropdownMenuItem onClick={() => handleCancel(prep.id)}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Annuler
                                  </DropdownMenuItem>
                                )}
                                {prep.status === 'cancelled' && isSuperAdmin && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteId(prep.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Inline Detail Panel */}
      {expandedPrepId && (() => {
        const ep = preparations.find(p => p.id === expandedPrepId)
        if (!ep) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{ep.number}</span>
                      <Badge variant="secondary" className={statusColors[ep.status]}>{statusLabels[ep.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Commande {ep.salesOrder.number} — {ep.salesOrder.client.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openDetail(ep)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedPrepId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Commande</span>
                  <p className="font-medium font-mono">{ep.salesOrder.number}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Client</span>
                  <p className="font-medium">{ep.salesOrder.client.name}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Progression</span>
                  <p className="font-medium">{ep.fullyPreparedLines}/{ep.totalLines} lignes</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Nb Lignes</span>
                  <p className="font-medium">{ep.lines.length}</p>
                </div>
              </div>

              {ep.lines.length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="text-right w-[80px]">Demandé</TableHead>
                        <TableHead className="text-right w-[80px]">Stock act.</TableHead>
                        <TableHead className="text-right w-[80px]">Préparé</TableHead>
                        <TableHead className="text-center w-[80px]">État</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ep.lines.map((line) => {
                        const isFullyPrepared = line.quantityPrepared >= line.quantityRequested
                        const hasDeficitNow = line.quantityRequested > line.product.currentStock
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <div className="font-mono text-xs text-muted-foreground">{line.product.reference}</div>
                                  <div className="font-medium text-sm">{line.product.designation}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="secondary" className={`text-xs ${productNatureColors[line.product.productNature]}`}>
                                {productNatureLabels[line.product.productNature]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{line.quantityRequested}</TableCell>
                            <TableCell className="text-right">
                              <span className={hasDeficitNow ? 'text-red-600 font-medium' : 'text-green-600'}>
                                {line.product.currentStock}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  isFullyPrepared ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
                                )}
                              >
                                {line.quantityPrepared}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {isFullyPrepared ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                              ) : line.quantityPrepared > 0 ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                                  {line.quantityPrepared}/{line.quantityRequested}
                                </Badge>
                              ) : hasDeficitNow ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ep.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {ep.notes}</div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* ═══════════════════════════════════════════════════
          Create Dialog
          ═══════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setCreatePreview(null); setSelectedOrderId('') } }}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouvelle préparation de commande
            </DialogTitle>
            <DialogDescription>
              Sélectionnez une commande confirmée pour créer un bon de préparation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sales order selector */}
            <div className="space-y-2">
              <Label>Commande</Label>
              <Select value={selectedOrderId} onValueChange={handleSelectOrder}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une commande..." />
                </SelectTrigger>
                <SelectContent>
                  {salesOrders.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Aucune commande disponible
                    </SelectItem>
                  ) : (
                    salesOrders.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.number} — {so.client.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {createPreview && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    {createPreview.status === 'confirmed' ? 'Confirmée' : 'En préparation'}
                  </Badge>
                  <span className="text-muted-foreground">
                    {createPreview.client.name}
                  </span>
                </div>

                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Commandé</TableHead>
                        <TableHead className="text-right">Déjà préparé</TableHead>
                        <TableHead className="text-right">À préparer</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-center">Disponibilité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createPreview.lines
                        .filter((l) => l.quantity - (l.quantityPrepared || 0) > 0)
                        .map((line) => {
                          const toPrepare = line.quantity - (line.quantityPrepared || 0)
                          const hasStock = line.product.currentStock >= toPrepare
                          const deficit = Math.max(0, toPrepare - line.product.currentStock)
                          return (
                            <TableRow key={line.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <div className="font-mono text-xs text-muted-foreground">
                                      {line.product.reference}
                                    </div>
                                    <div>{line.product.designation}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`text-xs ${productNatureColors[line.product.productNature] || ''}`}>
                                  {productNatureLabels[line.productNature] || line.productNature}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{line.quantity}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {line.quantityPrepared || 0}
                              </TableCell>
                              <TableCell className="text-right font-medium">{toPrepare}</TableCell>
                              <TableCell className="text-right">
                                <span className={hasStock ? 'text-green-600' : 'text-red-600'}>
                                  {line.product.currentStock}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {hasStock ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      -{deficit}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {line.product.productNature === 'matiere_premiere'
                                        ? 'Achat fournisseur'
                                        : 'Production interne'}
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>

                {createPreview.lines.some(
                  (l) => l.quantity - (l.quantityPrepared || 0) > 0 &&
                    l.product.currentStock < (l.quantity - (l.quantityPrepared || 0)),
                ) && (
                  <Alert variant="destructive" className="bg-amber-50 text-amber-800 border-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Certains produits ont un stock insuffisant. Vous pouvez créer la préparation
                      mais les quantités devront être ajustées avant validation.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    placeholder="Notes sur la préparation..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={!selectedOrderId || creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer la préparation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          Detail Dialog
          ═══════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) { setSelectedPrep(null); setStockCheckData(null) } }}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <ClipboardList className="h-5 w-5" />
              {selectedPrep?.number}
              {selectedPrep && (
                <Badge variant="secondary" className={statusColors[selectedPrep.status]}>
                  {statusLabels[selectedPrep.status]}
                </Badge>
              )}
            </DialogTitle>
            {selectedPrep && (
              <DialogDescription>
                Commande {selectedPrep.salesOrder.number} — {selectedPrep.salesOrder.client.name}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedPrep && (
            <div className="space-y-6">
              <PrintHeader />
              {/* ── Info grid ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Commande</span>
                  <p className="font-mono font-medium">{selectedPrep.salesOrder.number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedPrep.salesOrder.client.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Créée le</span>
                  <p className="font-medium">
                    {format(new Date(selectedPrep.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                {selectedPrep.completedAt && (
                  <div>
                    <span className="text-muted-foreground">Complétée le</span>
                    <p className="font-medium">
                      {format(new Date(selectedPrep.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Overall progress ── */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progression globale</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedPrep.fullyPreparedLines}/{selectedPrep.totalLines} lignes
                      </span>
                      <ProgressBadge percent={selectedPrep.progressPercent} />
                    </div>
                  </div>
                  <Progress
                    value={selectedPrep.progressPercent}
                    className="h-3"
                  />
                </CardContent>
              </Card>

              {/* ── Lines table ── */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Articles à préparer
                </h3>
                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="text-right">Demandé</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Stock (création)</TableHead>
                        <TableHead className="text-right">Stock actuel</TableHead>
                        {selectedPrep.status === 'in_progress' && (
                          <TableHead className="w-[130px]">Préparé</TableHead>
                        )}
                        {selectedPrep.status === 'completed' && (
                          <TableHead className="text-right">Préparé</TableHead>
                        )}
                        <TableHead className="text-center">État</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPrep.lines.map((line) => {
                        const isFullyPrepared = line.quantityPrepared >= line.quantityRequested
                        const hasDeficitNow = line.quantityRequested > line.product.currentStock
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                  <div className="font-mono text-xs text-muted-foreground">
                                    {line.product.reference}
                                  </div>
                                  <div className="font-medium">{line.product.designation}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="secondary" className={`text-xs ${productNatureColors[line.product.productNature]}`}>
                                {productNatureLabels[line.product.productNature]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {line.quantityRequested}
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                              {line.stockAvailable}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={hasDeficitNow ? 'text-red-600 font-medium' : 'text-green-600'}>
                                {line.product.currentStock}
                              </span>
                            </TableCell>
                            {selectedPrep.status === 'in_progress' && (
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={line.quantityRequested}
                                  step={1}
                                  value={line.quantityPrepared}
                                  onChange={(e) => {
                                    const val = Math.min(
                                      parseFloat(e.target.value) || 0,
                                      line.quantityRequested,
                                    )
                                    handleUpdateLine(line.id, val)
                                  }}
                                  className="h-8 text-right font-mono"
                                />
                              </TableCell>
                            )}
                            {selectedPrep.status === 'completed' && (
                              <TableCell className="text-right">
                                <Badge
                                  variant="secondary"
                                  className={
                                    isFullyPrepared
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }
                                >
                                  {line.quantityPrepared}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-center">
                              {selectedPrep.status === 'completed' ? (
                                isFullyPrepared ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                ) : (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                                    Partiel
                                  </Badge>
                                )
                              ) : selectedPrep.status === 'in_progress' ? (
                                isFullyPrepared ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                ) : line.quantityPrepared > 0 ? (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                                    {line.quantityPrepared}/{line.quantityRequested}
                                  </Badge>
                                ) : hasDeficitNow ? (
                                  <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 mx-auto" />
                                )
                              ) : hasDeficitNow ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* ── Stock alerts ── */}
              {!loadingStockCheck && stockCheckData && stockCheckData.deficitLines > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Alertes de stock ({stockCheckData.deficitLines} produit(s) en déficit)
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {stockCheckData.lines
                      .filter((l) => l.hasDeficit)
                      .map((alertLine) => (
                        <Card key={alertLine.id} className="border-red-200 bg-red-50/50">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">
                                  {alertLine.productReference} — {alertLine.productDesignation}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${productNatureColors[alertLine.productNature]}`}
                                  >
                                    {alertLine.productNatureLabel}
                                  </Badge>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-red-100 text-red-800 font-mono">
                                -{alertLine.deficit}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                Stock actuel : <span className="text-red-600 font-medium">{alertLine.stockAvailable}</span>
                                {' / '}
                                Demandé : <span className="font-medium">{alertLine.quantityRequested}</span>
                              </p>
                            </div>
                            {alertLine.suggestion && (
                              <div className="flex items-center gap-2">
                                {alertLine.productNature === 'matiere_premiere' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-background border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                    onClick={() => navigateTo('purchase-orders')}
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                    Commander auprès d&apos;un fournisseur
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-background border-blue-300 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                    onClick={() => navigateTo('work-orders')}
                                  >
                                    <Factory className="h-3.5 w-3.5 mr-1.5" />
                                    Fabriquer
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {loadingStockCheck && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Vérification du stock...</span>
                </div>
              )}

              {/* ── Totaux ── */}
              {(() => {
                const totals = selectedPrep.salesOrder.lines.reduce(
                  (acc, line) => {
                    const tva = line.totalHT * line.tvaRate / 100
                    return { totalHT: acc.totalHT + line.totalHT, totalTVA: acc.totalTVA + tva }
                  },
                  { totalHT: 0, totalTVA: 0 },
                )
                const totalTTC = totals.totalHT + totals.totalTVA
                return (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex justify-end">
                      <div className="w-64 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total HT</span>
                          <span className="font-mono font-medium">{formatCurrency(totals.totalHT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total TVA</span>
                          <span className="font-mono font-medium">{formatCurrency(totals.totalTVA)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total TTC</span>
                          <span className="font-mono">{formatCurrency(totalTTC)}</span>
                        </div>
                        <div className="text-sm italic text-muted-foreground pt-1">
                          <span>Arrêté le présent bon de préparation à la somme de :</span>
                        </div>
                        <div className="text-sm font-medium italic text-right mt-1">
                          {numberToFrenchWords(totalTTC)} dirhams
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* ── Notes ── */}
              {selectedPrep.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes :</span>{' '}
                  {selectedPrep.notes}
                </div>
              )}

              <Separator />

              {/* ── Action buttons ── */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedPrep) return
                    printDocument({
                      title: 'BON DE PRÉPARATION',
                      docNumber: selectedPrep.number,
                      infoGrid: [
                        { label: 'Commande', value: selectedPrep.salesOrder?.number || '—' },
                        { label: 'Client', value: selectedPrep.salesOrder?.client?.name || '—' },
                        { label: 'Créée le', value: fmtDate(selectedPrep.createdAt) },
                        { label: 'Complétée le', value: fmtDate(selectedPrep.completedAt || '') },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Type' },
                        { label: 'Demandé', align: 'right' },
                        { label: 'Stock actuel', align: 'right' },
                        { label: 'Préparé', align: 'right' },
                        { label: 'État', align: 'center' },
                      ],
                      rows: selectedPrep.lines.map(line => [
                        { value: `${line.product.reference} - ${line.product.designation}` },
                        { value: productNatureLabels[line.product.productNature] || line.productNature },
                        { value: line.quantityRequested, align: 'right' },
                        { value: line.product.currentStock, align: 'right' },
                        { value: line.quantityPrepared, align: 'right' },
                        { value: line.quantityPrepared >= line.quantityRequested ? '✓ Complet' : line.quantityPrepared > 0 ? 'Partiel' : '—', align: 'center' },
                      ]),
                      totals: [],
                      notes: selectedPrep.notes || undefined,
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {selectedPrep.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(selectedPrep.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Annuler
                    </Button>
                    <Button onClick={() => handleStart(selectedPrep.id)}>
                      <Play className="h-4 w-4 mr-1.5" />
                      Démarrer la préparation
                    </Button>
                  </>
                )}
                {selectedPrep.status === 'in_progress' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(selectedPrep.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Annuler
                    </Button>
                    <Button
                      onClick={handleValidate}
                      disabled={saving || selectedPrep.lines.every((l) => l.quantityPrepared <= 0)}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Validation...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1.5" />
                          Valider la préparation
                        </>
                      )}
                    </Button>
                  </>
                )}
                {selectedPrep.status === 'completed' && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Préparation terminée
                  </div>
                )}
                {selectedPrep.status === 'cancelled' && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    Préparation annulée
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
          Delete Confirmation
          ═══════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la préparation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette préparation ? Cette action est irréversible.
              Les lignes de préparation seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
