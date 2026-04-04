'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Truck, MoreVertical, CheckCircle, XCircle, Eye, Trash2, Package, FileText, Plus, Pencil, Link2, Unlink, ShoppingCart, CalendarClock, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Helpers ───

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

// ─── Interfaces ───

interface ClientOption {
  id: string
  name: string
  raisonSociale: string | null
  ville: string | null
}

interface ProductOption {
  id: string
  reference: string
  designation: string
  priceHT: number
  tvaRate: number
  unit: string
  currentStock: number
}

interface SalesOrderOption {
  id: string
  number: string
  status: string
  client: { id: string; name: string }
  totalHT: number
  totalTTC: number
}

interface DeliveryNoteLineItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  salesOrderLineId?: string
  product?: { id: string; reference: string; designation: string }
  salesOrderLine?: {
    id: string
    quantity: number
    quantityDelivered: number
    quantityPrepared: number
    unitPrice: number
    tvaRate: number
  } | null
  previouslyDelivered?: number
  remainingAfterDelivery?: number | null
}

interface DeliveryNote {
  id: string
  number: string
  status: string
  date: string
  plannedDate: string | null
  deliveryDate: string | null
  transporteur: string | null
  vehiclePlate: string | null
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  salesOrderId: string | null
  salesOrder: {
    id: string
    number: string
    lines: DeliveryNoteLineItem[]
  } | null
  client: { id: string; name: string }
  lines: DeliveryNoteLineItem[]
  salesOrderLinesTracking?: Array<{
    id: string
    quantity: number
    quantityDelivered: number
    remainingQuantity: number
    deliveryPercentage: number
  }>
}

interface EditableLine {
  tempId: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
}

// ─── Order line for partial delivery ───

interface OrderLineWithDelivery {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  quantityDelivered: number
  quantityPrepared: number
  remaining: number
  deliveryPercentage: number
  product?: { id: string; reference: string; designation: string }
}

// ─── Status Config ───

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirm\u00e9',
  delivered: 'Livr\u00e9',
  cancelled: 'Annul\u00e9'
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

// ─── Delivery percentage badge helper ───

function DeliveryBadge({ percentage }: { percentage: number }) {
  if (percentage >= 100) {
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">100%</Badge>
  }
  if (percentage > 0) {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">{percentage}%</Badge>
  }
  return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">0%</Badge>
}

// ─── Main Component ───

