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
import { Plus, Search, Eye, Trash2, FileText, CheckCircle2, XCircle, Pencil, Printer } from 'lucide-react'
import { ProductCombobox, ProductOption, useProductSearch } from '@/components/erp/shared/product-combobox'
import { PrintHeader, PrintFooter } from '@/components/erp/shared/print-header'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'
import { printDocument, fmtMoney as fmtMoneyP, fmtDate as fmtDateP } from '@/lib/print-utils'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { cn } from '@/lib/utils'

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

// ── Types ──────────────────────────────────────────────
interface Product {
  id: string
  reference: string
  designation: string
}

interface Supplier {
  id: string
  name: string
}

interface SQLine {
  id?: string
  productId: string
  product?: { reference: string; designation: string }
  quantity: number
  unitPrice: number
  tvaRate: number
}

interface PriceRequest {
  id: string
  number: string
  title: string
  status?: string
}

interface SupplierQuote {
  id: string
  number: string
  supplierId: string
  supplier?: { id: string; name: string }
  priceRequestId?: string
  priceRequest?: { id: string; number: string; title: string }
  status: 'received' | 'accepted' | 'rejected' | 'expired'
  validUntil: string | null
  deliveryDelay: number | null
  paymentTerms: string | null
  lines: SQLine[]
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  createdAt: string
  updatedAt: string
}

