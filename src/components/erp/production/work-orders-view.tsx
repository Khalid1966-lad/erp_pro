'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { ProductCombobox } from '@/components/erp/shared/product-combobox'
import LotsView, { lotStatutLabels, lotStatutColors } from '@/components/erp/production/lots-view'
import {
  Factory, Plus, Eye, RefreshCw, Search, Calendar, ChevronLeft, ChevronRight,
  Play, CheckCircle2, XCircle, Lock, FileEdit, Clock, Package, Trash2, ArrowRight,
  AlertTriangle, Loader2, Layers, ChevronUp, ChevronDown
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

type WorkOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
type BatchStatus = 'pending' | 'in_progress' | 'quality_check' | 'completed' | 'rejected'

interface Product {
  id: string
  reference: string
  designation: string
}

interface WorkOrderStep {
  id: string
  stepOrder: number
  description: string | null
  workStationId: string | null
  duration: number
  actualDuration: number
  status: StepStatus
  startedAt: string | null
  completedAt: string | null
  goodQuantity: number
  scrapQuantity: number
  notes: string | null
  workStation?: {
    id: string
    name: string
  }
}

interface BomComponentStock {
  id: string
  componentId: string
  quantity: number
  component: {
    id: string
    reference: string
    designation: string
    currentStock: number
    unit: string
    productNature: string
  }
}

interface ProductionBatch {
  id: string
  workOrderId: string
  batchNumber: string
  quantity: number
  goodQuantity: number
  scrapQuantity: number
  status: BatchStatus
  notes: string | null
  startedAt: string | null
  completedAt: string | null
}

interface WorkOrder {
  id: string
  number: string
  productId: string
  quantity: number
  status: WorkOrderStatus
  plannedDate: string | null
  startedAt: string | null
  completedAt: string | null
  closedAt: string | null
  notes: string | null
  goodQuantity: number
  scrapQuantity: number
  totalCost: number
  estimatedEndDate?: string | null
  product: {
    id: string
    reference: string
    designation: string
  }
  steps: WorkOrderStep[]
  batches?: ProductionBatch[]
}

const statusLabels: Record<WorkOrderStatus, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_progress: 'En cours',
  completed: 'Terminé',
  closed: 'Clôturé',
  cancelled: 'Annulé',
}

const statusColors: Record<WorkOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-800 border-slate-200',
  planned: 'bg-purple-100 text-purple-800 border-purple-200',
  in_progress: 'bg-orange-100 text-orange-800 border-orange-200',
  completed: 'bg-teal-100 text-teal-800 border-teal-200',
  closed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
}

const stepStatusLabels: Record<StepStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  skipped: 'Ignoré',
}

const stepStatusColors: Record<StepStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-500',
}

const batchStatusLabels: Record<BatchStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  quality_check: 'Contrôle qualité',
  completed: 'Terminé',
  rejected: 'Rejeté',
}

const batchStatusColors: Record<BatchStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-orange-100 text-orange-700 border-orange-200',
  quality_check: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface StockLot {
  id: string
  numeroLot: string
  productId: string
  workOrderId: string | null
  quantiteInitiale: number
  statut: 'actif' | 'epuise' | 'bloque' | 'expire'
  dateFabrication: string | null
  dateExpiration: string | null
  notes: string | null
  createdAt: string
  product: { id: string; reference: string; designation: string; unit: string }
  workOrder?: { id: string; number: string }
  qtySortie: number
  qtyReservee: number
  qtyRetour: number
  qtyDisponible: number
  qtyPhysique: number
}

