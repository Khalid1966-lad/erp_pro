'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { HelpButton } from '@/components/erp/shared/help-button'
import {
  ShieldCheck, Plus, Eye, RefreshCw, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Play, FileEdit
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────

type QCType = 'reception' | 'production_inter' | 'production_out' | 'production_final' | 'inventory'
type QCStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'
type QCResult = 'conforme' | 'non_conforme' | 'conditionnel'

interface Product {
  id: string
  reference: string
  designation: string
}

interface QCLine {
  id: string
  productId: string
  product: Product
  specification: string | null
  measuredValue: string | null
  unit: string | null
  minValue: number | null
  maxValue: number | null
  tolerance: number | null
  result: QCResult
  notes: string | null
}

interface WorkOrderRef {
  id: string
  number: string
  product: { reference: string; designation: string }
}

interface ReceptionRef {
  id: string
  number: string
}

interface QualityControl {
  id: string
  number: string
  type: QCType
  status: QCStatus
  date: string
  inspector: string | null
  notes: string | null
  result: QCResult | null
  reference: string | null
  receptionId: string | null
  workOrderId: string | null
  reception: ReceptionRef | null
  workOrder: WorkOrderRef | null
  lines: QCLine[]
  createdAt: string
  updatedAt: string
}

interface LineFormData {
  productId: string
  specification: string
  measuredValue: string
  unit: string
  minValue: string
  maxValue: string
  tolerance: string
  result: QCResult
  notes: string
}

// ─── Config Maps ──────────────────────────────────────────────────────────

const typeLabels: Record<QCType, string> = {
  reception: 'Réception',
  production_inter: 'Inter-étape',
  production_out: 'Sortie production',
  production_final: 'Contrôle final',
  inventory: 'Inventaire',
}

const typeColors: Record<QCType, string> = {
  reception: 'bg-blue-100 text-blue-800 border-blue-200',
  production_inter: 'bg-purple-100 text-purple-800 border-purple-200',
  production_out: 'bg-orange-100 text-orange-800 border-orange-200',
  production_final: 'bg-teal-100 text-teal-800 border-teal-200',
  inventory: 'bg-slate-100 text-slate-800 border-slate-200',
}

const statusLabels: Record<QCStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  rejected: 'Rejeté',
}

const statusColors: Record<QCStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
}

const resultLabels: Record<QCResult, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  conditionnel: 'Conditionnel',
}

const resultColors: Record<QCResult, string> = {
  conforme: 'bg-green-100 text-green-800 border-green-200',
  non_conforme: 'bg-red-100 text-red-800 border-red-200',
  conditionnel: 'bg-orange-100 text-orange-800 border-orange-200',
}

