'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Eye, Warehouse, CheckCircle2, XCircle, AlertCircle, Printer } from 'lucide-react'
import { PrintHeader, PrintFooter } from '@/components/erp/shared/print-header'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────
interface ReceptionLine {
  id?: string
  purchaseOrderLineId?: string
  product?: {
    reference?: string
    designation?: string
  } | null
  expectedQty: number
  receivedQuantity: number
  qualityCheck: string
}

interface PurchaseOrderLine {
  id: string
  purchaseOrderId: string
  productId?: string
  product?: {
    reference?: string
    designation?: string
  } | null
  quantity: number
  receivedQuantity: number
  unitPrice: number
}

interface PurchaseOrder {
  id: string
  number: string
  status?: string
  supplier?: {
    name?: string
  } | null
  lines: PurchaseOrderLine[]
}

interface Reception {
  id: string
  number: string
  purchaseOrderId: string
  date: string
  purchaseOrder?: {
    number?: string
    supplier?: {
      name?: string
    } | null
  } | null
  lines: ReceptionLine[]
  notes: string | null
  totalTTC?: number
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────
const qualityConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  conforme: {
    label: 'Conforme',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
  },
  non_conforme: {
    label: 'Non conforme',
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  },
  partiel: {
    label: 'Partiel',
    icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
  }
}

function QualityBadge({ quality }: { quality: string }) {
  const cfg = qualityConfig[quality] || qualityConfig.conforme
  return (
    <Badge variant="outline" className={cfg.className}>
      <span className="flex items-center gap-1">{cfg.icon} {cfg.label}</span>
    </Badge>
  )
}

function fmtDate(d: string) {
  return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr })
}