export default function WorkOrdersView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Stock lots section
  const [lotsSectionOpen, setLotsSectionOpen] = useState(false)
  const [woStockLots, setWoStockLots] = useState<StockLot[]>([])

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    productId: '',
    quantity: '',
    plannedDate: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)
  const [bomCheckLoading, setBomCheckLoading] = useState(false)
  const [bomCheck, setBomCheck] = useState<BomComponentStock[]>([])
  const [productSearch, setProductSearch] = useState('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null)

  // Close dialog
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeForm, setCloseForm] = useState({
    goodQuantity: '',
    scrapQuantity: '',
    notes: '',
  })
  const [closing, setClosing] = useState(false)

  // Step action
  const [stepActionLoading, setStepActionLoading] = useState<string | null>(null)

  // Batch management
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [newBatchQty, setNewBatchQty] = useState('')
  const [newBatchNotes, setNewBatchNotes] = useState('')
  const [batchActionLoading, setBatchActionLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBatchId, setRejectBatchId] = useState<string | null>(null)

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', page.toString())
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const data = await api.get<{ workOrders: WorkOrder[]; total: number; page: number; limit: number }>(
        `/production/work-orders?${params.toString()}`
      )
      setWorkOrders(data.workOrders || [])
      setTotal(data.total)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des OF')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products?productUsage=vente&dropdown=true')
      setProducts(data.products || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    if (!q.trim()) return products
    return products.filter(p =>
      p.reference.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q)
    )
  }, [products, productSearch])

  // Fetch BOM for stock check when product or quantity changes
  useEffect(() => {
    if (!createForm.productId || !createForm.quantity) {
      setBomCheck([])
      return
    }
    const fetchBom = async () => {
      try {
        setBomCheckLoading(true)
        const data = await api.get<{ boms: BomComponentStock[] }>(`/production/bom?productId=${createForm.productId}`)
        setBomCheck(data.boms || [])
      } catch {
        setBomCheck([])
      } finally {
        setBomCheckLoading(false)
      }
    }
    fetchBom()
  }, [createForm.productId])

  const ofQty = parseFloat(createForm.quantity) || 0
  const bomCheckItems = bomCheck.map((b) => ({
    ...b,
    requiredQty: b.quantity * ofQty,
  }))
  const hasInsufficientStock = bomCheckItems.some((b) => b.requiredQty > b.component.currentStock)

  const handleCreate = async () => {
    if (!createForm.productId || !createForm.quantity) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    try {
      setCreating(true)
      await api.post('/production/work-orders', {
        productId: createForm.productId,
        quantity: parseFloat(createForm.quantity),
        plannedDate: createForm.plannedDate ? new Date(createForm.plannedDate).toISOString() : undefined,
        notes: createForm.notes || undefined,
      })
      toast.success('Ordre de fabrication créé')
      setCreateOpen(false)
      setCreateForm({ productId: '', quantity: '', plannedDate: '', notes: '' })
      fetchWorkOrders()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  const handleAction = async (wo: WorkOrder, action: string) => {
    try {
      await api.put('/production/work-orders', { id: wo.id, action })
      const actionLabels: Record<string, string> = {
        plan: 'OF planifié',
        launch: 'OF lancé — matières consommées',
        complete: 'OF terminé',
        cancel: 'OF annulé',
      }
      toast.success(actionLabels[action] || 'Action effectuée')
      if (detailOpen) {
        setDetailOpen(false)
      }
      fetchWorkOrders()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'action")
    }
  }

  const handleClose = async () => {
    if (!selectedWO) return
    try {
      setClosing(true)
      await api.put('/production/work-orders', {
        id: selectedWO.id,
        action: 'close',
        goodQuantity: parseFloat(closeForm.goodQuantity) || 0,
        scrapQuantity: parseFloat(closeForm.scrapQuantity) || 0,
        notes: closeForm.notes || undefined,
      })
      toast.success('OF clôturé — production stockée')
      setCloseOpen(false)
      setDetailOpen(false)
      fetchWorkOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la clôture')
    } finally {
      setClosing(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/production/work-orders?id=${id}`)
      toast.success('OF supprimé')
      fetchWorkOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const handleStepAction = async (wo: WorkOrder, step: WorkOrderStep, newStatus: StepStatus) => {
    try {
      setStepActionLoading(step.id)
      await api.put('/production/work-orders', {
        id: wo.id,
        action: 'update_step',
        stepId: step.id,
        status: newStatus,
        duration: step.duration,
      })
      toast.success(`Étape ${step.stepOrder} ${newStatus === 'in_progress' ? 'démarrée' : 'terminée'}`)
      // Refresh detail view
      const data = await api.get<{ workOrders: WorkOrder[] }>(`/production/work-orders?status=${wo.status}&limit=100`)
      const updated = data.workOrders.find((w) => w.id === wo.id)
      if (updated) setSelectedWO(updated)
      fetchWorkOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    } finally {
      setStepActionLoading(null)
    }
  }

  // ---- Stock lots for work order ----
  const fetchWoStockLots = useCallback(async (workOrderId: string) => {
    try {
      const data = await api.get<{ lots: StockLot[] }>(`/lots?workOrderId=${workOrderId}&limit=100`)
      setWoStockLots(data.lots || [])
    } catch {
      setWoStockLots([])
    }
  }, [])

  const openDetail = (wo: WorkOrder) => {
    setSelectedWO(wo)
    setDetailOpen(true)
    // Fetch batches for this work order
    fetchBatches(wo.id)
    // Fetch stock lots for this work order
    fetchWoStockLots(wo.id)
    setNewBatchQty('')
    setNewBatchNotes('')
  }

  const openCloseDialog = (wo: WorkOrder) => {
    setSelectedWO(wo)
    setCloseForm({
      goodQuantity: wo.quantity.toString(),
      scrapQuantity: '0',
      notes: wo.notes || '',
    })
    setCloseOpen(true)
  }

  const getStepProgress = (steps: WorkOrderStep[]) => {
    if (steps.length === 0) return 0
    const completed = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length
    return Math.round((completed / steps.length) * 100)
  }

  // ---- Batch management handlers ----
  const fetchBatches = useCallback(async (workOrderId: string) => {
    try {
      setBatchLoading(true)
      const data = await api.get<{ batches: ProductionBatch[] }>(
        `/production/batches?workOrderId=${workOrderId}`
      )
      setBatches(data.batches || [])
    } catch {
      setBatches([])
    } finally {
      setBatchLoading(false)
    }
  }, [])

  const handleCreateBatch = async () => {
    if (!selectedWO || !newBatchQty) {
      toast.error('Veuillez indiquer une quantité pour le lot')
      return
    }
    try {
      await api.post('/production/batches', {
        workOrderId: selectedWO.id,
        quantity: parseFloat(newBatchQty),
        notes: newBatchNotes || undefined,
      })
      toast.success('Lot créé')
      setNewBatchQty('')
      setNewBatchNotes('')
      fetchBatches(selectedWO.id)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du lot')
    }
  }

  const handleBatchAction = async (batchId: string, action: string, extraData?: Record<string, unknown>) => {
    try {
      setBatchActionLoading(batchId)
      await api.put('/production/batches', { id: batchId, action, ...extraData })
      const labels: Record<string, string> = {
        start: 'Lot démarré',
        complete: 'Lot terminé',
        reject: 'Lot rejeté',
        update: 'Lot mis à jour',
      }
      toast.success(labels[action] || 'Action effectuée')
      if (selectedWO) fetchBatches(selectedWO.id)
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    } finally {
      setBatchActionLoading(null)
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    try {
      await api.delete(`/production/batches?id=${batchId}`)
      toast.success('Lot supprimé')
      if (selectedWO) fetchBatches(selectedWO.id)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const handleRejectBatch = async () => {
    if (!rejectBatchId || !rejectReason.trim()) {
      toast.error('Veuillez indiquer la raison du rejet')
      return
    }
    await handleBatchAction(rejectBatchId, 'reject', { notes: rejectReason })
    setRejectBatchId(null)
    setRejectReason('')
  }

  const handleBatchQuantityBlur = (batch: ProductionBatch, field: 'goodQuantity' | 'scrapQuantity', value: string) => {
    const numVal = parseFloat(value)
    if (isNaN(numVal) || numVal < 0) return
    if (numVal === batch[field]) return
    handleBatchAction(batch.id, 'update', { [field]: numVal })
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
  }

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    workOrders.forEach((wo) => {
      counts[wo.status] = (counts[wo.status] || 0) + 1
    })
    return counts
  }, [workOrders])

  if (loading && workOrders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Ordres de fabrication</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvel OF
          </Button>
        </div>
      </div>

      {/* Stock Lots Section - Toggle */}
      <Card className={lotsSectionOpen ? '' : 'cursor-pointer'} onClick={() => setLotsSectionOpen(!lotsSectionOpen)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              Gestion des lots de stock
              <Badge variant="secondary">{woStockLots.length}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setLotsSectionOpen(!lotsSectionOpen) }}>
              {lotsSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {lotsSectionOpen && (
          <CardContent>
            <LotsView embedded />
          </CardContent>
        )}
      </Card>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['draft', 'planned', 'in_progress', 'completed', 'closed', 'cancelled'] as WorkOrderStatus[]).map((status) => (
          <Card
            key={status}
            className={`cursor-pointer transition-colors ${statusFilter === status ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
            onClick={() => { setStatusFilter(statusFilter === status ? 'all' : status); setPage(1) }}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
              <Badge variant="outline" className={`mt-1 text-xs ${statusColors[status]}`}>
                {statusLabels[status]}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(['draft', 'planned', 'in_progress', 'completed', 'closed', 'cancelled'] as WorkOrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OF</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Progression</TableHead>
                    <TableHead className="hidden lg:table-cell">Date planif.</TableHead>
                    <TableHead className="hidden xl:table-cell">Date début</TableHead>
                    <TableHead className="hidden xl:table-cell">Date fin</TableHead>
                    <TableHead className="hidden xl:table-cell">Fin estimée</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Aucun ordre de fabrication trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    workOrders.map((wo) => {
                      const progress = getStepProgress(wo.steps)
                      return (
                        <TableRow key={wo.id}>
                          <TableCell className="font-mono font-medium">{wo.number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div>
                                <span className="font-mono text-sm">{wo.product.reference}</span>
                                <span className="ml-1 text-sm">{wo.product.designation}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {wo.quantity.toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[wo.status]}>
                              {statusLabels[wo.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {wo.steps.length > 0 ? (
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <Progress value={progress} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {formatDate(wo.plannedDate)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                            {formatDateTime(wo.startedAt)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                            {formatDateTime(wo.completedAt)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm">
                            {wo.estimatedEndDate ? (
                              <span className={
                                wo.plannedDate && new Date(wo.estimatedEndDate) > new Date(wo.plannedDate) && wo.status !== 'completed' && wo.status !== 'closed'
                                  ? 'text-red-600 font-medium'
                                  : 'text-muted-foreground'
                              }>
                                {formatDate(wo.estimatedEndDate)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(wo)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {wo.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-purple-600 hover:text-purple-700"
                                  onClick={() => handleAction(wo, 'plan')}
                                  title="Planifier"
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              )}
                              {wo.status === 'planned' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-600 hover:text-orange-700"
                                  onClick={() => handleAction(wo, 'launch')}
                                  title="Lancer"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              {wo.status === 'in_progress' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-teal-600 hover:text-teal-700"
                                  onClick={() => handleAction(wo, 'complete')}
                                  title="Terminer"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              {wo.status === 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700"
                                  onClick={() => openCloseDialog(wo)}
                                  title="Clôturer"
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )}
                              {['draft', 'planned'].includes(wo.status) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title="Annuler">
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Annuler l&apos;OF {wo.number}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Êtes-vous sûr ? {wo.status === 'in_progress' ? 'Les matières seront retournées au stock.' : ''}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleAction(wo, 'cancel')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Confirmer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {['draft', 'planned'].includes(wo.status) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer l&apos;OF {wo.number}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(wo.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {(page - 1) * 50 + 1} - {Math.min(page * 50, total)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Nouvel ordre de fabrication
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produit fini *</Label>
              <ProductCombobox
                products={filteredProducts}
                value={createForm.productId}
                searchValue={productSearch}
                onSearchChange={setProductSearch}
                onSelect={(v) => setCreateForm({ ...createForm, productId: v })}
                placeholder="Rechercher un produit fini..."
              />
            </div>
            <div className="space-y-2">
              <Label>Quantité à produire *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={createForm.quantity}
                onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Date planifiée</Label>
              <Input
                type="date"
                value={createForm.plannedDate}
                onChange={(e) => setCreateForm({ ...createForm, plannedDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>

            {/* Stock feasibility check */}
            {createForm.productId && ofQty > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Vérification des stocks</Label>
                  {bomCheckLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
                {!bomCheckLoading && bomCheck.length === 0 && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Aucune nomenclature (BOM) définie pour ce produit.
                  </p>
                )}
                {!bomCheckLoading && bomCheck.length > 0 && (
                  <>
                    <div className="rounded border max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Composant</TableHead>
                            <TableHead className="text-xs text-right">Requis</TableHead>
                            <TableHead className="text-xs text-right">Stock</TableHead>
                            <TableHead className="text-xs text-center">Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bomCheckItems.map((item) => {
                            const sufficient = item.requiredQty <= item.component.currentStock
                            const deficit = item.component.currentStock - item.requiredQty
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs">
                                  <span className="font-mono">{item.component.reference}</span>
                                  <span className="ml-1">{item.component.designation}</span>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium">
                                  {item.requiredQty.toLocaleString('fr-FR')} {item.component.unit}
                                </TableCell>
                                <TableCell className="text-xs text-right">
                                  <span className={sufficient ? 'text-green-600' : 'text-red-600'}>
                                    {item.component.currentStock.toLocaleString('fr-FR')}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-center">
                                  {sufficient ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
                                      OK
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-red-100 text-red-800 text-[10px]">
                                      -{Math.abs(deficit).toLocaleString('fr-FR')}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {hasInsufficientStock && (
                      <Alert variant="destructive" className="bg-amber-50 text-amber-800 border-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Stock insuffisant pour certains composants. Vous pouvez créer l&apos;OF
                          mais le lancement sera bloqué tant que le stock n&apos;est pas approvisionné.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!createForm.productId || !createForm.quantity || creating}>
              {creating ? 'Création...' : 'Créer l\'OF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                {selectedWO?.number}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={selectedWO ? statusColors[selectedWO.status] : ''}>
                  {selectedWO ? statusLabels[selectedWO.status] : ''}
                </Badge>
                {selectedWO && (
                  <span className="text-sm text-muted-foreground">
                    {selectedWO.product.reference} - {selectedWO.product.designation}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-6">
              {/* Timeline / Planning Gantt-like */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Créé le</p>
                  <p className="text-sm font-medium">{formatDateTime(selectedWO.createdAt)}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Date planifiée</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">{formatDate(selectedWO.plannedDate)}</p>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Date de lancement</p>
                  <div className="flex items-center gap-1">
                    <Play className="h-3.5 w-3.5 text-orange-500" />
                    <p className="text-sm font-medium">{formatDateTime(selectedWO.startedAt)}</p>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Date de fin</p>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                    <p className="text-sm font-medium">{formatDateTime(selectedWO.completedAt)}</p>
                  </div>
                </div>
                {selectedWO.estimatedEndDate && (
                  <div className={`p-3 border rounded-lg ${
                    selectedWO.plannedDate && new Date(selectedWO.estimatedEndDate) > new Date(selectedWO.plannedDate) && selectedWO.status !== 'completed' && selectedWO.status !== 'closed'
                      ? 'border-red-200 bg-red-50/50'
                      : ''
                  }`}>
                    <p className={`text-xs mb-1 ${
                      selectedWO.plannedDate && new Date(selectedWO.estimatedEndDate) > new Date(selectedWO.plannedDate) && selectedWO.status !== 'completed' && selectedWO.status !== 'closed'
                        ? 'text-red-700'
                        : 'text-muted-foreground'
                    }`}>Fin estimée</p>
                    <p className={`text-sm font-medium ${
                      selectedWO.plannedDate && new Date(selectedWO.estimatedEndDate) > new Date(selectedWO.plannedDate) && selectedWO.status !== 'completed' && selectedWO.status !== 'closed'
                        ? 'text-red-700'
                        : ''
                    }`}>
                      {formatDate(selectedWO.estimatedEndDate)}
                    </p>
                  </div>
                )}
              </div>

              {/* Gantt-like progress */}
              {selectedWO.steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Progression des étapes</span>
                      <Badge variant="secondary">{getStepProgress(selectedWO.steps)}%</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Progress value={getStepProgress(selectedWO.steps)} className="h-3 mb-4" />
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedWO.steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step, idx) => {
                        const isLast = idx === selectedWO.steps.length - 1
                        return (
                          <div key={step.id} className="flex items-center">
                            <div
                              className={`h-8 px-2 rounded-md flex items-center justify-center text-xs font-medium ${
                                step.status === 'completed'
                                  ? 'bg-green-500 text-white'
                                  : step.status === 'in_progress'
                                  ? 'bg-orange-500 text-white'
                                  : step.status === 'skipped'
                                  ? 'bg-gray-400 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                              title={`Étape ${step.stepOrder}: ${step.description || step.workStation?.name || ''}`}
                            >
                              {step.stepOrder}
                            </div>
                            {!isLast && (
                              <ArrowRight className="h-4 w-4 text-muted-foreground mx-0.5" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Quantité demandée</p>
                  <p className="text-lg font-bold">{selectedWO.quantity.toLocaleString('fr-FR')}</p>
                </div>
                {selectedWO.status === 'closed' && (
                  <>
                    <div className="p-3 bg-green-50 rounded-md">
                      <p className="text-xs text-green-700">Quantité bonne</p>
                      <p className="text-lg font-bold text-green-700">{selectedWO.goodQuantity.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-md">
                      <p className="text-xs text-red-700">Rebut</p>
                      <p className="text-lg font-bold text-red-700">{selectedWO.scrapQuantity.toLocaleString('fr-FR')}</p>
                    </div>
                  </>
                )}
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Coût total</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedWO.totalCost)}</p>
                </div>
              </div>

              {selectedWO.notes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedWO.notes}</p>
                </div>
              )}

              {/* Contrôle des Lots - Batch Management */}
              {['planned', 'in_progress', 'completed', 'closed'].includes(selectedWO.status) && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Contrôle des Lots
                      </span>
                      <Badge variant="secondary">{batches.length} lot{batches.length > 1 ? 's' : ''}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {/* Summary bar */}
                    {batches.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="p-2 bg-muted rounded-md text-center">
                          <p className="text-xs text-muted-foreground">Lots créés</p>
                          <p className="text-sm font-bold">{batches.length}</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-md text-center">
                          <p className="text-xs text-green-700">Lots terminés</p>
                          <p className="text-sm font-bold text-green-700">{batches.filter(b => b.status === 'completed').length}</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-md text-center">
                          <p className="text-xs text-green-700">Qté bonne totale</p>
                          <p className="text-sm font-bold text-green-700">{batches.filter(b => b.status === 'completed').reduce((s, b) => s + b.goodQuantity, 0).toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-md text-center">
                          <p className="text-xs text-red-700">Rebut total</p>
                          <p className="text-sm font-bold text-red-700">{batches.filter(b => b.status === 'completed').reduce((s, b) => s + b.scrapQuantity, 0).toLocaleString('fr-FR')}</p>
                        </div>
                      </div>
                    )}

                    {/* New batch form */}
                    {['planned', 'in_progress'].includes(selectedWO.status) && (
                      <div className="flex flex-col sm:flex-row items-end gap-2 mb-4 p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Qté lot</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0"
                            value={newBatchQty}
                            onChange={(e) => setNewBatchQty(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Input
                            placeholder="Notes optionnelles"
                            value={newBatchNotes}
                            onChange={(e) => setNewBatchNotes(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button size="sm" onClick={handleCreateBatch} disabled={!newBatchQty} className="h-8">
                          <Plus className="h-3 w-3 mr-1" />
                          Nouveau Lot
                        </Button>
                      </div>
                    )}

                    {/* Batch list */}
                    {batchLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : batches.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Aucun lot créé. {['planned', 'in_progress'].includes(selectedWO.status) && 'Ajoutez un lot pour suivre la production.'}
                      </p>
                    ) : (
                      <div className="border rounded-md overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">N° Lot</TableHead>
                                <TableHead className="text-xs text-right">Qté prévue</TableHead>
                                <TableHead className="text-xs text-right">Qté bonne</TableHead>
                                <TableHead className="text-xs text-right">Rebut</TableHead>
                                <TableHead className="text-xs">Statut</TableHead>
                                <TableHead className="hidden sm:table-cell text-xs">Début</TableHead>
                                <TableHead className="text-xs text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batches.map((batch) => (
                                <TableRow key={batch.id}>
                                  <TableCell className="font-mono text-xs font-medium">{batch.batchNumber}</TableCell>
                                  <TableCell className="text-xs text-right">{batch.quantity.toLocaleString('fr-FR')}</TableCell>
                                  <TableCell className="text-right">
                                    {['in_progress', 'quality_check'].includes(batch.status) ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={batch.goodQuantity}
                                        onBlur={(e) => handleBatchQuantityBlur(batch, 'goodQuantity', e.target.value)}
                                        disabled={batchActionLoading === batch.id}
                                        className="h-7 w-20 text-xs text-right"
                                      />
                                    ) : (
                                      <span className={cn(
                                        'text-xs font-medium',
                                        batch.status === 'completed' ? 'text-green-700' : ''
                                      )}>
                                        {batch.goodQuantity.toLocaleString('fr-FR')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {['in_progress', 'quality_check'].includes(batch.status) ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={batch.scrapQuantity}
                                        onBlur={(e) => handleBatchQuantityBlur(batch, 'scrapQuantity', e.target.value)}
                                        disabled={batchActionLoading === batch.id}
                                        className="h-7 w-20 text-xs text-right"
                                      />
                                    ) : (
                                      <span className={cn(
                                        'text-xs',
                                        batch.status === 'completed' && batch.scrapQuantity > 0 ? 'text-red-600' : 'text-muted-foreground'
                                      )}>
                                        {batch.scrapQuantity.toLocaleString('fr-FR')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('text-[10px]', batchStatusColors[batch.status])}>
                                      {batchStatusLabels[batch.status]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                    {batch.startedAt ? format(new Date(batch.startedAt), 'HH:mm dd/MM', { locale: fr }) : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {batch.status === 'pending' && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-orange-600 hover:text-orange-700"
                                            disabled={batchActionLoading === batch.id}
                                            onClick={() => handleBatchAction(batch.id, 'start')}
                                            title="Démarrer lot"
                                          >
                                            <Play className="h-3.5 w-3.5" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Supprimer">
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Supprimer le lot {batch.batchNumber}</AlertDialogTitle>
                                                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteBatch(batch.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                  Supprimer
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </>
                                      )}
                                      {['in_progress', 'quality_check'].includes(batch.status) && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-green-600 hover:text-green-700"
                                            disabled={batchActionLoading === batch.id}
                                            onClick={() => handleBatchAction(batch.id, 'complete')}
                                            title="Terminer lot"
                                          >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-red-500 hover:text-red-600"
                                            disabled={batchActionLoading === batch.id}
                                            onClick={() => { setRejectBatchId(batch.id); setRejectReason('') }}
                                            title="Rejeter lot"
                                          >
                                            <XCircle className="h-3.5 w-3.5" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Stock Lots for this Work Order (closed only) */}
              {selectedWO.status === 'closed' && woStockLots.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Lots de stock générés
                  </h4>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">N° Lot</TableHead>
                          <TableHead className="text-xs text-right">Qté initiale</TableHead>
                          <TableHead className="text-xs text-right">Disponible</TableHead>
                          <TableHead className="text-xs text-right">Réservé</TableHead>
                          <TableHead className="text-xs">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {woStockLots.map((lot) => (
                          <TableRow key={lot.id}>
                            <TableCell className="font-mono text-xs">{lot.numeroLot}</TableCell>
                            <TableCell className="text-xs text-right">{lot.quantiteInitiale}</TableCell>
                            <TableCell className="text-xs text-right font-medium text-green-600">{lot.qtyDisponible}</TableCell>
                            <TableCell className="text-xs text-right text-orange-600">{lot.qtyReservee}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={lotStatutColors[lot.statut]}>
                                {lotStatutLabels[lot.statut]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Steps Table */}
              {selectedWO.steps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Étapes de fabrication</h3>
                  <div className="border rounded-md overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">N°</TableHead>
                            <TableHead>Poste / Description</TableHead>
                            <TableHead className="w-[90px] text-center">Durée</TableHead>
                            <TableHead className="w-[100px] text-center">Statut</TableHead>
                            <TableHead className="hidden md:table-cell w-[110px]">Début</TableHead>
                            <TableHead className="hidden md:table-cell w-[110px]">Fin</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedWO.steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step) => (
                            <TableRow key={step.id} className={
                              step.status === 'in_progress' ? 'bg-orange-50/50' : step.status === 'completed' ? 'bg-green-50/50' : ''
                            }>
                              <TableCell className="font-mono font-medium">{step.stepOrder}</TableCell>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{step.workStation?.name || '-'}</span>
                                  {step.description && (
                                    <p className="text-xs text-muted-foreground">{step.description}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                <div className="flex items-center justify-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span>{step.actualDuration > 0 ? step.actualDuration : step.duration} min</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={stepStatusColors[step.status]}>
                                  {stepStatusLabels[step.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                {step.startedAt ? format(new Date(step.startedAt), 'HH:mm dd/MM', { locale: fr }) : '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                {step.completedAt ? format(new Date(step.completedAt), 'HH:mm dd/MM', { locale: fr }) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {selectedWO.status === 'in_progress' && (
                                  <div className="flex items-center justify-end gap-1">
                                    {step.status === 'pending' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        disabled={stepActionLoading === step.id}
                                        onClick={() => handleStepAction(selectedWO, step, 'in_progress')}
                                      >
                                        <Play className="h-3 w-3 mr-1" />
                                        Démarrer
                                      </Button>
                                    )}
                                    {step.status === 'in_progress' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                        disabled={stepActionLoading === step.id}
                                        onClick={() => handleStepAction(selectedWO, step, 'completed')}
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Terminer
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selectedWO.status === 'draft' && (
                  <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => { handleAction(selectedWO, 'plan') }}>
                    <Calendar className="h-4 w-4 mr-1" />
                    Planifier
                  </Button>
                )}
                {selectedWO.status === 'planned' && (
                  <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => { handleAction(selectedWO, 'launch') }}>
                    <Play className="h-4 w-4 mr-1" />
                    Lancer
                  </Button>
                )}
                {selectedWO.status === 'in_progress' && (
                  <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50" onClick={() => { handleAction(selectedWO, 'complete') }}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Terminer
                  </Button>
                )}
                {selectedWO.status === 'completed' && (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setDetailOpen(false); openCloseDialog(selectedWO) }}>
                    <Lock className="h-4 w-4 mr-1" />
                    Clôturer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Batch Dialog */}
      <Dialog open={!!rejectBatchId} onOpenChange={(open) => { if (!open) setRejectBatchId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Rejeter le lot
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Raison du rejet *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Indiquez la raison du rejet..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectBatchId(null)}>Annuler</Button>
            <Button onClick={handleRejectBatch} className="bg-red-600 hover:bg-red-700">
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Clôturer l&apos;OF {selectedWO?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              La clôture enregistrera la production dans le stock. Indiquez les quantités produites.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantité bonne *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.goodQuantity}
                  onChange={(e) => setCloseForm({ ...closeForm, goodQuantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rebut</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.scrapQuantity}
                  onChange={(e) => setCloseForm({ ...closeForm, scrapQuantity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={closeForm.notes}
                onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Annuler</Button>
            <Button onClick={handleClose} disabled={closing} className="bg-green-600 hover:bg-green-700">
              {closing ? 'Clôture...' : 'Clôturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
