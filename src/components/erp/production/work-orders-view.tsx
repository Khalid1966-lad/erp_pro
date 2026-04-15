'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
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
import {
  Factory, Plus, Eye, RefreshCw, Search, Calendar, ChevronLeft, ChevronRight,
  Play, CheckCircle2, XCircle, Lock, FileEdit, Clock, Package, Trash2, ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

type WorkOrderStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

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
  product: {
    id: string
    reference: string
    designation: string
  }
  steps: WorkOrderStep[]
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

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

export default function WorkOrdersView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    productId: '',
    quantity: '',
    plannedDate: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)

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
      const data = await api.get<{ products: Product[] }>('/products?productType=vente&limit=200')
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

  const totalPages = Math.ceil(total / 50)

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

  const openDetail = (wo: WorkOrder) => {
    setSelectedWO(wo)
    setDetailOpen(true)
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Nouvel ordre de fabrication
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produit fini *</Label>
              <Select value={createForm.productId} onValueChange={(v) => setCreateForm({ ...createForm, productId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.reference} - {p.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
