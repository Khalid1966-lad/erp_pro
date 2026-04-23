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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, Eye, Send, ArrowDownToLine, Package, CircleDot } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────
interface Product {
  id: string
  reference: string
  designation: string
  purchasePrice?: number
  tvaRate?: number
}

interface Supplier {
  id: string
  name: string
}

interface POLine {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  quantityReceived: number
  product?: { id: string; reference: string; designation: string }
}

interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  supplier?: { id: string; name: string }
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled'
  expectedDate: string | null
  lines: POLine[]
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  createdAt: string
  updatedAt: string
}

// ── Status helpers ─────────────────────────────────────
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  draft: { label: 'Brouillon', variant: 'secondary', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Envoyée', variant: 'default', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  partially_received: { label: 'Partiellement reçue', variant: 'default', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  received: { label: 'Reçue', variant: 'default', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled: { label: 'Annulée', variant: 'destructive', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

// ── Component ──────────────────────────────────────────
export default function PurchaseOrdersView() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number; tvaRate: number }>>([])

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ orders: PurchaseOrder[]; total: number }>('/purchase-orders')
      setOrders(data.orders || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des commandes')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api.get<{ suppliers: Supplier[] }>('/suppliers')
      setSuppliers(data.suppliers || [])
    } catch { /* silent */ }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products')
      setProducts(data.products || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchSuppliers(); fetchProducts() }, [fetchSuppliers, fetchProducts])

  const filtered = orders.filter((o) =>
    o.number.toLowerCase().includes(search.toLowerCase()) ||
    o.supplier?.name.toLowerCase().includes(search.toLowerCase())
  )

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0, tvaRate: 20 }])
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      if (field === 'productId') {
        const product = products.find((p) => p.id === value)
        if (product) {
          updated.unitPrice = product.purchasePrice || 0
          updated.tvaRate = product.tvaRate || 20
        }
      }
      return updated
    }))
  }

  const lineTotalHT = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0)
  const lineTotalTVA = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice * l.tvaRate / 100), 0)
  const lineTotalTTC = lineTotalHT + lineTotalTVA

  const resetForm = () => {
    setSupplierId('')
    setExpectedDate('')
    setNotes('')
    setLines([])
  }

  const handleCreate = async () => {
    if (!supplierId) {
      toast.error('Veuillez sélectionner un fournisseur')
      return
    }
    if (lines.length === 0) {
      toast.error('Ajoutez au moins une ligne')
      return
    }
    const validLines = lines.every((l) => l.productId && l.quantity > 0)
    if (!validLines) {
      toast.error('Toutes les lignes doivent avoir un produit et une quantité')
      return
    }
    try {
      setSaving(true)
      await api.post('/purchase-orders', {
        supplierId,
        expectedDate: expectedDate || null,
        notes: notes || null,
        lines
      })
      toast.success('Commande fournisseur créée')
      setDialogOpen(false)
      resetForm()
      fetchOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const handleTransition = async (id: string, newStatus: string) => {
    try {
      setTransitioning(id)
      await api.put('/purchase-orders', { id, status: newStatus })
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`)
      fetchOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setTransitioning(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id)
      await api.delete(`/purchase-orders?id=${id}`)
      toast.success('Commande supprimée')
      fetchOrders()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence ou fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle commande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle commande fournisseur</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fournisseur *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date de livraison prévue</Label>
                  <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lignes de commande</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ajouter une ligne
                  </Button>
                </div>
                {lines.length === 0 ? (
                  <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                    Aucune ligne. Cliquez sur &quot;Ajouter une ligne&quot; pour commencer.
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Produit</TableHead>
                          <TableHead className="w-24 text-right">Quantité</TableHead>
                          <TableHead className="w-32 text-right">Prix unit. HT</TableHead>
                          <TableHead className="w-24 text-right">TVA %</TableHead>
                          <TableHead className="w-28 text-right">Total HT</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Select value={line.productId} onValueChange={(v) => updateLine(idx, 'productId', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produit..." /></SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.reference} — {p.designation}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 0)} className="h-8 text-right" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" min={0} value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="h-8 text-right" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.1" min={0} max={100} value={line.tvaRate} onChange={(e) => updateLine(idx, 'tvaRate', parseFloat(e.target.value) || 0)} className="h-8 text-right" />
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {fmtMoney(line.quantity * line.unitPrice)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {lines.length > 0 && (
                  <div className="flex justify-end gap-6 text-sm pt-2">
                    <span>Total HT : <strong>{fmtMoney(lineTotalHT)}</strong></span>
                    <span>TVA : <strong>{fmtMoney(lineTotalTVA)}</strong></span>
                    <span>Total TTC : <strong>{fmtMoney(lineTotalTTC)}</strong></span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes..." rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Création...' : 'Créer la commande'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Commande {selectedOrder?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Fournisseur</p>
                  <p className="font-medium">{selectedOrder.supplier?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Date prévue</p>
                  <p className="font-medium">{fmtDate(selectedOrder.expectedDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Créée le</p>
                  <p className="font-medium">{fmtDate(selectedOrder.createdAt)}</p>
                </div>
              </div>
              {selectedOrder.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3">{selectedOrder.notes}</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Reçue</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.lines?.map((l, i) => (
                    <TableRow key={l.id || i}>
                      <TableCell className="text-sm">{l.product?.reference || '—'} {l.product?.designation && <span className="text-muted-foreground">— {l.product.designation}</span>}</TableCell>
                      <TableCell className="text-right">{l.quantity.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{l.quantityReceived?.toLocaleString('fr-FR') || 0}</TableCell>
                      <TableCell className="text-right">{fmtMoney(l.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(l.quantity * l.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                <span>Total HT : <strong>{fmtMoney(selectedOrder.totalHT)}</strong></span>
                <span>TVA : <strong>{fmtMoney(selectedOrder.totalTVA)}</strong></span>
                <span>Total TTC : <strong>{fmtMoney(selectedOrder.totalTTC)}</strong></span>
              </div>
            </div>
          )}
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
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ArrowDownToLine className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search ? 'Aucune commande trouvée' : 'Aucune commande fournisseur'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Fournisseur</TableHead>
                    <TableHead className="hidden lg:table-cell">Date prévue</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium font-mono text-sm">{o.number}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="hidden md:table-cell">{o.supplier?.name || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{fmtDate(o.expectedDate)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">{fmtMoney(o.totalTTC)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedOrder(o); setDetailOpen(true) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {o.status === 'draft' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === o.id}
                              onClick={() => handleTransition(o.id, 'sent')}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Envoyer
                            </Button>
                          )}
                          {o.status === 'sent' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === o.id}
                              onClick={() => handleTransition(o.id, 'received')}
                            >
                              <CircleDot className="h-3.5 w-3.5" />
                              Marquer reçue
                            </Button>
                          )}
                          {o.status === 'draft' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    La commande &quot;{o.number}&quot; sera définitivement supprimée. Seuls les brouillons peuvent être supprimés.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(o.id)}
                                    disabled={deleting === o.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleting === o.id ? 'Suppression...' : 'Supprimer'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!loading && filtered.length > 0 && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {filtered.length} commande{filtered.length > 1 ? 's' : ''} {search ? '(filtrée(s))' : 'au total'}
          </div>
        )}
      </Card>
    </div>
  )
}