export default function DeliveryNotesView() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Selected
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Create form - mode: 'order' | 'standalone'
  const [createMode, setCreateMode] = useState<'order' | 'standalone'>('order')
  const [availableOrders, setAvailableOrders] = useState<SalesOrderOption[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [availableClients, setAvailableClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([])
  const [editableLines, setEditableLines] = useState<EditableLine[]>([])
  const [createTransporteur, setCreateTransporteur] = useState('')
  const [createVehiclePlate, setCreateVehiclePlate] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [createPlannedDate, setCreatePlannedDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Order lines for partial delivery
  const [orderLinesForDelivery, setOrderLinesForDelivery] = useState<OrderLineWithDelivery[]>([])
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({})
  const [loadingOrderLines, setLoadingOrderLines] = useState(false)

  // Edit form
  const [editTransporteur, setEditTransporteur] = useState('')
  const [editVehiclePlate, setEditVehiclePlate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPlannedDate, setEditPlannedDate] = useState('')
  const [saving, setSaving] = useState(false)

  // ─── Fetch ───

  const fetchDeliveryNotes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '100')
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const data = await api.get<{ deliveryNotes: DeliveryNote[]; total: number }>(`/delivery-notes?${params.toString()}`)
      setDeliveryNotes(data.deliveryNotes)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement bons de livraison')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchDeliveryNotes()
  }, [fetchDeliveryNotes])

  // ─── Create BL ───

  const openCreateDialog = async () => {
    setCreateOpen(true)
    setCreateMode('order')
    setSelectedOrderId('')
    setSelectedClientId('')
    setEditableLines([])
    setOrderLinesForDelivery([])
    setDeliveryQuantities({})
    setCreateTransporteur('')
    setCreateVehiclePlate('')
    setCreateNotes('')
    setCreatePlannedDate('')

    // Fetch available data in parallel
    setLoadingOrders(true)
    setLoadingClients(true)
    setLoadingProducts(true)

    try {
      const [prepData, partData, clientsData, productsData] = await Promise.all([
        api.get<{ salesOrders: SalesOrderOption[] }>('/sales-orders?status=prepared&limit=100'),
        api.get<{ salesOrders: SalesOrderOption[] }>('/sales-orders?status=partially_delivered&limit=100'),
        api.get<{ clients: ClientOption[] }>('/clients?limit=500'),
        api.get<{ products: ProductOption[] }>('/products?limit=500'),
      ])
      const allOrders = [...(prepData.salesOrders || []), ...(partData.salesOrders || [])]
      setAvailableOrders(allOrders)
      setAvailableClients(clientsData.clients || [])
      setAvailableProducts(productsData.products || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement des donn\u00e9es')
    } finally {
      setLoadingOrders(false)
      setLoadingClients(false)
      setLoadingProducts(false)
    }
  }

  // ─── Fetch order lines for partial delivery ───

  const fetchOrderLinesForDelivery = async (orderId: string) => {
    setLoadingOrderLines(true)
    setOrderLinesForDelivery([])
    setDeliveryQuantities({})
    try {
      const data = await api.get<{ deliveryNotes: DeliveryNote[] }>(`/delivery-notes?salesOrderId=${orderId}&limit=100`)
      // Find the sales order from the delivery notes
      const salesOrder = data.deliveryNotes.find(dn => dn.salesOrderId === orderId)?.salesOrder
      if (!salesOrder) {
        // Fetch the sales order directly
        const orderData = await api.get<{ orders: any[] }>(`/sales-orders?limit=1`) // fallback
        setLoadingOrderLines(false)
        return
      }

      const lines: OrderLineWithDelivery[] = salesOrder.lines.map((line: any) => {
        const remaining = Math.max(0, line.quantity - line.quantityDelivered)
        const pct = line.quantity > 0 ? Math.round((line.quantityDelivered / line.quantity) * 100) : 0
        return {
          id: line.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          tvaRate: line.tvaRate,
          quantityDelivered: line.quantityDelivered || 0,
          quantityPrepared: line.quantityPrepared || 0,
          remaining,
          deliveryPercentage: pct,
          product: line.product,
        }
      }).filter((l: OrderLineWithDelivery) => l.remaining > 0)

      setOrderLinesForDelivery(lines)

      // Default quantities = remaining
      const qtyMap: Record<string, number> = {}
      lines.forEach((l: OrderLineWithDelivery) => {
        qtyMap[l.id] = l.remaining
      })
      setDeliveryQuantities(qtyMap)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement lignes')
    } finally {
      setLoadingOrderLines(false)
    }
  }

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId)
    if (orderId) {
      fetchOrderLinesForDelivery(orderId)
    } else {
      setOrderLinesForDelivery([])
      setDeliveryQuantities({})
    }
  }

  // ─── Delivery quantities management ───

  const updateDeliveryQuantity = (lineId: string, value: number) => {
    setDeliveryQuantities((prev) => ({ ...prev, [lineId]: value }))
  }

  const getOrderDeliveryTotals = () => {
    let totalHT = 0
    let totalTVA = 0
    orderLinesForDelivery.forEach((line) => {
      const qty = deliveryQuantities[line.id] || 0
      if (qty > 0) {
        const ht = qty * line.unitPrice
        totalHT += ht
        totalTVA += ht * (line.tvaRate / 100)
      }
    })
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }

  const hasAnyQuantity = () => {
    return Object.values(deliveryQuantities).some((q) => q > 0)
  }

  const handleCreate = async () => {
    try {
      setCreating(true)

      if (createMode === 'order') {
        if (!selectedOrderId) {
          toast.error('Veuillez s\u00e9lectionner une commande')
          setCreating(false)
          return
        }

        // Build lines array with selected quantities
        const lines = orderLinesForDelivery
          .filter((l) => (deliveryQuantities[l.id] || 0) > 0)
          .map((l) => ({
            salesOrderLineId: l.id,
            quantity: deliveryQuantities[l.id],
          }))

        if (lines.length === 0) {
          toast.error('S\u00e9lectionnez au moins une quantit\u00e9 \u00e0 livrer')
          setCreating(false)
          return
        }

        await api.post('/delivery-notes', {
          salesOrderId: selectedOrderId,
          transporteur: createTransporteur || undefined,
          vehiclePlate: createVehiclePlate || undefined,
          notes: createNotes || undefined,
          plannedDate: createPlannedDate || undefined,
          lines,
        })
      } else {
        // Standalone mode
        if (!selectedClientId) {
          toast.error('Veuillez s\u00e9lectionner un client')
          setCreating(false)
          return
        }
        if (editableLines.length === 0) {
          toast.error('Ajoutez au moins une ligne de produit')
          setCreating(false)
          return
        }
        await api.post('/delivery-notes', {
          clientId: selectedClientId,
          transporteur: createTransporteur || undefined,
          vehiclePlate: createVehiclePlate || undefined,
          notes: createNotes || undefined,
          plannedDate: createPlannedDate || undefined,
          lines: editableLines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
          })),
        })
      }

      toast.success('Bon de livraison cr\u00e9\u00e9 avec succ\u00e8s')
      setCreateOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur cr\u00e9ation')
    } finally {
      setCreating(false)
    }
  }

  // ─── Editable Lines Management (Standalone Mode) ───

  const addEditableLine = () => {
    setEditableLines([
      ...editableLines,
      {
        tempId: `temp-${Date.now()}`,
        productId: '',
        quantity: 1,
        unitPrice: 0,
        tvaRate: 20,
      },
    ])
  }

  const removeEditableLine = (tempId: string) => {
    setEditableLines(editableLines.filter((l) => l.tempId !== tempId))
  }

  const updateEditableLine = (tempId: string, field: keyof EditableLine, value: string | number) => {
    setEditableLines(
      editableLines.map((l) => {
        if (l.tempId !== tempId) return l
        const updated = { ...l, [field]: value }

        if (field === 'productId' && typeof value === 'string') {
          const prod = availableProducts.find((p) => p.id === value)
          if (prod) {
            updated.unitPrice = prod.priceHT
            updated.tvaRate = prod.tvaRate
          }
        }
        return updated
      })
    )
  }

  const getEditableLineTotalHT = (line: EditableLine) => line.quantity * line.unitPrice

  const getEditableLineTotalTTC = (line: EditableLine) => {
    const ht = line.quantity * line.unitPrice
    return ht * (1 + line.tvaRate / 100)
  }

  const getGrandTotalHT = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalHT(l), 0)
  const getGrandTotalTVA = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalHT(l) * (l.tvaRate / 100), 0)
  const getGrandTotalTTC = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalTTC(l), 0)

  // ─── Edit BL ───

  const openEditDialog = (note: DeliveryNote) => {
    if (note.status !== 'draft') {
      toast.error('Seul un brouillon peut \u00eatre modifi\u00e9')
      return
    }
    setSelectedNote(note)
    setEditTransporteur(note.transporteur || '')
    setEditVehiclePlate(note.vehiclePlate || '')
    setEditNotes(note.notes || '')
    setEditPlannedDate(note.plannedDate ? format(new Date(note.plannedDate), 'yyyy-MM-dd') : '')
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!selectedNote) return
    try {
      setSaving(true)
      await api.put('/delivery-notes', {
        id: selectedNote.id,
        transporteur: editTransporteur || null,
        vehiclePlate: editVehiclePlate || null,
        notes: editNotes || null,
        plannedDate: editPlannedDate || undefined,
      })
      toast.success(`BL ${selectedNote.number} modifi\u00e9`)
      setEditOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur modification')
    } finally {
      setSaving(false)
    }
  }

  // ─── Status Actions ───

  const handleConfirm = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'confirm' })
      toast.success(`BL ${note.number} confirm\u00e9`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur confirmation')
    }
  }

  const handleDeliver = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'deliver' })
      toast.success(`BL ${note.number} marqu\u00e9 comme livr\u00e9`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur livraison')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.put('/delivery-notes', { id, action: 'cancel' })
      toast.success('BL annul\u00e9')
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation')
    }
  }

  // ─── Delete ───

  const confirmDelete = (id: string) => {
    setDeleteId(id)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/delivery-notes?id=${deleteId}`)
      toast.success('BL supprim\u00e9')
      setDeleteOpen(false)
      setDeleteId(null)
      if (detailOpen) setDetailOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  // ─── Detail ───

  const openDetail = (note: DeliveryNote) => {
    setSelectedNote(note)
    setDetailOpen(true)
  }

  // ─── Action Menu ───

  const getActions = (note: DeliveryNote) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (note.status) {
      case 'draft':
        actions.push({ label: 'Modifier', icon: <Pencil className="h-4 w-4" />, action: 'edit' })
        actions.push({ label: 'Confirmer', icon: <CheckCircle className="h-4 w-4" />, action: 'confirm' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        actions.push({ label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, action: 'delete' })
        break
      case 'confirmed':
        actions.push({ label: 'Livrer', icon: <Truck className="h-4 w-4" />, action: 'deliver' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
    }
    return actions
  }

  const executeAction = async (note: DeliveryNote, action: string) => {
    switch (action) {
      case 'edit': openEditDialog(note); break
      case 'confirm': await handleConfirm(note); break
      case 'deliver': await handleDeliver(note); break
      case 'cancel': await handleCancel(note.id); break
      case 'delete': confirmDelete(note.id); break
    }
  }

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent></Card>
      </div>
    )
  }

  // ─── Render ───

  return (
    <div className="space-y-4">
      {/* Header + Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Bons de Livraison</h2>
          <Badge variant="secondary">{deliveryNotes.length}</Badge>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau bon de livraison
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="confirmed">Confirm\u00e9</SelectItem>
            <SelectItem value="delivered">Livr\u00e9</SelectItem>
            <SelectItem value="cancelled">Annul\u00e9</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Num\u00e9ro</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Commande / Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Transporteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-10 w-10 text-muted-foreground/30" />
                        <p className="font-medium">Aucun bon de livraison</p>
                        <p className="text-sm">
                          Cliquez sur &quot;Nouveau bon de livraison&quot; pour en cr\u00e9er un.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveryNotes.map((note) => (
                    <TableRow key={note.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(note)}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-medium">{note.number}</span>
                          {note.plannedDate && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <CalendarClock className="h-2.5 w-2.5" />
                              {format(new Date(note.plannedDate), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {note.salesOrderId ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Link2 className="h-3 w-3" /> Li\u00e9
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 border-dashed">
                            <Unlink className="h-3 w-3" /> Autonome
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {note.salesOrderId ? (
                          <div>
                            <p className="font-mono text-sm">{note.salesOrder?.number}</p>
                            <p className="text-xs text-muted-foreground">{note.client.name}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">{note.client.name}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[note.status] || ''}>
                          {statusLabels[note.status] || note.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {note.transporteur || '\u2014'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-medium">
                        {formatCurrency(note.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(note)} title="D\u00e9tails">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {getActions(note).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActions(note).map((action) => (
                                  <DropdownMenuItem
                                    key={action.action}
                                    onClick={() => executeAction(note, action.action)}
                                    className={action.action === 'delete' ? 'text-destructive focus:text-destructive' : ''}
                                  >
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CREATE DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouveau bon de livraison
            </DialogTitle>
            <DialogDescription>
              Cr\u00e9ez un bon de livraison li\u00e9 \u00e0 une commande ou un BL autonome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="space-y-2">
              <Label>Type de bon de livraison</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateMode('order')}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    createMode === 'order'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <ShoppingCart className={`h-5 w-5 ${createMode === 'order' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Avec commande</p>
                    <p className="text-xs text-muted-foreground">Lier \u00e0 un bon de commande existant</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('standalone')}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    createMode === 'standalone'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <Package className={`h-5 w-5 ${createMode === 'standalone' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Sans commande</p>
                    <p className="text-xs text-muted-foreground">BL autonome (s\u00e9lection manuelle)</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Mode: With Sales Order (Partial Delivery) ── */}
            {createMode === 'order' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Commande client <span className="text-destructive">*</span></Label>
                  {loadingOrders ? (
                    <Skeleton className="h-10 w-full" />
                  ) : availableOrders.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Aucune commande pr\u00e9par\u00e9e disponible.<br />
                      Veuillez d&apos;abord pr\u00e9parer une commande ou utilisez le mode &quot;Sans commande&quot;.
                    </div>
                  ) : (
                    <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="S\u00e9lectionner une commande..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex flex-col">
                              <span className="font-mono text-sm">{order.number} - {order.client.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(order.totalTTC)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Order Lines with Delivery Tracking */}
                {selectedOrderId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Lignes \u00e0 livrer</Label>
                      {orderLinesForDelivery.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {orderLinesForDelivery.length} ligne(s) restante(s)
                        </span>
                      )}
                    </div>

                    {loadingOrderLines ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Chargement des lignes...</span>
                      </div>
                    ) : orderLinesForDelivery.length === 0 ? (
                      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Cette commande est d\u00e9j\u00e0 enti\u00e8rement livr\u00e9e.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <div className="max-h-[250px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[30%]">Produit</TableHead>
                                <TableHead className="text-right w-[12%]">Command\u00e9</TableHead>
                                <TableHead className="text-right w-[12%]">Livr\u00e9</TableHead>
                                <TableHead className="text-right w-[12%]">Restant</TableHead>
                                <TableHead className="text-center w-[10%]">Avanc.</TableHead>
                                <TableHead className="text-right w-[14%]">Qt\u00e9 BL</TableHead>
                                <TableHead className="text-right w-[15%]">Total HT</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orderLinesForDelivery.map((line) => (
                                <TableRow key={line.id}>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{line.product?.designation}</p>
                                        <p className="text-muted-foreground font-mono">{line.product?.reference}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                                  <TableCell className="text-right text-sm text-blue-600 font-medium">{line.quantityDelivered}</TableCell>
                                  <TableCell className="text-right text-sm text-amber-600 font-semibold">{line.remaining}</TableCell>
                                  <TableCell className="text-center">
                                    <DeliveryBadge percentage={line.deliveryPercentage} />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={line.remaining}
                                      step="0.01"
                                      value={deliveryQuantities[line.id] ?? 0}
                                      onChange={(e) => updateDeliveryQuantity(line.id, Math.min(parseFloat(e.target.value) || 0, line.remaining))}
                                      className="h-8 text-right text-sm"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right text-sm font-medium">
                                    {formatCurrency((deliveryQuantities[line.id] || 0) * line.unitPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {/* Totals */}
                        {hasAnyQuantity() && (
                          <div className="flex justify-end p-3 border-t bg-muted/30">
                            <div className="w-64 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total HT</span>
                                <span className="font-medium">{formatCurrency(getOrderDeliveryTotals().totalHT)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total TVA</span>
                                <span className="font-medium">{formatCurrency(getOrderDeliveryTotals().totalTVA)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 font-semibold text-base">
                                <span>Total TTC</span>
                                <span>{formatCurrency(getOrderDeliveryTotals().totalTTC)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Mode: Standalone (No Sales Order) ── */}
            {createMode === 'standalone' && (
              <>
                {/* Client Select */}
                <div className="space-y-2">
                  <Label>Client <span className="text-destructive">*</span></Label>
                  {loadingClients ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="S\u00e9lectionner un client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex flex-col">
                              <span className="text-sm">{c.raisonSociale || c.name}</span>
                              {c.ville && (
                                <span className="text-xs text-muted-foreground">{c.ville}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Product Lines */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Articles <span className="text-destructive">*</span></Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addEditableLine}>
                      <Plus className="h-3.5 w-3.5" /> Ajouter un article
                    </Button>
                  </div>

                  {loadingProducts ? (
                    <Skeleton className="h-20 w-full" />
                  ) : editableLines.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Cliquez sur &quot;Ajouter un article&quot; pour commencer.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Produit</TableHead>
                            <TableHead className="w-[15%] text-right">Qt\u00e9</TableHead>
                            <TableHead className="w-[20%] text-right">P.U. HT</TableHead>
                            <TableHead className="w-[15%] text-right">TVA %</TableHead>
                            <TableHead className="w-[15%] text-right">Total HT</TableHead>
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editableLines.map((line) => (
                            <TableRow key={line.tempId}>
                              <TableCell>
                                <Select
                                  value={line.productId}
                                  onValueChange={(val) => updateEditableLine(line.tempId, 'productId', val)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Produit..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableProducts.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        <span className="text-xs">{p.reference} - {p.designation}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={line.quantity}
                                  onChange={(e) => updateEditableLine(line.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitPrice}
                                  onChange={(e) => updateEditableLine(line.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={String(line.tvaRate)}
                                  onValueChange={(val) => updateEditableLine(line.tempId, 'tvaRate', parseFloat(val))}
                                >
                                  <SelectTrigger className="h-8 text-xs text-right">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="20">20%</SelectItem>
                                    <SelectItem value="14">14%</SelectItem>
                                    <SelectItem value="10">10%</SelectItem>
                                    <SelectItem value="7">7%</SelectItem>
                                    <SelectItem value="0">0%</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(getEditableLineTotalHT(line))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeEditableLine(line.tempId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* Totals */}
                      {editableLines.length > 0 && (
                        <div className="flex justify-end p-3 border-t bg-muted/30">
                          <div className="w-64 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total HT</span>
                              <span className="font-medium">{formatCurrency(getGrandTotalHT())}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total TVA</span>
                              <span className="font-medium">{formatCurrency(getGrandTotalTVA())}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-semibold text-base">
                              <span>Total TTC</span>
                              <span>{formatCurrency(getGrandTotalTTC())}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Planned Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Date pr\u00e9vue de livraison
              </Label>
              <Input
                type="date"
                value={createPlannedDate}
                onChange={(e) => setCreatePlannedDate(e.target.value)}
                placeholder="Date pr\u00e9vue..."
              />
            </div>

            {/* Transporteur */}
            <div className="space-y-2">
              <Label>Transporteur</Label>
              <Input
                value={createTransporteur}
                onChange={(e) => setCreateTransporteur(e.target.value)}
                placeholder="Nom du transporteur..."
              />
            </div>

            {/* Vehicle Plate */}
            <div className="space-y-2">
              <Label>Immatriculation v\u00e9hicule</Label>
              <Input
                value={createVehiclePlate}
                onChange={(e) => setCreateVehiclePlate(e.target.value)}
                placeholder="Ex: 12345-A-6"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Instructions de livraison..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                (createMode === 'order' && (!selectedOrderId || !hasAnyQuantity())) ||
                (createMode === 'standalone' && (!selectedClientId || editableLines.length === 0))
              }
            >
              {creating ? 'Cr\u00e9ation...' : 'Cr\u00e9er le BL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* EDIT DIALOG                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier le BL {selectedNote?.number}
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du bon de livraison (brouillon uniquement).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">
                    {selectedNote?.salesOrderId ? (
                      <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Li\u00e9 \u00e0 une commande</span>
                    ) : (
                      <span className="flex items-center gap-1"><Unlink className="h-3.5 w-3.5" /> BL autonome</span>
                    )}
                  </p>
                </div>
                {selectedNote?.salesOrderId && (
                  <div>
                    <span className="text-muted-foreground">Commande</span>
                    <p className="font-mono font-medium">{selectedNote?.salesOrder?.number}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote?.client.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Date pr\u00e9vue de livraison
              </Label>
              <Input
                type="date"
                value={editPlannedDate}
                onChange={(e) => setEditPlannedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Transporteur</Label>
              <Input
                value={editTransporteur}
                onChange={(e) => setEditTransporteur(e.target.value)}
                placeholder="Nom du transporteur..."
              />
            </div>

            <div className="space-y-2">
              <Label>Immatriculation v\u00e9hicule</Label>
              <Input
                value={editVehiclePlate}
                onChange={(e) => setEditVehiclePlate(e.target.value)}
                placeholder="Ex: 12345-A-6"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Instructions de livraison..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DETAIL DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Truck className="h-5 w-5" />
              {selectedNote?.number}
              {selectedNote && (
                <Badge variant="secondary" className={statusColors[selectedNote.status]}>
                  {statusLabels[selectedNote.status]}
                </Badge>
              )}
              {selectedNote && !selectedNote.salesOrderId && (
                <Badge variant="outline" className="gap-1 border-dashed text-xs">
                  <Unlink className="h-3 w-3" /> Autonome
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">
                    {selectedNote.salesOrderId ? 'Li\u00e9 \u00e0 une commande' : 'BL autonome (sans commande)'}
                  </p>
                </div>
                {selectedNote.salesOrderId && (
                  <div>
                    <span className="text-muted-foreground">Commande</span>
                    <p className="font-mono font-medium">{selectedNote.salesOrder?.number}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote.client.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de cr\u00e9ation</span>
                  <p className="font-medium">{format(new Date(selectedNote.date), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
                {selectedNote.plannedDate && (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Date pr\u00e9vue
                    </span>
                    <p className="font-medium">{format(new Date(selectedNote.plannedDate), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
                {selectedNote.deliveryDate && (
                  <div>
                    <span className="text-muted-foreground">Date de livraison</span>
                    <p className="font-medium">{format(new Date(selectedNote.deliveryDate), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
              </div>

              {selectedNote.transporteur && (
                <div className="rounded-md bg-muted/50 p-3 text-sm grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Transporteur</span>
                    <p className="font-medium">{selectedNote.transporteur}</p>
                  </div>
                  {selectedNote.vehiclePlate && (
                    <div>
                      <span className="text-muted-foreground">Immatriculation</span>
                      <p className="font-medium">{selectedNote.vehiclePlate}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Delivery Tracking (for linked orders) ── */}
              {selectedNote.salesOrderId && selectedNote.salesOrderLinesTracking && selectedNote.salesOrderLinesTracking.length > 0 && (
                <div className="rounded-md border p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    Suivi de livraison par ligne de commande
                  </h4>
                  <div className="max-h-[200px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Command\u00e9</TableHead>
                          <TableHead className="text-right">Livr\u00e9</TableHead>
                          <TableHead className="text-right">Restant</TableHead>
                          <TableHead className="text-center">Avancement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedNote.salesOrderLinesTracking.map((track) => (
                          <TableRow key={track.id}>
                            <TableCell className="text-xs">
                              {selectedNote.salesOrder?.lines.find(l => l.id === track.id)?.product?.reference} -{' '}
                              {selectedNote.salesOrder?.lines.find(l => l.id === track.id)?.product?.designation}
                            </TableCell>
                            <TableCell className="text-right">{track.quantity}</TableCell>
                            <TableCell className="text-right text-blue-600 font-medium">{track.quantityDelivered}</TableCell>
                            <TableCell className="text-right">
                              <span className={track.remainingQuantity > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>
                                {track.remainingQuantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <DeliveryBadge percentage={track.deliveryPercentage} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Lines table */}
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qt\u00e9 BL</TableHead>
                      {selectedNote.salesOrderId && (
                        <>
                          <TableHead className="text-right">D\u00e9j\u00e0 livr\u00e9</TableHead>
                          <TableHead className="text-right">Reste apr\u00e8s</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">P.U. HT</TableHead>
                      <TableHead className="text-right">Total HT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedNote.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm">{line.product?.designation}</p>
                              <p className="text-xs text-muted-foreground font-mono">{line.product?.reference}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{line.quantity}</TableCell>
                        {selectedNote.salesOrderId && (
                          <>
                            <TableCell className="text-right text-sm">
                              {line.previouslyDelivered !== undefined && line.previouslyDelivered > 0 ? (
                                <span className="text-blue-600">{line.previouslyDelivered}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {line.remainingAfterDelivery !== null && line.remainingAfterDelivery !== undefined ? (
                                <span className={line.remainingAfterDelivery > 0 ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
                                  {line.remainingAfterDelivery}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">\u2014</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(line.totalHT)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalHT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TVA</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total TTC</span>
                    <span>{formatCurrency(selectedNote.totalTTC)}</span>
                  </div>
                </div>
              </div>

              {selectedNote.notes && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{selectedNote.notes}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {selectedNote.status === 'draft' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEditDialog(selectedNote) }}>
                      <Pencil className="h-4 w-4 mr-1" /> Modifier
                    </Button>
                    <Button size="sm" onClick={() => { setDetailOpen(false); handleConfirm(selectedNote) }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Confirmer
                    </Button>
                  </>
                )}
                {(selectedNote.status === 'draft' || selectedNote.status === 'confirmed') && (
                  <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); handleCancel(selectedNote.id) }}>
                    <XCircle className="h-4 w-4 mr-1" /> Annuler
                  </Button>
                )}
                {selectedNote.status === 'confirmed' && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setDetailOpen(false); handleDeliver(selectedNote) }}>
                    <Truck className="h-4 w-4 mr-1" /> Marquer livr\u00e9
                  </Button>
                )}
                {(selectedNote.status === 'draft' || selectedNote.status === 'cancelled') && (
                  <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); confirmDelete(selectedNote.id) }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DELETE DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le bon de livraison</DialogTitle>
            <DialogDescription>
              \u00cates-vous s\u00fbr de vouloir supprimer ce bon de livraison ? Cette action est irr\u00e9versible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
