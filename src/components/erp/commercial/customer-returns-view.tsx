'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Pencil, Eye, Trash2, RotateCcw, CheckCircle2, XCircle, Printer, Clock, AlertCircle, ShieldCheck, Ban, FileText, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'
import { PrintHeader, PrintFooter } from '@/components/erp/shared/print-header'
import { EntityCombobox } from '@/components/erp/shared/entity-combobox'
import { ProductCombobox, useProductSearch } from '@/components/erp/shared/product-combobox'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney as fmtMoneyP, fmtDate as fmtDateP } from '@/lib/print-utils'

/** HTML pour encadrés Notes + Visa Client / Visa Administration dans les impressions */
function buildVisaHtml(notes?: string | null): string {
  const notesHtml = notes
    ? `<div style="border:1px solid #999; border-radius:4px; padding:8px; margin-bottom:16px;">
         <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:4px;">Notes</div>
         <div style="font-size:11px; min-height:40px;">${notes.replace(/\n/g, '<br/>')}</div>
       </div>`
    : ''

  const visaHtml = `
    <div style="display:flex; gap:24px; margin-top:24px;">
      <div style="flex:1; border:1px solid #999; border-radius:4px; padding:8px; text-align:center;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:60px;">Visa Client</div>
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

interface Client {
  id: string
  name: string
  raisonSociale?: string
}

interface CRLine {
  id?: string
  productId: string
  product?: {
    reference: string
    designation: string
  }
  quantity: number
  unitPrice: number
  tvaRate: number
  qualityCheck?: string
  qualityNotes?: string
}

interface CustomerReturn {
  id: string
  number: string
  clientId: string
  client?: {
    id: string
    name: string
    raisonSociale?: string
  }
  deliveryNote?: { id: string; number: string }
  invoice?: { id: string; number: string }
  status: 'draft' | 'validated' | 'restocked' | 'cancelled'
  returnDate: string
  reason: string | null
  notes: string | null
  lines: CRLine[]
  totalHT: number
  totalTVA: number
  totalTTC: number
  createdAt: string
  updatedAt: string
}

// ── Status helpers ─────────────────────────────────────
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  validated: { label: 'Validé', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  restocked: { label: 'Remis en stock', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const qualityConfig: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: 'En attente', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', Icon: Clock },
  conforme: { label: 'Conforme', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', Icon: CheckCircle2 },
  non_conforme: { label: 'Non conforme', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', Icon: XCircle },
  partiel: { label: 'Partiel', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', Icon: AlertCircle },
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <FileText className="h-4 w-4" />, color: 'text-slate-400' },
    validated: { icon: <ShieldCheck className="h-4 w-4" />, color: 'text-blue-500' },
    restocked: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-500' },
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

const customerReturnLegendItems = [
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Brouillon', color: 'text-slate-400' },
  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Validé', color: 'text-blue-500' },
  { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Remis en stock', color: 'text-green-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulé', color: 'text-red-500' },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function QualityBadge({ quality }: { quality: string }) {
  const cfg = qualityConfig[quality] || qualityConfig.pending
  return (
    <Badge variant="outline" className={cn('gap-1', cfg.className)}>
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function fmtMoney(n: number) {
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

// ── Component ──────────────────────────────────────────
export default function CustomerReturnsView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [items, setItems] = useState<CustomerReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [selected, setSelected] = useState<CustomerReturn | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState<Array<{ id: string; number: string }>>([])
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string }>>([])
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [clientId, setClientId] = useState('')
  const [deliveryNoteId, setDeliveryNoteId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number; tvaRate: number }>>([])
  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(products)

  // Quality check form state
  const [qualityLines, setQualityLines] = useState<Array<{ id: string; qualityCheck: string; qualityNotes: string }>>([])

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ customerReturns: CustomerReturn[]; total: number }>('/customer-returns')
      setItems(data.customerReturns || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des bons de retour')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get<{ clients: Client[] }>('/clients?dropdown=true')
      setClients(data.clients || [])
    } catch { /* silent */ }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products?dropdown=true')
      setProducts(data.products || [])
    } catch { /* silent */ }
  }, [])

  const fetchRelated = useCallback(async () => {
    try {
      const [dns, invs] = await Promise.all([
        api.get<{ deliveryNotes: Array<{ id: string; number: string }> }>('/delivery-notes').then(d => d.deliveryNotes || []).catch(() => []),
        api.get<{ invoices: Array<{ id: string; number: string }> }>('/invoices').then(d => d.invoices || []).catch(() => []),
      ])
      setDeliveryNotes(dns)
      setInvoices(invs)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchClients(); fetchProducts(); fetchRelated() }, [fetchClients, fetchProducts, fetchRelated])

  const filtered = items.filter((item) => {
    const clientName = item.client?.raisonSociale || item.client?.name || ''
    const matchSearch =
      item.number.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || item.status === statusFilter
    return matchSearch && matchStatus
  })

  const addLine = () => {
    setLines((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0, tvaRate: 20 }])
  }

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i !== idx ? l : { ...l, [field]: value })))
  }

  const lineTotalHT = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0)
  const lineTotalTVA = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice * l.tvaRate / 100), 0)
  const lineTotalTTC = lineTotalHT + lineTotalTVA

  const resetForm = () => {
    setClientId('')
    setDeliveryNoteId('')
    setInvoiceId('')
    setReason('')
    setNotes('')
    setLines([])
    setIsEditing(false)
    resetLineSearches()
  }

  const openEdit = (item: CustomerReturn) => {
    setIsEditing(true)
    setSelected(item)
    setClientId(item.clientId)
    setDeliveryNoteId(item.deliveryNote?.id || '')
    setInvoiceId(item.invoice?.id || '')
    setReason(item.reason || '')
    setNotes(item.notes || '')
    setLines(item.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      tvaRate: l.tvaRate,
    })))
    setDialogOpen(true)
  }

  const openQualityCheck = (item: CustomerReturn) => {
    setSelected(item)
    setQualityLines(item.lines.map((l) => ({
      id: l.id || '',
      qualityCheck: l.qualityCheck || 'pending',
      qualityNotes: l.qualityNotes || '',
    })))
    setQualityOpen(true)
  }

  const handleCreate = async () => {
    if (!clientId) {
      toast.error('Veuillez sélectionner un client')
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
      if (isEditing && selected) {
        await api.put('/customer-returns', {
          id: selected.id,
          reason: reason || null,
          notes: notes || null,
          lines,
        })
        toast.success('Bon de retour modifié')
      } else {
        await api.post('/customer-returns', {
          clientId,
          deliveryNoteId: deliveryNoteId || null,
          invoiceId: invoiceId || null,
          reason: reason || null,
          notes: notes || null,
          lines,
        })
        toast.success('Bon de retour créé')
      }
      setDialogOpen(false)
      resetForm()
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || (isEditing ? 'Erreur lors de la modification' : 'Erreur lors de la création'))
    } finally {
      setSaving(false)
    }
  }

  const handleTransition = async (id: string, newStatus: string) => {
    try {
      setTransitioning(id)
      await api.put('/customer-returns', { id, status: newStatus })
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`)
      fetchItems()
      if (detailOpen && selected?.id === id) {
        const data = await api.get<{ customerReturns: CustomerReturn[]; total: number }>('/customer-returns')
        const updated = (data.customerReturns || []).find((r) => r.id === id)
        if (updated) setSelected(updated)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setTransitioning(null)
    }
  }

  const handleQualitySave = async () => {
    if (!selected) return
    try {
      setSaving(true)
      await api.put('/customer-returns', {
        id: selected.id,
        qualityLines,
      })
      toast.success('Contrôle qualité mis à jour')
      setQualityOpen(false)
      fetchItems()
      // Refresh selected
      const data = await api.get<{ customerReturns: CustomerReturn[]; total: number }>('/customer-returns')
      const updated = (data.customerReturns || []).find((r) => r.id === selected.id)
      if (updated) setSelected(updated)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du contrôle qualité')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id)
      await api.delete(`/customer-returns?id=${id}`)
      toast.success('Bon de retour supprimé')
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  const clientDisplayName = (c: Client | undefined) =>
    c?.raisonSociale || c?.name || '—'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence ou client..."
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
              <SelectItem value="validated">Validé</SelectItem>
              <SelectItem value="restocked">Remis en stock</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="bons-retour-clients" />
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (o) { resetLineSearches() } else { resetForm(); setIsEditing(false) } }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau retour
              </Button>
            </DialogTrigger>
            <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Modifier le bon de retour' : 'Nouveau bon de retour client'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <EntityCombobox
                    entities={clients}
                    value={clientId}
                    onValueChange={setClientId}
                    placeholder="Sélectionner..."
                    searchPlaceholder="Rechercher par raison sociale, nom, ICE..."
                    disabled={isEditing}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bon de livraison lié (optionnel)</Label>
                    <Select value={deliveryNoteId} onValueChange={setDeliveryNoteId}>
                      <SelectTrigger><SelectValue placeholder="BL..." /></SelectTrigger>
                      <SelectContent>
                        {deliveryNotes.map((dn) => (
                          <SelectItem key={dn.id} value={dn.id}>{dn.number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Facture liée (optionnel)</Label>
                    <Select value={invoiceId} onValueChange={setInvoiceId}>
                      <SelectTrigger><SelectValue placeholder="Facture..." /></SelectTrigger>
                      <SelectContent>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>{inv.number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lines */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Articles retournés</Label>
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
                                <Input type="number" step="0.01" min={0} value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="h-8 text-right" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.1" min={0} max={100} value={line.tvaRate} onChange={(e) => updateLine(idx, 'tvaRate', parseFloat(e.target.value) || 0)} className="h-8 text-right" />
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {fmtMoney(line.quantity * line.unitPrice)}
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
                  {lines.length > 0 && (
                    <div className="flex justify-end gap-6 text-sm pt-2">
                      <span>Total HT : <strong>{fmtMoney(lineTotalHT)}</strong></span>
                      <span>TVA : <strong>{fmtMoney(lineTotalTVA)}</strong></span>
                      <span>Total TTC : <strong>{fmtMoney(lineTotalTTC)}</strong></span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Motif du retour</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif du retour..." rows={2} />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes..." rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier' : 'Créer le retour')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quality Check Dialog */}
      <Dialog open={qualityOpen} onOpenChange={setQualityOpen}>
        <DialogContent resizable className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Contrôle qualité — {selected?.number}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Définissez le résultat du contrôle qualité pour chaque ligne. Les articles conformes et partiels seront remis en stock lors du passage au statut &quot;Remis en stock&quot;.
              </p>
              <div className="space-y-3">
                {qualityLines.map((ql, idx) => {
                  const line = selected.lines?.find((l) => l.id === ql.id)
                  return (
                    <div key={ql.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end border rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {line?.product?.reference || '—'} — {line?.product?.designation || ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qté : {(line?.quantity || 0).toLocaleString('fr-FR')} × {fmtMoney(line?.unitPrice || 0)}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Select
                          value={ql.qualityCheck}
                          onValueChange={(v) => setQualityLines((prev) => prev.map((l, i) => i === idx ? { ...l, qualityCheck: v } : l))}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="conforme">Conforme</SelectItem>
                            <SelectItem value="non_conforme">Non conforme</SelectItem>
                            <SelectItem value="partiel">Partiel</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Notes qualité..."
                          value={ql.qualityNotes}
                          onChange={(e) => setQualityLines((prev) => prev.map((l, i) => i === idx ? { ...l, qualityNotes: e.target.value } : l))}
                          className="h-8 flex-1 sm:w-48"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityOpen(false)}>Annuler</Button>
            <Button onClick={handleQualitySave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer le contrôle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Retour client {selected?.number}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{clientDisplayName(selected.client)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <StatusBadge status={selected.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">Bon de livraison</p>
                  <p className="font-medium font-mono">{selected.deliveryNote?.number || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facture</p>
                  <p className="font-medium font-mono">{selected.invoice?.number || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Date de retour</p>
                  <p className="font-medium">{fmtDate(selected.returnDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Créée le</p>
                  <p className="font-medium">{fmtDate(selected.createdAt)}</p>
                </div>
              </div>
              {selected.reason && (
                <p className="text-sm bg-muted/50 rounded-md p-3">
                  <span className="font-medium">Motif : </span>{selected.reason}
                </p>
              )}
              {selected.notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3">
                  <span className="font-medium">Notes : </span>{selected.notes}
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                    <TableHead className="text-center">Contrôle qualité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lines?.map((l, i) => (
                    <TableRow key={l.id || i}>
                      <TableCell className="text-sm">{l.product?.reference || '—'} {l.product?.designation && <span className="text-muted-foreground">— {l.product?.designation}</span>}</TableCell>
                      <TableCell className="text-right">{(l.quantity || 0).toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-right">{fmtMoney(l.unitPrice || 0)}</TableCell>
                      <TableCell className="text-right">{l.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney((l.quantity || 0) * (l.unitPrice || 0))}</TableCell>
                      <TableCell className="text-center">
                        <QualityBadge quality={l.qualityCheck || 'pending'} />
                        {l.qualityNotes && <p className="text-xs text-muted-foreground mt-1">{l.qualityNotes}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                <span>Total HT : <strong>{fmtMoney(selected.totalHT || 0)}</strong></span>
                <span>TVA : <strong>{fmtMoney(selected.totalTVA || 0)}</strong></span>
                <span>Total TTC : <strong>{fmtMoney(selected.totalTTC || 0)}</strong></span>
              </div>
              <PrintFooter amount={selected.totalTTC} label="Arrêté le présent bon de retour client à la somme de" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!selected) return
              printDocument({
                title: 'BON DE RETOUR CLIENT',
                docNumber: selected.number,
                infoGrid: [
                  { label: 'Client', value: clientDisplayName(selected.client) },
                  { label: 'Bon de livraison', value: selected.deliveryNote?.number || '—' },
                  { label: 'Facture', value: selected.invoice?.number || '—' },
                  { label: 'Date de retour', value: fmtDateP(selected.returnDate) },
                ],
                columns: [
                  { label: 'Produit' },
                  { label: 'Qté', align: 'right' },
                  { label: 'P.U. HT', align: 'right' },
                  { label: 'TVA', align: 'right' },
                  { label: 'Total HT', align: 'right' },
                  { label: 'Contrôle', align: 'center' },
                ],
                rows: (selected.lines || []).map(l => [
                  { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                  { value: l.quantity, align: 'right' },
                  { value: fmtMoneyP(l.unitPrice), align: 'right' },
                  { value: `${l.tvaRate}%`, align: 'right' },
                  { value: fmtMoneyP(l.quantity * l.unitPrice), align: 'right' },
                  { value: qualityConfig[l.qualityCheck || 'pending']?.label || 'En attente', align: 'center' },
                ]),
                totals: [
                  { label: 'Total HT', value: fmtMoneyP(selected.totalHT), negative: true },
                  { label: 'TVA', value: fmtMoneyP(selected.totalTVA), negative: true },
                  { label: 'Total TTC', value: fmtMoneyP(selected.totalTTC), bold: true, negative: true },
                ],
                subSections: buildVisaHtml(selected.reason || selected.notes),
                negativeTotals: true,
                amountInWords: numberToFrenchWords(selected.totalTTC),
                amountInWordsLabel: 'Arrêté le présent bon de retour client à la somme de',
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
              <RotateCcw className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search || statusFilter !== 'all' ? 'Aucun retour trouvé' : 'Aucun bon de retour client'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <IconLegend items={customerReturnLegendItems} />
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className={cn("cursor-pointer", expandedId === item.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} onDoubleClick={() => openEdit(item)}>
                      <TableCell className="font-medium font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span>{item.number}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="hidden md:table-cell">{clientDisplayName(item.client)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{fmtDate(item.returnDate)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">{fmtMoney(item.totalTTC || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelected(item); setDetailOpen(true) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {item.status === 'draft' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {item.status === 'draft' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={() => handleTransition(item.id, 'validated')}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Valider
                            </Button>
                          )}
                          {item.status === 'validated' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={() => openQualityCheck(item)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Contrôle
                            </Button>
                          )}
                          {item.status === 'validated' && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1"
                              disabled={transitioning === item.id}
                              onClick={() => handleTransition(item.id, 'restocked')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Stocker
                            </Button>
                          )}
                          {(item.status === 'draft' || item.status === 'validated') && (
                            <Button
                              variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                              disabled={transitioning === item.id}
                              onClick={() => handleTransition(item.id, 'cancelled')}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Annuler
                            </Button>
                          )}
                          {item.status === 'draft' && isSuperAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer ce retour ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Le bon &quot;{item.number}&quot; sera définitivement supprimé. Seuls les brouillons peuvent être supprimés.
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
            {filtered.length} bon{filtered.length > 1 ? 's' : ''} de retour {search || statusFilter !== 'all' ? '(filtré(s))' : 'au total'}
          </div>
        )}
      </Card>

      {/* Inline Detail Panel */}
      {expandedId && (() => {
        const ei = items.find(r => r.id === expandedId)
        if (!ei) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{ei.number}</span>
                      <StatusBadge status={ei.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{clientDisplayName(ei.client)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setSelected(ei); setDetailOpen(true) }}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    printDocument({
                      title: 'BON DE RETOUR CLIENT',
                      docNumber: ei.number,
                      infoGrid: [
                        { label: 'Client', value: clientDisplayName(ei.client) },
                        { label: 'Bon de livraison', value: ei.deliveryNote?.number || '—' },
                        { label: 'Facture', value: ei.invoice?.number || '—' },
                        { label: 'Date de retour', value: fmtDateP(ei.returnDate) },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'TVA', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                        { label: 'Contrôle', align: 'center' },
                      ],
                      rows: (ei.lines || []).map(l => [
                        { value: `${l.product?.reference || '—'} — ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                        { value: fmtMoneyP(l.unitPrice), align: 'right' },
                        { value: `${l.tvaRate}%`, align: 'right' },
                        { value: fmtMoneyP(l.quantity * l.unitPrice), align: 'right' },
                        { value: qualityConfig[l.qualityCheck || 'pending']?.label || 'En attente', align: 'center' },
                      ]),
                      totals: [
                        { label: 'Total HT', value: fmtMoneyP(ei.totalHT), negative: true },
                        { label: 'TVA', value: fmtMoneyP(ei.totalTVA), negative: true },
                        { label: 'Total TTC', value: fmtMoneyP(ei.totalTTC), bold: true, negative: true },
                      ],
                      subSections: buildVisaHtml(ei.reason || ei.notes),
                      negativeTotals: true,
                      amountInWords: numberToFrenchWords(ei.totalTTC),
                      amountInWordsLabel: 'Arrêté le présent bon de retour client à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  {ei.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(ei)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Client</span>
                  <p className="font-medium">{clientDisplayName(ei.client)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Bon de livraison</span>
                  <p className="font-medium font-mono">{ei.deliveryNote?.number || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Facture</span>
                  <p className="font-medium font-mono">{ei.invoice?.number || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Date de retour</span>
                  <p className="font-medium">{fmtDate(ei.returnDate)}</p>
                </div>
              </div>

              {(ei.lines || []).length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right w-[70px]">Qté</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. HT</TableHead>
                        <TableHead className="text-right w-[60px]">TVA</TableHead>
                        <TableHead className="text-right w-[100px]">Total HT</TableHead>
                        <TableHead className="text-center w-[120px]">Contrôle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ei.lines || []).map((l, i) => (
                        <TableRow key={l.id || i}>
                          <TableCell className="font-medium text-sm">{l.product?.reference || '—'} <span className="text-muted-foreground">— {l.product?.designation || ''}</span></TableCell>
                          <TableCell className="text-right">{(l.quantity || 0).toLocaleString('fr-FR')}</TableCell>
                          <TableCell className="text-right">{fmtMoney(l.unitPrice || 0)}</TableCell>
                          <TableCell className="text-right">{l.tvaRate}%</TableCell>
                          <TableCell className="text-right font-medium">{fmtMoney((l.quantity || 0) * (l.unitPrice || 0))}</TableCell>
                          <TableCell className="text-center"><QualityBadge quality={l.qualityCheck || 'pending'} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ei.reason && (
                <p className="text-sm bg-muted/50 rounded-md p-3">
                  <span className="font-medium">Motif : </span>{ei.reason}
                </p>
              )}

              <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                <span>Total HT : <strong>{fmtMoney(ei.totalHT || 0)}</strong></span>
                <span>TVA : <strong>{fmtMoney(ei.totalTVA || 0)}</strong></span>
                <span>Total TTC : <strong>{fmtMoney(ei.totalTTC || 0)}</strong></span>
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
