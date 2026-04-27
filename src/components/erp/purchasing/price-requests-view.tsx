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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Eye, Trash2, Send, FileQuestion, XCircle, Pencil, Printer } from 'lucide-react'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { printDocument, fmtDate as fmtDateP } from '@/lib/print-utils'

// ── Types ──────────────────────────────────────────────
interface Product {
  id: string
  reference: string
  designation: string
}

interface PRLineProduct {
  id: string
  reference?: string
  designation?: string
}

interface PRLine {
  id?: string
  productId: string
  product?: PRLineProduct | null
  quantity: number
}

interface SupplierQuoteSupplier {
  id: string
  name?: string
}

interface SupplierQuote {
  id: string
  number: string
  supplier?: SupplierQuoteSupplier | null
  status: string
  totalTTC: number
  createdAt: string
}

interface PriceRequest {
  id: string
  number: string
  title: string
  status: 'draft' | 'sent' | 'answered' | 'partially_answered' | 'closed' | 'cancelled'
  validUntil: string | null
  notes: string | null
  lines: PRLine[]
  supplierQuotes: SupplierQuote[]
  createdAt: string
  updatedAt: string
}

// ── Status helpers ─────────────────────────────────────
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Envoyée', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  answered: { label: 'Répondue', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  partially_answered: { label: 'Partiellement répondue', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  closed: { label: 'Fermée', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

