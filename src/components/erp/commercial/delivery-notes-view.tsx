'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Truck, MoreVertical, CheckCircle, XCircle, Eye, Trash2, Package, FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface DeliveryNoteLine {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
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

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmé',
  delivered: 'Livré',
  cancelled: 'Annulé'
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

export default function DeliveryNotesView() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)

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

  const openDetail = (note: DeliveryNote) => {
    setSelectedNote(note)
    setDetailOpen(true)
  }

  const handleConfirm = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'confirm' })
      toast.success(`Bon de livraison ${note.number} confirmé`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur confirmation')
    }
  }

  const handleDeliver = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'deliver' })
      toast.success(`Bon de livraison ${note.number} marqué comme livré`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur livraison')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.put('/delivery-notes', { id, action: 'cancel' })
      toast.success('Bon de livraison annulé')
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/delivery-notes?id=${id}`)
      toast.success('Bon de livraison supprimé')
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  const getActions = (note: DeliveryNote) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (note.status) {
      case 'draft':
        actions.push({ label: 'Confirmer', icon: <CheckCircle className="h-4 w-4" />, action: 'confirm' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
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
      case 'confirm':
        await handleConfirm(note)
        break
      case 'deliver':
        await handleDeliver(note)
        break
      case 'cancel':
        await handleCancel(note.id)
        break
    }
  }

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Bons de Livraison</h2>
          <Badge variant="secondary">{deliveryNotes.length}</Badge>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="delivered">Livré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
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
                  <TableHead>Numéro</TableHead>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Nb articles</TableHead>
                  <TableHead className="hidden lg:table-cell">Date de livraison</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter !== 'all' ? 'Aucun bon de livraison trouvé.' : 'Aucun bon de livraison enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveryNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-mono font-medium">{note.number}</TableCell>
                      <TableCell className="font-mono text-sm">{note.salesOrder.number}</TableCell>
                      <TableCell>{note.client.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[note.status] || ''}>
                          {statusLabels[note.status] || note.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {note.salesOrder.lines.length} article(s)
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {note.deliveryDate
                          ? format(new Date(note.deliveryDate), 'dd/MM/yyyy', { locale: fr })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(note)}>
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
                                  <DropdownMenuItem key={action.action} onClick={() => executeAction(note, action.action)}>
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {(note.status === 'draft' || note.status === 'cancelled') && (
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(note.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="ml-2">Supprimer</span>
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

      {/* Detail Dialog */}
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
                {selectedNote.transporteur && (
                  <div>
                    <span className="text-muted-foreground">Transporteur</span>
                    <p className="font-medium">{selectedNote.transporteur}</p>
                  </div>
                )}
                {selectedNote.vehiclePlate && (
                  <div>
                    <span className="text-muted-foreground">Immatriculation</span>
                    <p className="font-medium">{selectedNote.vehiclePlate}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Date de livraison</span>
                  <p className="font-medium">
                    {selectedNote.deliveryDate
                      ? format(new Date(selectedNote.deliveryDate), 'dd/MM/yyyy', { locale: fr })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Lines Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedNote.salesOrder.lines.map((line) => (
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
                      <span className="text-muted-foreground">Notes :</span>{' '}
                      <span>{selectedNote.notes}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
