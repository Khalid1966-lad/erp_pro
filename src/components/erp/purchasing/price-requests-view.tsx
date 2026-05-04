'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
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
import { Plus, Search, Eye, Trash2, Send, FileQuestion, XCircle, Pencil, Printer, CheckCircle2, FileText, Clock, MessageSquare, BarChart3, RefreshCw } from 'lucide-react'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'
import { ProductCombobox, useProductSearch } from '@/components/erp/shared/product-combobox'
import { printDocument, fmtDate as fmtDateP } from '@/lib/print-utils'
import { useNavStore } from '@/lib/stores'

/** HTML pour encadrés Notes + Visa Fournisseur / Visa Administration dans les impressions */
function buildSupplierVisaHtml(notes?: string | null): string {
  const notesHtml = notes
    ? `<div style="border:1px solid #999; border-radius:4px; padding:8px; margin-bottom:16px;">
         <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:4px;">Notes</div>
         <div style="font-size:11px; min-height:40px;">${notes.replace(/\n/g, '<br/>')}</div>
       </div>`
    : ''

  const visaHtml = `
    <div style="display:flex; gap:24px; margin-top:24px;">
      <div style="flex:1; border:1px solid #999; border-radius:4px; padding:8px; text-align:center;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:60px;">Visa Fournisseur</div>
        <div style="font-size:10px; color:#999; border-top:1px dashed #ccc; padding-top:4px;">Nom, Prénom & Cachet</div>
      </div>
      <div style="flex:1; border:1px solid #999; border-radius:4px; padding:8px; text-align:center;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:60px;">Visa Administration</div>
        <div style="font-size:10px; color:#999; border-top:1px dashed #ccc; padding-top:4px;">Nom, Prénom & Cachet</div>
      </div>
    </div>`

  return notesHtml + visaHtml
}
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

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

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <FileText className="h-4 w-4" />, color: 'text-gray-400' },
    sent: { icon: <Send className="h-4 w-4" />, color: 'text-blue-500' },
    answered: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-500' },
    partially_answered: { icon: <MessageSquare className="h-4 w-4" />, color: 'text-yellow-500' },
    closed: { icon: <Clock className="h-4 w-4" />, color: 'text-slate-500' },
    cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
  }
  const c = config[status]
  if (!c) return null
  return <span className={c.color}>{c.icon}</span>
}