// ── Component ──────────────────────────────────────────
export default function ReceptionsView() {
  const [receptions, setReceptions] = useState<Reception[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedReception, setSelectedReception] = useState<Reception | null>(null)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [saving, setSaving] = useState(false)
  const [stockUpdated, setStockUpdated] = useState(false)

  // Form
  const [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [notes, setNotes] = useState('')
  const [lineQtys, setLineQtys] = useState<Record<string, number>>({})
  const [lineQualities, setLineQualities] = useState<Record<string, string>>({})

  const fetchReceptions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ receptions: Reception[]; total: number }>('/receptions')
      setReceptions(data.receptions || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des réceptions')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const data = await api.get<{ orders: PurchaseOrder[]; total: number }>('/purchase-orders')
      // Only show sent or partially_received orders
      setPurchaseOrders((data.orders || []).filter((po) => po.status === 'sent' || po.status === 'partially_received'))
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchReceptions(); fetchPurchaseOrders() }, [fetchReceptions, fetchPurchaseOrders])

  const filtered = receptions.filter((r) =>
    r.number.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.number?.toLowerCase().includes(search.toLowerCase()) ||
    r.purchaseOrder?.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handlePOSelect = (poId: string) => {
    setPurchaseOrderId(poId)
    const po = purchaseOrders.find((p) => p.id === poId)
    setSelectedPO(po || null)
    if (po) {
      const qtys: Record<string, number> = {}
      const qualities: Record<string, string> = {}
      po.lines.forEach((l) => {
        qtys[l.id] = l.quantity - (l.receivedQuantity || 0)
        qualities[l.id] = 'conforme'
      })
      setLineQtys(qtys)
      setLineQualities(qualities)
    }
  }

  const handleCreate = async () => {
    if (!purchaseOrderId || !selectedPO) {
      toast.error('Veuillez sélectionner une commande')
      return
    }
    const lines = selectedPO.lines.map((l) => ({
      purchaseOrderLineId: l.id,
      expectedQty: l.quantity - (l.receivedQuantity || 0),
      receivedQuantity: lineQtys[l.id] || 0,
      qualityCheck: lineQualities[l.id] || 'conforme'
    }))
    if (lines.every((l) => l.receivedQuantity === 0)) {
      toast.error('Au moins une ligne doit avoir une quantité reçue')
      return
    }
    try {
      setSaving(true)
      setStockUpdated(false)
      await api.post('/receptions', {
        purchaseOrderId,
        notes: notes || null,
        lines
      })
      toast.success('Réception enregistrée. Le stock a été mis à jour.', { duration: 5000 })
      setStockUpdated(true)
      setDialogOpen(false)
      setPurchaseOrderId('')
      setSelectedPO(null)
      setNotes('')
      setLineQtys({})
      setLineQualities({})
      fetchReceptions()
      fetchPurchaseOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stock updated banner */}
      {stockUpdated && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Stock mis à jour</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Les quantités reçues ont été ajoutées au stock. Les mouvements de stock correspondants ont été créés.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-green-700 hover:text-green-900" onClick={() => setStockUpdated(false)}>
              Fermer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle réception
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle réception</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Commande fournisseur *</Label>
                <Select value={purchaseOrderId} onValueChange={handlePOSelect}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une commande..." /></SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.number} — {po.supplier?.name || 'Fournisseur inconnu'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPO && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Fournisseur : <span className="font-medium text-foreground">{selectedPO.supplier?.name}</span>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right w-28">Qté attendue</TableHead>
                          <TableHead className="text-right w-28">Qté reçue</TableHead>
                          <TableHead className="w-40">Contrôle qualité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPO.lines.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-sm">
                              {l.product?.reference || '—'}{' '}
                              {l.product?.designation && <span className="text-muted-foreground">— {l.product.designation}</span>}
                            </TableCell>
                            <TableCell className="text-right">{(l.quantity - (l.receivedQuantity || 0)).toLocaleString('fr-FR')}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={l.quantity - (l.receivedQuantity || 0)}
                                value={lineQtys[l.id] || 0}
                                onChange={(e) => setLineQtys((prev) => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                                className="h-8 text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={lineQualities[l.id] || 'conforme'}
                                onValueChange={(v) => setLineQualities((prev) => ({ ...prev, [l.id]: v }))}
                              >
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="conforme">Conforme</SelectItem>
                                  <SelectItem value="non_conforme">Non conforme</SelectItem>
                                  <SelectItem value="partiel">Partiel</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations sur la réception..." rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving || !purchaseOrderId}>
                {saving ? 'Enregistrement...' : 'Valider la réception'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Réception {selectedReception?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedReception && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Commande</p>
                  <p className="font-medium font-mono">{selectedReception.purchaseOrder?.number || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fournisseur</p>
                  <p className="font-medium">{selectedReception.purchaseOrder?.supplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{fmtDate(selectedReception.date || selectedReception.createdAt)}</p>
                </div>
              </div>
              {selectedReception.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3">{selectedReception.notes}</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté attendue</TableHead>
                    <TableHead className="text-right">Qté reçue</TableHead>
                    <TableHead>Qualité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReception.lines?.map((l, i) => (
                    <TableRow key={l.id || i}>
                      <TableCell className="text-sm">{l.product?.reference || '—'} {l.product?.designation && <span className="text-muted-foreground">— {l.product.designation}</span>}</TableCell>
                      <TableCell className="text-right">{l.expectedQty?.toLocaleString('fr-FR') || 0}</TableCell>
                      <TableCell className="text-right font-medium">{l.receivedQuantity?.toLocaleString('fr-FR') || 0}</TableCell>
                      <TableCell><QualityBadge quality={l.qualityCheck} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 inline mr-2" />
                Le stock a été mis à jour automatiquement à la création de cette réception.
              </div>
              <PrintFooter amount={selectedReception.totalTTC ?? 0} label="Arrêté le présent bon de réception à la somme de" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Warehouse className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search ? 'Aucune réception trouvée' : 'Aucune réception enregistrée'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead className="hidden md:table-cell">Commande</TableHead>
                    <TableHead className="hidden lg:table-cell">Fournisseur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Qualité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const hasNonConforme = r.lines?.some((l) => l.qualityCheck === 'non_conforme')
                    const allConforme = r.lines?.every((l) => l.qualityCheck === 'conforme')
                    const qualityStatus = hasNonConforme ? 'non_conforme' : allConforme ? 'conforme' : 'partiel'
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium font-mono text-sm">{r.number}</TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-sm">{r.purchaseOrder?.number || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell">{r.purchaseOrder?.supplier?.name || '—'}</TableCell>
                        <TableCell className="text-sm">{fmtDate(r.date || r.createdAt)}</TableCell>
                        <TableCell><QualityBadge quality={qualityStatus} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedReception(r); setDetailOpen(true) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!loading && filtered.length > 0 && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {filtered.length} réception{filtered.length > 1 ? 's' : ''} {search ? '(filtrée(s))' : 'au total'}
          </div>
        )}
      </Card>
    </div>
  )
}