// ── Status helpers ─────────────────────────────────────
const statusConfig: Record<string, { label: string; className: string }> = {
  received: { label: 'Reçu', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  accepted: { label: 'Accepté', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  expired: { label: 'Expiré', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.received
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
export default function SupplierQuotesView() {
  const [items, setItems] = useState<SupplierQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<SupplierQuote | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [allProducts, setAllProducts] = useState<ProductOption[]>([])
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([])
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [priceRequestId, setPriceRequestId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [deliveryDelay, setDeliveryDelay] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number; tvaRate: number }>>([])

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ supplierQuotes: SupplierQuote[]; total: number }>('/supplier-quotes')
      setItems(data.supplierQuotes || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des devis fournisseurs')
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
      const data = await api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=achat&active=true')
      setAllProducts(data.products || [])
    } catch { /* silent */ }
  }, [])

  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(allProducts)

  const fetchPriceRequests = useCallback(async () => {
    try {
      const data = await api.get<{ priceRequests: PriceRequest[] }>('/price-requests')
      setPriceRequests((data.priceRequests || []).filter((pr) => pr.status === 'sent' || pr.status === 'answered' || pr.status === 'partially_answered'))
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchSuppliers(); fetchProducts(); fetchPriceRequests() }, [fetchSuppliers, fetchProducts, fetchPriceRequests])

  const filtered = items.filter((item) => {
    const matchSearch =
      item.number.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || item.status === statusFilter
    const matchSupplier = supplierFilter === 'all' || item.supplierId === supplierFilter
    return matchSearch && matchStatus && matchSupplier
  })

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
        const product = allProducts.find((p) => p.id === value)
        if (product) {
          updated.tvaRate = 20
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
    setPriceRequestId('')
    setValidUntil('')
    setDeliveryDelay('')
    setPaymentTerms('')
    setLines([])
    setIsEditing(false)
    resetLineSearches()
  }

  const openEdit = (item: SupplierQuote) => {
    setSelected(item)
    setIsEditing(true)
    setSupplierId(item.supplierId || '')
    setPriceRequestId(item.priceRequestId || '')
    setValidUntil(item.validUntil ? item.validUntil.substring(0, 10) : '')
    setDeliveryDelay(item.deliveryDelay != null ? String(item.deliveryDelay) : '')
    setPaymentTerms(item.paymentTerms || '')
    setLines((item.lines || []).map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, tvaRate: l.tvaRate })))
    setDialogOpen(true)
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
      const formData = {
        supplierId,
        priceRequestId: priceRequestId || null,
        validUntil: validUntil || null,
        deliveryDelay: deliveryDelay ? parseInt(deliveryDelay) : null,
        paymentTerms: paymentTerms || null,
        lines
      }
      if (isEditing && selected) {
        await api.put('/supplier-quotes', { id: selected.id, ...formData })
        toast.success('Devis fournisseur modifié')
      } else {
        await api.post('/supplier-quotes', formData)
        toast.success('Devis fournisseur créé')
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
      await api.put('/supplier-quotes', { id, status: newStatus })
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`)
      fetchItems()
      if (detailOpen && selected?.id === id) {
        const data = await api.get<{ supplierQuotes: SupplierQuote[] }>('/supplier-quotes')
        const updated = (data.supplierQuotes || []).find((q) => q.id === id)
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
      await api.delete(`/supplier-quotes?id=${id}`)
      toast.success('Devis supprimé')
      fetchItems()
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
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence ou fournisseur..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setExpandedId(null) }}
              className="pl-9"
            />
          </div>
          <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setExpandedId(null) }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Fournisseur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les fournisseurs</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setExpandedId(null) }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="received">Reçu</SelectItem>
              <SelectItem value="accepted">Accepté</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
              <SelectItem value="expired">Expiré</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="achats" sub="devis-fournisseurs" />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { resetForm(); setIsEditing(false) } }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau devis
            </Button>
          </DialogTrigger>
          <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <FileText className="h-5 w-5" />
                    Modifier — {selected?.number}
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    Nouveau devis fournisseur
                  </>
                )}
              </DialogTitle>
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
                  <Label>Demande de prix (optionnel)</Label>
                  <Select value={priceRequestId} onValueChange={setPriceRequestId}>
                    <SelectTrigger><SelectValue placeholder="Lier à une demande..." /></SelectTrigger>
                    <SelectContent>
                      {priceRequests.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>{pr.number} — {pr.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Valide jusqu'au</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Délai de livraison (jours)</Label>
                  <Input type="number" min={0} value={deliveryDelay} onChange={(e) => setDeliveryDelay(e.target.value)} placeholder="ex: 7" />
                </div>
                <div className="space-y-2">
                  <Label>Conditions de paiement</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30 jours">30 jours</SelectItem>
                      <SelectItem value="60 jours">60 jours</SelectItem>
                      <SelectItem value="comptant">Comptant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lignes du devis</Label>
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
                              <ProductCombobox
                                products={getFilteredProducts(idx)}
                                value={line.productId}
                                searchValue={lineSearches[idx] || ''}
                                onSearchChange={(val) => setLineSearches(prev => ({ ...prev, [idx]: val }))}
                                onSelect={(productId) => {
                                  updateLine(idx, 'productId', productId)
                                  setLineSearches(prev => ({ ...prev, [idx]: '' }))
                                }}
                                priceField="purchasePrice"
                                className="h-8"
                              />
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
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier' : 'Créer le devis')}
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
              <FileText className="h-5 w-5" />
              Devis {selected?.number}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Fournisseur</p>
                  <p className="font-medium">{selected.supplier?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <StatusBadge status={selected.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Valide jusqu'au</p>
                  <p className="font-medium">{fmtDate(selected.validUntil)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Demande de prix</p>
                  <p className="font-medium font-mono">{selected.priceRequest?.number || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Délai de livraison</p>
                  <p className="font-medium">{selected.deliveryDelay ? `${selected.deliveryDelay} jours` : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conditions paiement</p>
                  <p className="font-medium">{selected.paymentTerms || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Créée le</p>
                  <p className="font-medium">{fmtDate(selected.createdAt)}</p>
                </div>
              </div>
              {selected.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3">{selected.notes}</p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lines?.map((l, i) => (
                    <TableRow key={l.id || i}>
                      <TableCell className="text-sm">{l.product ? `${l.product.reference} — ${l.product.designation}` : (l.productId ? `ID: ${l.productId.slice(0, 8)}...` : '—')}</TableCell>
                      <TableCell className="text-right">{(l.quantity || 0).toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{fmtMoney(l.unitPrice || 0)}</TableCell>
                      <TableCell className="text-right">{l.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney((l.quantity || 0) * (l.unitPrice || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                <span>Total HT : <strong>{fmtMoney(selected.totalHT || 0)}</strong></span>
                <span>TVA : <strong>{fmtMoney(selected.totalTVA || 0)}</strong></span>
                <span>Total TTC : <strong>{fmtMoney(selected.totalTTC || 0)}</strong></span>
              </div>
              <PrintFooter amount={selected.totalTTC} label="Arrêté le présent devis fournisseur à la somme de" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!selected) return
              printDocument({
                title: 'DEVIS FOURNISSEUR',
                docNumber: selected.number,
                infoGrid: [
                  { label: 'Fournisseur', value: selected.supplier?.name || '—' },
                  { label: "Valide jusqu'au", value: fmtDateP(selected.validUntil || '') },
                  { label: 'Délai livraison', value: selected.deliveryDelay ? `${selected.deliveryDelay} jours` : '—' },
                  { label: 'Créée le', value: fmtDateP(selected.createdAt) },
                ],
                columns: [
                  { label: 'Produit' },
                  { label: 'Qté', align: 'right' },
                  { label: 'P.U. HT', align: 'right' },
                  { label: 'TVA', align: 'right' },
                  { label: 'Total HT', align: 'right' },
                ],
                rows: (selected.lines || []).map(l => [
                  { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                  { value: l.quantity, align: 'right' },
                  { value: fmtMoneyP(l.unitPrice), align: 'right' },
                  { value: `${l.tvaRate}%`, align: 'right' },
                  { value: fmtMoneyP(l.quantity * l.unitPrice), align: 'right' },
                ]),
                totals: [
                  { label: 'Total HT', value: fmtMoneyP(selected.totalHT) },
                  { label: 'TVA', value: fmtMoneyP(selected.totalTVA) },
                  { label: 'Total TTC', value: fmtMoneyP(selected.totalTTC), bold: true },
                ],
                subSections: buildSupplierVisaHtml(selected.notes),
                amountInWords: numberToFrenchWords(selected.totalTTC),
                amountInWordsLabel: 'Arrêté le présent devis fournisseur à la somme de',
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
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search || statusFilter !== 'all' || supplierFilter !== 'all' ? 'Aucun devis trouvé' : 'Aucun devis fournisseur'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Fournisseur</TableHead>
                    <TableHead className="hidden lg:table-cell">Valide jusqu'au</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className={cn("cursor-pointer", expandedId === item.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} onDoubleClick={() => openEdit(item)}>
                      <TableCell className="font-medium font-mono text-sm">{item.number}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="hidden md:table-cell">{item.supplier?.name || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{fmtDate(item.validUntil)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">{fmtMoney(item.totalTTC || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelected(item); setDetailOpen(true) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {item.status === 'received' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(item) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {item.status === 'received' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={(e) => { e.stopPropagation(); handleTransition(item.id, 'accepted') }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Accepter
                            </Button>
                          )}
                          {item.status === 'received' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                              disabled={transitioning === item.id}
                              onClick={(e) => { e.stopPropagation(); handleTransition(item.id, 'rejected') }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Rejeter
                            </Button>
                          )}
                          {item.status === 'received' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Le devis &quot;{item.number}&quot; sera définitivement supprimé. Seuls les devis reçus peuvent être supprimés.
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
            {filtered.length} devis{filtered.length > 1 ? '' : ''} fournisseur{filtered.length > 1 ? 's' : ''} {search || statusFilter !== 'all' || supplierFilter !== 'all' ? '(filtré(s))' : 'au total'}
          </div>
        )}
      </Card>

      {/* Inline detail panel */}
      {expandedId && (() => {
        const item = items.find(q => q.id === expandedId)
        if (!item) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{item.number}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{item.supplier?.name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setSelected(item); setDetailOpen(true) }}>
                    <Eye className="h-4 w-4 mr-1" />Ouvrir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!item) return
                    printDocument({
                      title: 'DEVIS FOURNISSEUR',
                      docNumber: item.number,
                      infoGrid: [
                        { label: 'Fournisseur', value: item.supplier?.name || '—' },
                        { label: "Valide jusqu'au", value: fmtDateP(item.validUntil || '') },
                        { label: 'Délai livraison', value: item.deliveryDelay ? `${item.deliveryDelay} jours` : '—' },
                        { label: 'Créée le', value: fmtDateP(item.createdAt) },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'TVA', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: (item.lines || []).map(l => [
                        { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                        { value: fmtMoneyP(l.unitPrice), align: 'right' },
                        { value: `${l.tvaRate}%`, align: 'right' },
                        { value: fmtMoneyP(l.quantity * l.unitPrice), align: 'right' },
                      ]),
                      totals: [
                        { label: 'Total HT', value: fmtMoneyP(item.totalHT) },
                        { label: 'TVA', value: fmtMoneyP(item.totalTVA) },
                        { label: 'Total TTC', value: fmtMoneyP(item.totalTTC), bold: true },
                      ],
                      subSections: buildSupplierVisaHtml(item.notes),
                      amountInWords: numberToFrenchWords(item.totalTTC),
                      amountInWordsLabel: 'Arrêté le présent devis fournisseur à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />Imprimer
                  </Button>
                  {item.status === 'received' && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4 mr-1" />Modifier
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Info cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Valide jusqu'au</span>
                  <p className="font-medium">{fmtDate(item.validUntil)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Délai livraison</span>
                  <p className="font-medium">{item.deliveryDelay ? `${item.deliveryDelay} jours` : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Conditions paiement</span>
                  <p className="font-medium">{item.paymentTerms || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Lignes</span>
                  <p className="font-medium">{item.lines?.length || 0}</p>
                </div>
              </div>

              {/* Lines table */}
              {item.lines && item.lines.length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right w-[70px]">Qté</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. HT</TableHead>
                        <TableHead className="text-right w-[70px]">TVA</TableHead>
                        <TableHead className="text-right w-[100px]">Total HT</TableHead>
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
                          <TableCell className="text-right">{fmtMoney(l.unitPrice || 0)}</TableCell>
                          <TableCell className="text-right">{l.tvaRate}%</TableCell>
                          <TableCell className="text-right font-medium">{fmtMoney((l.quantity || 0) * (l.unitPrice || 0))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {item.notes}</div>
              )}

              {/* Totals */}
              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{fmtMoney(item.totalHT || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{fmtMoney(item.totalTVA || 0)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span>{fmtMoney(item.totalTTC || 0)}</span></div>
                <div className="text-sm italic text-muted-foreground pt-1">{numberToFrenchWords(item.totalTTC || 0)} dirhams</div>
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