function IconLegend({ items }: { items: Array<{ icon: React.ReactNode; label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={item.color}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

const priceRequestLegendItems = [
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Brouillon', color: 'text-gray-400' },
  { icon: <Send className="h-3.5 w-3.5" />, label: 'Envoyée', color: 'text-blue-500' },
  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Répondue', color: 'text-green-500' },
  { icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'Partiellement répondue', color: 'text-yellow-500' },
  { icon: <Clock className="h-3.5 w-3.5" />, label: 'Fermée', color: 'text-slate-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulée', color: 'text-red-500' },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function fmtMoney(n: number) {
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

// ── Component ──────────────────────────────────────────
export default function PriceRequestsView() {
  const isSuperAdmin = useIsSuperAdmin()
  const { openComparison } = useNavStore()
  const navigationParams = useNavStore((s) => s.navigationParams)

  const [items, setItems] = useState<PriceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Apply navigation params from dashboard
  useEffect(() => {
    if (navigationParams?.status === 'open') {
      // Price requests that are not closed or cancelled
      setStatusFilter('sent')
      useNavStore.setState({ navigationParams: null })
    }
  }, [navigationParams])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<PriceRequest | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([])
  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(products)

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
      const data = await api.get<{ products: Product[] }>('/products?dropdown=true')
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
    resetLineSearches()
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
              onChange={(e) => { setSearch(e.target.value); setExpandedId(null) }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setExpandedId(null) }}>
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
        <div className="flex items-center gap-2">
          <HelpButton section="achats" sub="demandes-prix" />
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (o) { resetLineSearches() } else { resetForm(); setIsEditing(false) } }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
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
                          <TableHead className="min-w-[300px]">Produit</TableHead>
                          <TableHead className="w-28 text-right">Quantité</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <ProductCombobox
                                products={getFilteredProducts(idx)}
                                value={line.productId}
                                searchValue={lineSearches[idx] || ''}
                                onSearchChange={(v) => setLineSearches(prev => ({ ...prev, [idx]: v }))}
                                onSelect={(productId) => updateLine(idx, 'productId', productId)}
                                placeholder="Produit..."
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 0)} className="h-8 text-right" />
                            </TableCell>
                            <TableCell>
                              {isSuperAdmin && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              )}
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
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
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
                        <TableCell className="text-right">{(l.quantity || 0).toLocaleString('fr-FR')}</TableCell>
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
                          <TableCell className="text-right font-medium">{fmtMoney(sq.totalTTC || 0)}</TableCell>
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
            {selected && (selected.status === 'sent' || selected.status === 'partially_answered' || selected.status === 'answered') && (selected.supplierQuotes?.length || 0) >= 2 && (
              <Button className="text-primary hover:text-primary" onClick={() => { setDetailOpen(false); openComparison(selected.id) }}>
                <BarChart3 className="h-4 w-4 mr-1" />
                Comparer les offres
              </Button>
            )}
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
                subSections: buildSupplierVisaHtml(selected.notes),
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
              <IconLegend items={priceRequestLegendItems} />
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
                    <TableRow key={item.id} className={cn("cursor-pointer", expandedId === item.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} onDoubleClick={() => openEdit(item)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="font-medium font-mono text-sm">{item.number}</span>
                        </div>
                      </TableCell>
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
                              variant="ghost" size="sm" className="h-8 text-xs gap-1 text-primary hover:text-primary"
                              disabled={transitioning === item.id || (item.supplierQuotes?.length || 0) < 2}
                              onClick={(e) => { e.stopPropagation(); openComparison(item.id) }}
                              title="Comparer les offres (minimum 2 devis requis)"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                              Comparer
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
                          {item.status === 'draft' && isSuperAdmin && (
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

      {/* Inline Detail Panel */}
      {expandedId && (() => {
        const item = items.find(i => i.id === expandedId)
        if (!item) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileQuestion className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{item.number}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetail(item)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  {(item.status === 'sent' || item.status === 'partially_answered' || item.status === 'answered') && (item.supplierQuotes?.length || 0) >= 2 && (
                    <Button variant="outline" size="sm" className="text-primary hover:text-primary" onClick={() => openComparison(item.id)}>
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Comparer
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!item) return
                    const statusLabel = statusConfig[item.status]?.label || item.status
                    printDocument({
                      title: 'DEMANDE DE PRIX',
                      docNumber: item.number,
                      infoGrid: [
                        { label: 'Titre', value: item.title, colspan: 2 },
                        { label: 'Statut', value: statusLabel },
                        { label: "Valide jusqu'au", value: fmtDateP(item.validUntil || '') },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Quantité', align: 'right' },
                      ],
                      rows: (item.lines || []).map(l => [
                        { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                      ]),
                      totals: [],
                      subSections: buildSupplierVisaHtml(item.notes),
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Validité</span>
                  <p className="font-medium">{fmtDate(item.validUntil)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Nb. lignes</span>
                  <p className="font-medium">{item.lines?.length || 0}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Nb. devis</span>
                  <p className="font-medium">{item.supplierQuotes?.length || 0}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Créée le</span>
                  <p className="font-medium">{fmtDate(item.createdAt)}</p>
                </div>
              </div>

              {item.lines && item.lines.length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right w-28">Quantité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.lines.map((l) => (
                        <TableRow key={l.id || l.productId}>
                          <TableCell className="font-medium text-sm">
                            <span className="font-mono text-muted-foreground mr-2">{l.product?.reference || ''}</span>
                            {l.product?.designation || '—'}
                          </TableCell>
                          <TableCell className="text-right">{(l.quantity || 0).toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {item.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {item.notes}</div>
              )}

              {item.supplierQuotes && item.supplierQuotes.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Devis fournisseurs reçus</h4>
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
                      {item.supplierQuotes.map((sq) => (
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
                          <TableCell className="text-right font-medium">{fmtMoney(sq.totalTTC || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