// ── Component ──────────────────────────────────────────
export default function PriceRequestsView() {
  const [items, setItems] = useState<PriceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<PriceRequest | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([])

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ priceRequests: PriceRequest[]; total: number }>('/price-requests')
      setItems(data.priceRequests || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des demandes de prix')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products')
      setProducts(data.products || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  const filtered = items.filter((item) => {
    const matchSearch =
      item.number.toLowerCase().includes(search.toLowerCase()) ||
      item.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || item.status === statusFilter
    return matchSearch && matchStatus
  })

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', quantity: 1 }])
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i !== idx ? l : { ...l, [field]: value })))
  }

  const resetForm = () => {
    setTitle('')
    setValidUntil('')
    setNotes('')
    setLines([])
    setIsEditing(false)
  }

  const openEdit = (item: PriceRequest) => {
    setSelected(item)
    setIsEditing(true)
    setTitle(item.title || '')
    setValidUntil(item.validUntil ? item.validUntil.substring(0, 10) : '')
    setNotes(item.notes || '')
    setLines((item.lines || []).map((l) => ({ productId: l.productId, quantity: l.quantity })))
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Le titre est obligatoire')
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
      const formData = {
        title,
        validUntil: validUntil || null,
        notes: notes || null,
        lines
      }
      if (isEditing && selected) {
        await api.put('/price-requests', { id: selected.id, ...formData })
        toast.success('Demande de prix modifiée')
      } else {
        await api.post('/price-requests', formData)
        toast.success('Demande de prix créée')
      }
      setDialogOpen(false)
      resetForm()
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || isEditing ? 'Erreur lors de la modification' : 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const handleTransition = async (id: string, newStatus: string) => {
    try {
      setTransitioning(id)
      await api.put('/price-requests', { id, status: newStatus })
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`)
      fetchItems()
      // Refresh detail if open
      if (detailOpen && selected?.id === id) {
        const data = await api.get<{ priceRequests: PriceRequest[]; total: number }>(`/price-requests`)
        const updated = data.priceRequests?.find((r) => r.id === id)
        if (updated) setSelected(updated)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setTransitioning(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id)
      await api.delete(`/price-requests?id=${id}`)
      toast.success('Demande supprimée')
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  const handleViewDetail = async (item: PriceRequest) => {
    setSelected(item)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence ou titre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="sent">Envoyée</SelectItem>
              <SelectItem value="answered">Répondue</SelectItem>
              <SelectItem value="partially_answered">Partiellement répondue</SelectItem>
              <SelectItem value="closed">Fermée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); setIsEditing(false) } }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Modifier la demande' : 'Nouvelle demande de prix'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Titre *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la demande..." />
                </div>
                <div className="space-y-2">
                  <Label>Valide jusqu'au</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Produits demandés</Label>
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
                          <TableHead className="w-64">Produit</TableHead>
                          <TableHead className="w-28 text-right">Quantité</TableHead>
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
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes..." rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier' : 'Créer la demande')}
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
              <FileQuestion className="h-5 w-5" />
              Demande {selected?.number}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Titre</p>
                  <p className="font-medium">{selected.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <StatusBadge status={selected.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Valide jusqu'au</p>
                  <p className="font-medium">{fmtDate(selected.validUntil)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Créée le</p>
                  <p className="font-medium">{fmtDate(selected.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modifiée le</p>
                  <p className="font-medium">{fmtDate(selected.updatedAt)}</p>
                </div>
              </div>
              {selected.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3">{selected.notes}</p>
              )}

              {/* Lines */}
              <div>
                <h4 className="font-medium text-sm mb-2">Produits demandés</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right w-28">Quantité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.lines?.map((l, i) => (
                      <TableRow key={l.id || i}>
                        <TableCell className="text-sm">{l.product?.reference || '—'} {l.product?.designation && <span className="text-muted-foreground">— {l.product.designation}</span>}</TableCell>
                        <TableCell className="text-right">{l.quantity.toLocaleString('fr-FR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Supplier quotes */}
              <div>
                <h4 className="font-medium text-sm mb-2">Devis fournisseurs reçus</h4>
                {selected.supplierQuotes && selected.supplierQuotes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.supplierQuotes.map((sq) => (
                        <TableRow key={sq.id}>
                          <TableCell className="font-mono text-sm">{sq.number}</TableCell>
                          <TableCell className="text-sm">{sq.supplier?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              sq.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              sq.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            }>
                              {sq.status === 'received' ? 'Reçu' : sq.status === 'accepted' ? 'Accepté' : sq.status === 'rejected' ? 'Rejeté' : sq.status === 'expired' ? 'Expiré' : sq.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{fmtMoney(sq.totalTTC)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun devis reçu pour cette demande</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!selected) return
              const statusLabel = statusConfig[selected.status]?.label || selected.status
              printDocument({
                title: 'DEMANDE DE PRIX',
                docNumber: selected.number,
                infoGrid: [
                  { label: 'Titre', value: selected.title, colspan: 2 },
                  { label: 'Statut', value: statusLabel },
                  { label: "Valide jusqu'au", value: fmtDateP(selected.validUntil || '') },
                ],
                columns: [
                  { label: 'Produit' },
                  { label: 'Quantité', align: 'right' },
                ],
                rows: (selected.lines || []).map(l => [
                  { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                  { value: l.quantity, align: 'right' },
                ]),
                totals: [],
                notes: selected.notes || undefined,
              })
            }}>
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
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search || statusFilter !== 'all' ? 'Aucune demande trouvée' : 'Aucune demande de prix'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Valide jusqu'au</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Nb. lignes</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Nb. devis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onDoubleClick={() => openEdit(item)}>
                      <TableCell className="font-medium font-mono text-sm">{item.number}</TableCell>
                      <TableCell className="max-w-48 truncate">{item.title}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{fmtDate(item.validUntil)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{item.lines?.length || 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{item.supplierQuotes?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleViewDetail(item) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {item.status === 'draft' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(item) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {item.status === 'draft' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={(e) => { e.stopPropagation(); handleTransition(item.id, 'sent') }}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Envoyer
                            </Button>
                          )}
                          {(item.status === 'sent' || item.status === 'partially_answered' || item.status === 'answered') && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={(e) => { e.stopPropagation(); handleTransition(item.id, 'closed') }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Fermer
                            </Button>
                          )}
                          {item.status === 'draft' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette demande ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    La demande &quot;{item.number}&quot; sera définitivement supprimée. Seuls les brouillons peuvent être supprimés.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deleting === item.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleting === item.id ? 'Suppression...' : 'Supprimer'}
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
            {filtered.length} demande{filtered.length > 1 ? 's' : ''} de prix {search || statusFilter !== 'all' ? '(filtrée(s))' : 'au total'}
          </div>
        )}
      </Card>
    </div>
  )
}
