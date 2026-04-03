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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  ClipboardList, MoreVertical, Play, CheckCircle, XCircle, Eye, Trash2, Package
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

interface SalesOrderLine {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT?: number
  quantityPrepared?: number
  product?: { id: string; reference: string; designation: string }
}

interface Preparation {
  id: string
  number: string
  status: string
  completedAt: string | null
  notes: string | null
  salesOrder: {
    id: string
    number: string
    client: { id: string; name: string }
    lines: SalesOrderLine[]
  }
}

interface ValidateLine {
  salesOrderLineId: string
  preparedQuantity: number
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée'
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

export default function PreparationsView() {
  const [preparations, setPreparations] = useState<Preparation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [validateOpen, setValidateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPrep, setSelectedPrep] = useState<Preparation | null>(null)
  const [validateLines, setValidateLines] = useState<ValidateLine[]>([])
  const [validateNotes, setValidateNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPreparations = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const data = await api.get<{ preparations: Preparation[]; total: number }>(`/preparations?${params.toString()}`)
      setPreparations(data.preparations)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement préparations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPreparations()
  }, [statusFilter])

  const openDetail = (prep: Preparation) => {
    setSelectedPrep(prep)
    setDetailOpen(true)
  }

  const openValidate = (prep: Preparation) => {
    setSelectedPrep(prep)
    setValidateLines(
      prep.salesOrder.lines.map((line) => ({
        salesOrderLineId: line.id,
        preparedQuantity: (line.quantityPrepared || 0)
      }))
    )
    setValidateNotes('')
    setValidateOpen(true)
  }

  const handleStart = async (prep: Preparation) => {
    try {
      await api.put('/preparations', { id: prep.id, action: 'start' })
      toast.success(`Préparation ${prep.number} démarrée`)
      fetchPreparations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    }
  }

  const handleValidate = async () => {
    if (!selectedPrep) return
    const hasQuantity = validateLines.some((l) => l.preparedQuantity > 0)
    if (!hasQuantity) {
      toast.error('Veuillez indiquer au moins une quantité préparée')
      return
    }

    try {
      setSaving(true)
      await api.put('/preparations', {
        id: selectedPrep.id,
        action: 'validate',
        lines: validateLines,
        notes: validateNotes || undefined
      })
      toast.success(`Préparation ${selectedPrep.number} validée`)
      setValidateOpen(false)
      fetchPreparations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur validation')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.put('/preparations', { id, action: 'cancel' })
      toast.success('Préparation annulée')
      fetchPreparations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/preparations?id=${id}`)
      toast.success('Préparation supprimée')
      fetchPreparations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  const getActions = (prep: Preparation) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (prep.status) {
      case 'pending':
        actions.push({ label: 'Démarrer', icon: <Play className="h-4 w-4" />, action: 'start' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
      case 'in_progress':
        actions.push({ label: 'Valider', icon: <CheckCircle className="h-4 w-4" />, action: 'validate' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
    }
    return actions
  }

  const executeAction = async (prep: Preparation, action: string) => {
    switch (action) {
      case 'start':
        await handleStart(prep)
        break
      case 'validate':
        openValidate(prep)
        break
      case 'cancel':
        await handleCancel(prep.id)
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
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Préparations</h2>
          <Badge variant="secondary">{preparations.length}</Badge>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
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
                  <TableHead className="hidden lg:table-cell">Complétée le</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preparations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {statusFilter !== 'all' ? 'Aucune préparation trouvée.' : 'Aucune préparation enregistrée.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  preparations.map((prep) => (
                    <TableRow key={prep.id}>
                      <TableCell className="font-mono font-medium">{prep.number}</TableCell>
                      <TableCell className="font-mono text-sm">{prep.salesOrder.number}</TableCell>
                      <TableCell>{prep.salesOrder.client.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[prep.status] || ''}>
                          {statusLabels[prep.status] || prep.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {prep.salesOrder.lines.length} article(s)
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {prep.completedAt ? format(new Date(prep.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(prep)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {getActions(prep).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActions(prep).map((action) => (
                                  <DropdownMenuItem key={action.action} onClick={() => executeAction(prep, action.action)}>
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {(prep.status === 'pending' || prep.status === 'cancelled') && (
                                  <>
                                    <DropdownMenuContent />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(prep.id)}>
                                      <Trash2 className="h-4 w-4" />
                                      <span className="ml-2">Supprimer</span>
                                    </DropdownMenuItem>
                                  </>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {selectedPrep?.number}
              {selectedPrep && (
                <Badge variant="secondary" className={statusColors[selectedPrep.status]}>
                  {statusLabels[selectedPrep.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedPrep && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Commande</span>
                  <p className="font-mono font-medium">{selectedPrep.salesOrder.number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedPrep.salesOrder.client.name}</p>
                </div>
                {selectedPrep.completedAt && (
                  <div>
                    <span className="text-muted-foreground">Complétée le</span>
                    <p className="font-medium">{format(new Date(selectedPrep.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté commandée</TableHead>
                    <TableHead className="text-right">Qté préparée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPrep.salesOrder.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {line.product?.reference} - {line.product?.designation}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={((line.quantityPrepared || 0) >= line.quantity) ? 'default' : 'secondary'}>
                          {line.quantityPrepared || 0} / {line.quantity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedPrep.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {selectedPrep.notes}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Validate Dialog */}
      <Dialog open={validateOpen} onOpenChange={setValidateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Valider la préparation {selectedPrep?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedPrep && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Commande :</span>{' '}
                <span className="font-mono font-medium">{selectedPrep.salesOrder.number}</span>
                {' — '}
                <span className="font-medium">{selectedPrep.salesOrder.client.name}</span>
              </div>

              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté commandée</TableHead>
                      <TableHead className="w-[120px]">Qté préparée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPrep.salesOrder.lines.map((line, idx) => {
                      const remainingQty = line.quantity - (line.quantityPrepared || 0)
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            {line.product?.reference} - {line.product?.designation}
                          </TableCell>
                          <TableCell className="text-right">{remainingQty}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={remainingQty}
                              step={1}
                              value={validateLines[idx]?.preparedQuantity || 0}
                              onChange={(e) => {
                                const updated = [...validateLines]
                                updated[idx] = { ...updated[idx], preparedQuantity: Math.min(parseFloat(e.target.value) || 0, remainingQty) }
                                setValidateLines(updated)
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={validateNotes} onChange={(e) => setValidateNotes(e.target.value)} placeholder="Notes sur la préparation..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateOpen(false)}>Annuler</Button>
            <Button onClick={handleValidate} disabled={saving}>
              {saving ? 'Validation...' : 'Valider la préparation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