const emptyLine: LineFormData = {
  productId: '',
  specification: '',
  measuredValue: '',
  unit: '',
  minValue: '',
  maxValue: '',
  tolerance: '',
  result: 'conforme',
  notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────

export default function QualityControlView() {
  const [items, setItems] = useState<QualityControl[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRef[]>([])
  const [receptions, setReceptions] = useState<ReceptionRef[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    type: 'reception' as QCType,
    receptionId: '',
    workOrderId: '',
    inspector: '',
    notes: '',
    reference: '',
  })
  const [createLines, setCreateLines] = useState<LineFormData[]>([{ ...emptyLine }])
  const [creating, setCreating] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<QualityControl | null>(null)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    id: '',
    status: 'pending' as QCStatus,
    result: '' as QCResult | '',
    inspector: '',
    notes: '',
    reference: '',
  })
  const [editLines, setEditLines] = useState<LineFormData[]>([{ ...emptyLine }])
  const [editing, setEditing] = useState(false)

  // ─── Fetch ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '50')
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const data = await api.get<{ qualityControls: QualityControl[]; total: number }>(
        `/quality-control?${params.toString()}`
      )
      setItems(data.qualityControls || [])
      setTotal(data.total)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, statusFilter])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products?limit=300')
      setProducts(data.products || [])
    } catch { /* silent */ }
  }, [])

  const fetchWorkOrders = useCallback(async () => {
    try {
      const data = await api.get<{ workOrders: WorkOrderRef[] }>('/production/work-orders?limit=200&status=in_progress')
      const allWOs = data.workOrders || []
      // Also fetch completed/closed for reference
      const data2 = await api.get<{ workOrders: WorkOrderRef[] }>('/production/work-orders?limit=200&status=completed')
      const completedWOs = data2.workOrders || []
      setWorkOrders([...allWOs, ...completedWOs])
    } catch { /* silent */ }
  }, [])

  const fetchReceptions = useCallback(async () => {
    try {
      const data = await api.get<{ receptions: ReceptionRef[] }>('/receptions?limit=200')
      setReceptions(data.receptions || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchWorkOrders() }, [fetchWorkOrders])
  useEffect(() => { fetchReceptions() }, [fetchReceptions])
  useEffect(() => { fetchData() }, [fetchData])

  const totalPages = Math.ceil(total / 50)

  // ─── Result counts ─────────────────────────────────────────────────

  const resultCounts = useMemo(() => {
    const counts: Record<string, number> = { conforme: 0, non_conforme: 0, conditionnel: 0 }
    items.forEach((item) => {
      if (item.result) {
        counts[item.result] = (counts[item.result] || 0) + 1
      }
    })
    return counts
  }, [items])

  // ─── Helpers ───────────────────────────────────────────────────────

  const fmtDate = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
  }

  const fmtDateTime = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
  }

  const getSourceLabel = (item: QualityControl) => {
    if (item.workOrder) {
      return `OF ${item.workOrder.number}`
    }
    if (item.reception) {
      return `BR ${item.reception.number}`
    }
    return item.reference || '-'
  }

  // ─── Create ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const validLines = createLines.filter((l) => l.productId)
    try {
      setCreating(true)
      const body: Record<string, unknown> = {
        type: createForm.type,
        inspector: createForm.inspector || undefined,
        notes: createForm.notes || undefined,
        reference: createForm.reference || undefined,
      }
      if (createForm.type === 'reception' && createForm.receptionId) {
        body.receptionId = createForm.receptionId
      }
      if (['production_inter', 'production_out', 'production_final'].includes(createForm.type) && createForm.workOrderId) {
        body.workOrderId = createForm.workOrderId
      }
      if (validLines.length > 0) {
        body.lines = validLines.map((l) => ({
          productId: l.productId,
          specification: l.specification || undefined,
          measuredValue: l.measuredValue || undefined,
          unit: l.unit || undefined,
          minValue: l.minValue ? parseFloat(l.minValue) : null,
          maxValue: l.maxValue ? parseFloat(l.maxValue) : null,
          tolerance: l.tolerance ? parseFloat(l.tolerance) : null,
          result: l.result,
          notes: l.notes || undefined,
        }))
      }

      await api.post('/quality-control', body)
      toast.success('Contrôle qualité créé')
      setCreateOpen(false)
      resetCreateForm()
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const resetCreateForm = () => {
    setCreateForm({ type: 'reception', receptionId: '', workOrderId: '', inspector: '', notes: '', reference: '' })
    setCreateLines([{ ...emptyLine }])
  }

  // ─── Update (status actions) ───────────────────────────────────────

  const handleStatusChange = async (item: QualityControl, newStatus: QCStatus) => {
    try {
      await api.put('/quality-control', {
        id: item.id,
        status: newStatus,
        result: newStatus === 'completed' ? 'conforme' : newStatus === 'rejected' ? 'non_conforme' : item.result,
      })
      const labels: Record<QCStatus, string> = {
        pending: 'Contrôle mis en attente',
        in_progress: 'Contrôle démarré',
        completed: 'Contrôle terminé',
        rejected: 'Contrôle rejeté',
      }
      toast.success(labels[newStatus])
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    }
  }

  // ─── Edit ──────────────────────────────────────────────────────────

  const openEdit = (item: QualityControl) => {
    setEditForm({
      id: item.id,
      status: item.status,
      result: item.result || '',
      inspector: item.inspector || '',
      notes: item.notes || '',
      reference: item.reference || '',
    })
    if (item.lines.length > 0) {
      setEditLines(item.lines.map((l) => ({
        productId: l.productId,
        specification: l.specification || '',
        measuredValue: l.measuredValue || '',
        unit: l.unit || '',
        minValue: l.minValue !== null ? String(l.minValue) : '',
        maxValue: l.maxValue !== null ? String(l.maxValue) : '',
        tolerance: l.tolerance !== null ? String(l.tolerance) : '',
        result: l.result,
        notes: l.notes || '',
      })))
    } else {
      setEditLines([{ ...emptyLine }])
    }
    setEditOpen(true)
  }

  const handleEdit = async () => {
    try {
      setEditing(true)
      const validLines = editLines.filter((l) => l.productId)
      const body: Record<string, unknown> = {
        id: editForm.id,
        status: editForm.status,
        result: editForm.result || null,
        inspector: editForm.inspector || null,
        notes: editForm.notes || null,
        reference: editForm.reference || null,
      }
      if (validLines.length > 0) {
        body.lines = validLines.map((l) => ({
          productId: l.productId,
          specification: l.specification || undefined,
          measuredValue: l.measuredValue || undefined,
          unit: l.unit || undefined,
          minValue: l.minValue ? parseFloat(l.minValue) : null,
          maxValue: l.maxValue ? parseFloat(l.maxValue) : null,
          tolerance: l.tolerance ? parseFloat(l.tolerance) : null,
          result: l.result,
          notes: l.notes || undefined,
        }))
      }

      await api.put('/quality-control', body)
      toast.success('Contrôle qualité mis à jour')
      setEditOpen(false)
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour'
      toast.error(message)
    } finally {
      setEditing(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/quality-control?id=${id}`)
      toast.success('Contrôle qualité supprimé')
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      toast.error(message)
    }
  }

  // ─── Line management ───────────────────────────────────────────────

  const addLine = (setter: (fn: (prev: LineFormData[]) => LineFormData[]) => void) => {
    setter((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number, setter: (fn: (prev: LineFormData[]) => LineFormData[]) => void) => {
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLine = (
    index: number,
    field: keyof LineFormData,
    value: string,
    setter: (fn: (prev: LineFormData[]) => LineFormData[]) => void
  ) => {
    setter((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  // ─── Loading skeleton ──────────────────────────────────────────────

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
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
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Contrôle qualité</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="production" sub="controle-qualite" />
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau contrôle
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold text-green-700">{resultCounts.conforme || 0}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-200">
              Conformes
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold text-red-700">{resultCounts.non_conforme || 0}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-red-100 text-red-800 border-red-200">
              Non conformes
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="text-2xl font-bold text-orange-700">{resultCounts.conditionnel || 0}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-orange-100 text-orange-800 border-orange-200">
              Conditionnels
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {(Object.keys(typeLabels) as QCType[]).map((t) => (
                  <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(Object.keys(statusLabels) as QCStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Inspecteur</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun contrôle qualité trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeColors[item.type]}>
                            {typeLabels[item.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{getSourceLabel(item)}</TableCell>
                        <TableCell>
                          {item.result ? (
                            <Badge variant="outline" className={resultColors[item.result]}>
                              {resultLabels[item.result]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[item.status]}>
                            {statusLabels[item.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {item.inspector || '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {fmtDateTime(item.date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(item); setDetailOpen(true) }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {item.status === 'pending' && (
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                onClick={() => handleStatusChange(item, 'in_progress')}
                                title="Démarrer"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status === 'in_progress' && (
                              <>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"
                                  onClick={() => handleStatusChange(item, 'completed')}
                                  title="Terminer"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => handleStatusChange(item, 'rejected')}
                                  title="Rejeter"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {['pending', 'in_progress'].includes(item.status) && (
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700"
                                onClick={() => openEdit(item)}
                                title="Modifier"
                              >
                                <FileEdit className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status !== 'completed' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le contrôle {item.number}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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

      {/* ═══ Create Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Nouveau contrôle qualité
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de contrôle *</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v: QCType) => setCreateForm({ ...createForm, type: v, receptionId: '', workOrderId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeLabels) as QCType[]).map((t) => (
                      <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Inspecteur</Label>
                <Input
                  value={createForm.inspector}
                  onChange={(e) => setCreateForm({ ...createForm, inspector: e.target.value })}
                  placeholder="Nom de l'inspecteur"
                />
              </div>
            </div>

            {/* Source selector */}
            {createForm.type === 'reception' && (
              <div className="space-y-2">
                <Label>Réception source</Label>
                <Select value={createForm.receptionId} onValueChange={(v) => setCreateForm({ ...createForm, receptionId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une réception..." />
                  </SelectTrigger>
                  <SelectContent>
                    {receptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {['production_inter', 'production_out', 'production_final'].includes(createForm.type) && (
              <div className="space-y-2">
                <Label>Ordre de fabrication source</Label>
                <Select value={createForm.workOrderId} onValueChange={(v) => setCreateForm({ ...createForm, workOrderId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un OF..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id}>
                        {wo.number} - {wo.product.reference} {wo.product.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Référence</Label>
              <Input
                value={createForm.reference}
                onChange={(e) => setCreateForm({ ...createForm, reference: e.target.value })}
                placeholder="Référence optionnelle"
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

            {/* Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Lignes de contrôle</Label>
                <Button variant="outline" size="sm" onClick={() => addLine(setCreateLines)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter une ligne
                </Button>
              </div>

              {createLines.map((line, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</span>
                    {createLines.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 text-destructive hover:text-destructive" onClick={() => removeLine(idx, setCreateLines)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Produit</Label>
                      <Select value={line.productId} onValueChange={(v) => updateLine(idx, 'productId', v, setCreateLines)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Produit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.reference} - {p.designation}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Spécification</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.specification}
                        onChange={(e) => updateLine(idx, 'specification', e.target.value, setCreateLines)}
                        placeholder="Ex: Diamètre"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valeur mesurée</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.measuredValue}
                        onChange={(e) => updateLine(idx, 'measuredValue', e.target.value, setCreateLines)}
                        placeholder="Ex: 110.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unité</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.unit}
                        onChange={(e) => updateLine(idx, 'unit', e.target.value, setCreateLines)}
                        placeholder="mm, kg..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Min</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.minValue}
                        onChange={(e) => updateLine(idx, 'minValue', e.target.value, setCreateLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.maxValue}
                        onChange={(e) => updateLine(idx, 'maxValue', e.target.value, setCreateLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tolérance</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.tolerance}
                        onChange={(e) => updateLine(idx, 'tolerance', e.target.value, setCreateLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Résultat</Label>
                      <Select value={line.result} onValueChange={(v: QCResult) => updateLine(idx, 'result', v, setCreateLines)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conforme">Conforme</SelectItem>
                          <SelectItem value="non_conforme">Non conforme</SelectItem>
                          <SelectItem value="conditionnel">Conditionnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Notes ligne</Label>
                    <Input
                      className="h-8 text-sm"
                      value={line.notes}
                      onChange={(e) => updateLine(idx, 'notes', e.target.value, setCreateLines)}
                      placeholder="Notes optionnelles"
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Création...' : 'Créer le contrôle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Detail Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {selected?.number}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={selected ? typeColors[selected.type] : ''}>
                  {selected ? typeLabels[selected.type] : ''}
                </Badge>
                <Badge variant="outline" className={selected ? statusColors[selected.status] : ''}>
                  {selected ? statusLabels[selected.status] : ''}
                </Badge>
                {selected?.result && (
                  <Badge variant="outline" className={resultColors[selected.result]}>
                    {resultLabels[selected.result]}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium mt-1">{getSourceLabel(selected)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Inspecteur</p>
                  <p className="text-sm font-medium mt-1">{selected.inspector || '-'}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium mt-1">{fmtDateTime(selected.date)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="text-sm font-medium mt-1">{selected.reference || '-'}</p>
                </div>
              </div>

              {selected.notes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {/* Result summary */}
              {selected.lines.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-green-50 rounded-md text-center">
                    <p className="text-lg font-bold text-green-700">
                      {selected.lines.filter((l) => l.result === 'conforme').length}
                    </p>
                    <p className="text-xs text-green-600">Conformes</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-md text-center">
                    <p className="text-lg font-bold text-red-700">
                      {selected.lines.filter((l) => l.result === 'non_conforme').length}
                    </p>
                    <p className="text-xs text-red-600">Non conformes</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded-md text-center">
                    <p className="text-lg font-bold text-orange-700">
                      {selected.lines.filter((l) => l.result === 'conditionnel').length}
                    </p>
                    <p className="text-xs text-orange-600">Conditionnels</p>
                  </div>
                </div>
              )}

              {/* Lines table */}
              {selected.lines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Lignes de contrôle ({selected.lines.length})</h3>
                  <div className="border rounded-md overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead>Spécification</TableHead>
                            <TableHead>Valeur mesurée</TableHead>
                            <TableHead className="hidden md:table-cell">Min / Max</TableHead>
                            <TableHead className="hidden md:table-cell">Tolérance</TableHead>
                            <TableHead>Résultat</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.lines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>
                                <span className="font-mono text-sm">{line.product.reference}</span>
                                <span className="ml-1 text-sm">{line.product.designation}</span>
                              </TableCell>
                              <TableCell className="text-sm">{line.specification || '-'}</TableCell>
                              <TableCell className="text-sm font-medium">
                                {line.measuredValue || '-'}
                                {line.unit ? <span className="text-muted-foreground ml-1">({line.unit})</span> : null}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                {line.minValue !== null && line.maxValue !== null
                                  ? `${line.minValue} / ${line.maxValue}`
                                  : '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                {line.tolerance !== null ? `±${line.tolerance}` : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={resultColors[line.result]}>
                                  {resultLabels[line.result]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {selected.status === 'pending' && (
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={() => { setDetailOpen(false); handleStatusChange(selected, 'in_progress') }}>
                    <Play className="h-4 w-4 mr-1" /> Démarrer
                  </Button>
                )}
                {selected.status === 'in_progress' && (
                  <>
                    <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => { setDetailOpen(false); handleStatusChange(selected, 'completed') }}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Terminer
                    </Button>
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => { setDetailOpen(false); handleStatusChange(selected, 'rejected') }}>
                      <XCircle className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                  </>
                )}
                {['pending', 'in_progress'].includes(selected.status) && (
                  <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    onClick={() => { setDetailOpen(false); openEdit(selected) }}>
                    <FileEdit className="h-4 w-4 mr-1" /> Modifier
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              Modifier le contrôle {editForm.id ? selected?.number : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v: QCStatus) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabels) as QCStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Résultat</Label>
                <Select
                  value={editForm.result || 'none'}
                  onValueChange={(v) => setEditForm({ ...editForm, result: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non défini" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="conforme">Conforme</SelectItem>
                    <SelectItem value="non_conforme">Non conforme</SelectItem>
                    <SelectItem value="conditionnel">Conditionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Inspecteur</Label>
                <Input
                  value={editForm.inspector}
                  onChange={(e) => setEditForm({ ...editForm, inspector: e.target.value })}
                  placeholder="Nom de l'inspecteur"
                />
              </div>
              <div className="space-y-2">
                <Label>Référence</Label>
                <Input
                  value={editForm.reference}
                  onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            {/* Edit Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Lignes de contrôle</Label>
                <Button variant="outline" size="sm" onClick={() => addLine(setEditLines)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>

              {editLines.map((line, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</span>
                    {editLines.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 text-destructive hover:text-destructive" onClick={() => removeLine(idx, setEditLines)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Produit</Label>
                      <Select value={line.productId} onValueChange={(v) => updateLine(idx, 'productId', v, setEditLines)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Produit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.reference} - {p.designation}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Spécification</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.specification}
                        onChange={(e) => updateLine(idx, 'specification', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valeur mesurée</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.measuredValue}
                        onChange={(e) => updateLine(idx, 'measuredValue', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unité</Label>
                      <Input
                        className="h-8 text-sm"
                        value={line.unit}
                        onChange={(e) => updateLine(idx, 'unit', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Min</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.minValue}
                        onChange={(e) => updateLine(idx, 'minValue', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.maxValue}
                        onChange={(e) => updateLine(idx, 'maxValue', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tolérance</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        value={line.tolerance}
                        onChange={(e) => updateLine(idx, 'tolerance', e.target.value, setEditLines)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Résultat</Label>
                      <Select value={line.result} onValueChange={(v: QCResult) => updateLine(idx, 'result', v, setEditLines)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conforme">Conforme</SelectItem>
                          <SelectItem value="non_conforme">Non conforme</SelectItem>
                          <SelectItem value="conditionnel">Conditionnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      className="h-8 text-sm"
                      value={line.notes}
                      onChange={(e) => updateLine(idx, 'notes', e.target.value, setEditLines)}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
