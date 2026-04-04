'use client'

import { useState, useEffect } from 'react'
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
  Truck, MoreVertical, CheckCircle, XCircle, Eye, Trash2, Package, FileText, Plus, Pencil
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

// ─── Interfaces ───

interface SalesOrderOption {
  id: string
  number: string
  status: string
  client: { id: string; name: string }
  totalHT: number
  totalTTC: number
}

interface DeliveryNoteLine {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  salesOrderLineId?: string
  product?: { id: string; reference: string; designation: string }
}

interface DeliveryNote {
  id: string
  number: string
  status: string
  date: string
  deliveryDate: string | null
  transporteur: string | null
  vehiclePlate: string | null
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  salesOrder: {
    id: string
    number: string
    lines: DeliveryNoteLine[]
  }
  client: { id: string; name: string }
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

  // Create form
  const [availableOrders, setAvailableOrders] = useState<SalesOrderOption[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [createTransporteur, setCreateTransporteur] = useState('')
  const [createVehiclePlate, setCreateVehiclePlate] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)

  // Edit form
  const [editTransporteur, setEditTransporteur] = useState('')
  const [editVehiclePlate, setEditVehiclePlate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ─── Fetch ───

  const fetchDeliveryNotes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const data = await api.get<{ deliveryNotes: DeliveryNote[]; total: number }>(`/delivery-notes?${params.toString()}`)
      setDeliveryNotes(data.deliveryNotes)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement bons de livraison')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeliveryNotes()
  }, [statusFilter])

  // ─── Create BL ───

  const openCreateDialog = async () => {
    setCreateOpen(true)
    setSelectedOrderId('')
    setCreateTransporteur('')
    setCreateVehiclePlate('')
    setCreateNotes('')
    try {
      setLoadingOrders(true)
      const [prepData, partData] = await Promise.all([
        api.get<{ salesOrders: SalesOrderOption[] }>('/sales-orders?status=prepared&limit=100'),
        api.get<{ salesOrders: SalesOrderOption[] }>('/sales-orders?status=partially_delivered&limit=100'),
      ])
      const all = [...(prepData.salesOrders || []), ...(partData.salesOrders || [])]
      setAvailableOrders(all)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement commandes')
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedOrderId) {
      toast.error('Veuillez s\u00e9lectionner une commande')
      return
    }
    try {
      setCreating(true)
      await api.post('/delivery-notes', {
        salesOrderId: selectedOrderId,
        transporteur: createTransporteur || undefined,
        vehiclePlate: createVehiclePlate || undefined,
        notes: createNotes || undefined,
      })
      toast.success('Bon de livraison cr\u00e9\u00e9 avec succ\u00e8s')
      setCreateOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur cr\u00e9ation')
    } finally {
      setCreating(false)
    }
  }

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
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Transporteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Date livraison</TableHead>
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
                          {statusFilter !== 'all'
                            ? 'Aucun BL trouv\u00e9 pour ce statut.'
                            : 'Cliquez sur "Nouveau bon de livraison" pour en cr\u00e9er un.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveryNotes.map((note) => (
                    <TableRow key={note.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(note)}>
                      <TableCell className="font-mono font-medium">{note.number}</TableCell>
                      <TableCell className="font-mono text-sm">{note.salesOrder.number}</TableCell>
                      <TableCell>{note.client.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[note.status] || ''}>
                          {statusLabels[note.status] || note.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {note.transporteur || '\u2014'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {note.deliveryDate
                          ? format(new Date(note.deliveryDate), 'dd/MM/yyyy', { locale: fr })
                          : '\u2014'}
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

      {/* ═══ CREATE DIALOG ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouveau bon de livraison
            </DialogTitle>
            <DialogDescription>
              S\u00e9lectionnez une commande pr\u00e9par\u00e9e pour cr\u00e9er un bon de livraison.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Select Sales Order */}
            <div className="space-y-2">
              <Label>Commande client *</Label>
              {loadingOrders ? (
                <Skeleton className="h-10 w-full" />
              ) : availableOrders.length === 0 ? (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Aucune commande pr\u00e9par\u00e9e disponible.<br />
                  Veuillez d&apos;abord pr\u00e9parer une commande.
                </div>
              ) : (
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
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
            <Button onClick={handleCreate} disabled={creating || !selectedOrderId}>
              {creating ? 'Cr\u00e9ation...' : 'Cr\u00e9er le BL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT DIALOG ═══ */}
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
                  <span className="text-muted-foreground">Commande</span>
                  <p className="font-mono font-medium">{selectedNote?.salesOrder.number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote?.client.name}</p>
                </div>
              </div>
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

      {/* ═══ DETAIL DIALOG ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {selectedNote?.number}
              {selectedNote && (
                <Badge variant="secondary" className={statusColors[selectedNote.status]}>
                  {statusLabels[selectedNote.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Commande</span>
                  <p className="font-mono font-medium">{selectedNote.salesOrder.number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote.client.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Transporteur</span>
                  <p className="font-medium">{selectedNote.transporteur || '\u2014'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Immatriculation</span>
                  <p className="font-medium">{selectedNote.vehiclePlate || '\u2014'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de cr\u00e9ation</span>
                  <p className="font-medium">
                    {format(new Date(selectedNote.date), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de livraison</span>
                  <p className="font-medium">
                    {selectedNote.deliveryDate
                      ? format(new Date(selectedNote.deliveryDate), 'dd/MM/yyyy', { locale: fr })
                      : '\u2014'}
                  </p>
                </div>
              </div>

              {/* Lines Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qt\u00e9</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedNote.lines && selectedNote.lines.length > 0
                    ? selectedNote.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {line.product?.reference} - {line.product?.designation}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.totalHT)}</TableCell>
                        </TableRow>
                      ))
                    : selectedNote.salesOrder.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {line.product?.reference} - {line.product?.designation}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.totalHT)}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalHT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TVA</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-base">
                    <span>Total TTC</span>
                    <span>{formatCurrency(selectedNote.totalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedNote.notes && (
                <div className="text-sm">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Notes : </span>
                      <span>{selectedNote.notes}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions in detail */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                {selectedNote.status === 'draft' && (
                  <>
                    <Button variant="outline" className="gap-2" onClick={() => { setDetailOpen(false); openEditDialog(selectedNote) }}>
                      <Pencil className="h-4 w-4" /> Modifier
                    </Button>
                    <Button className="gap-2" onClick={() => { setDetailOpen(false); handleConfirm(selectedNote) }}>
                      <CheckCircle className="h-4 w-4" /> Confirmer
                    </Button>
                  </>
                )}
                {selectedNote.status === 'confirmed' && (
                  <Button className="gap-2" onClick={() => { setDetailOpen(false); handleDeliver(selectedNote) }}>
                    <Truck className="h-4 w-4" /> Marquer comme livr\u00e9
                  </Button>
                )}
                {(selectedNote.status === 'draft' || selectedNote.status === 'cancelled') && (
                  <Button variant="destructive" className="gap-2" onClick={() => { setDetailOpen(false); confirmDelete(selectedNote.id) }}>
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRM DIALOG ═══ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer le bon de livraison
            </DialogTitle>
            <DialogDescription>
              Cette action est irr\u00e9versible. \u00cates-vous s\u00fbr de vouloir supprimer ce bon de livraison ?
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
