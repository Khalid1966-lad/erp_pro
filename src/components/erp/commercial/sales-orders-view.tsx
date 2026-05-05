'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  ShoppingCart, Plus, Search, MoreVertical, Eye, Trash2, ClipboardList,
  Receipt, CheckCircle, XCircle, ArrowRight, FileDown, FileText, Loader2,
  Truck, Package, Edit, Printer, Pencil, BadgeCheck, Clock, RefreshCw
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ProductCombobox, ProductOption, useProductSearch } from '@/components/erp/shared/product-combobox'
import { HelpButton } from '@/components/erp/shared/help-button'
import { EntityCombobox } from '@/components/erp/shared/entity-combobox'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface SalesOrderLine {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT?: number
  quantityPrepared?: number
  quantityDelivered?: number
  discount?: number
  product?: { id: string; reference: string; designation: string }
}

interface SalesOrder {
  id: string
  clientOrderNumber: string
  status: string
  date: string
  deliveryDate: string | null
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  client: { id: string; name: string }
  lines: SalesOrderLine[]
  quoteId?: string | null
  quote?: { id: string; number: string } | null
}

interface Client { id: string; name: string }
interface Product { id: string; reference: string; designation: string; priceHT: number; tvaRate: number }

interface QuoteLine {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  discount?: number
  totalHT?: number
  product?: { id: string; reference: string; designation: string }
}

interface AcceptedQuote {
  id: string
  number: string
  date: string
  validUntil: string
  totalHT: number
  totalTVA: number
  totalTTC: number
  discountRate: number
  shippingCost: number
  notes: string | null
  client: { id: string; name: string }
  lines: QuoteLine[]
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  in_preparation: 'En préparation',
  prepared: 'Préparé',
  partially_delivered: 'Partiellement livré',
  delivered: 'Livré',
  cancelled: 'Annulé'
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_preparation: 'bg-orange-100 text-orange-800',
  prepared: 'bg-teal-100 text-teal-800',
  partially_delivered: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    pending: { icon: <Clock className="h-4 w-4" />, color: 'text-yellow-500' },
    confirmed: { icon: <ClipboardList className="h-4 w-4" />, color: 'text-blue-500' },
    in_preparation: { icon: <Package className="h-4 w-4" />, color: 'text-orange-500' },
    prepared: { icon: <BadgeCheck className="h-4 w-4" />, color: 'text-teal-500' },
    partially_delivered: { icon: <Truck className="h-4 w-4" />, color: 'text-indigo-500' },
    delivered: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
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

const salesOrderLegendItems = [
  { icon: <Clock className="h-3.5 w-3.5" />, label: 'En attente', color: 'text-yellow-500' },
  { icon: <ClipboardList className="h-3.5 w-3.5" />, label: 'Confirmé', color: 'text-blue-500' },
  { icon: <Package className="h-3.5 w-3.5" />, label: 'En préparation', color: 'text-orange-500' },
  { icon: <BadgeCheck className="h-3.5 w-3.5" />, label: 'Préparé', color: 'text-teal-500' },
  { icon: <Truck className="h-3.5 w-3.5" />, label: 'Partiellement livré', color: 'text-indigo-500' },
  { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Livré', color: 'text-green-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulé', color: 'text-red-500' },
]

const emptyLine = (): SalesOrderLine => ({
  productId: '',
  quantity: 1,
  unitPrice: 0,
  tvaRate: 20
})

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

export default function SalesOrdersView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [allProducts, setAllProducts] = useState<ProductOption[]>([])

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formClientOrderNumber, setFormClientOrderNumber] = useState('')
  const [formDeliveryDate, setFormDeliveryDate] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<SalesOrderLine[]>([emptyLine()])
  const [formQuoteId, setFormQuoteId] = useState<string | null>(null)
  const [formQuoteNumber, setFormQuoteNumber] = useState<string | null>(null)

  // Quote import state
  const [quoteImportOpen, setQuoteImportOpen] = useState(false)
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ orders: SalesOrder[]; total: number }>(`/sales-orders?${params.toString()}`)
      setOrders(data.orders)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement commandes')
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdowns = useCallback(async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        api.get<{ clients: Client[] }>('/clients?dropdown=true'),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      setClients(clientsRes.clients || [])
      setAllProducts(productsRes.products || [])
    } catch (err) {
      console.error('Erreur chargement dropdowns:', err)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchDropdowns()
    setExpandedOrderId(null)
  }, [statusFilter, fetchDropdowns])

  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(allProducts)

  const handleSearch = () => {
    setExpandedOrderId(null)
    fetchOrders()
  }

  const calcFormTotals = useMemo(() => {
    let totalHT = 0
    let totalTVA = 0
    for (const line of formLines) {
      if (!line.productId) continue
      const discountMultiplier = 1 - ((line.discount || 0) / 100)
      const lineHT = line.quantity * line.unitPrice * discountMultiplier
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
    }
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }, [formLines])

  const openCreate = () => {
    setEditingOrder(null)
    setSelectedOrder(null)
    setFormClientId('')
    setFormClientOrderNumber('')
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    setFormDeliveryDate(in7.toISOString().slice(0, 10))
    setFormNotes('')
    setFormLines([emptyLine()])
    setFormQuoteId(null)
    setFormQuoteNumber(null)
    resetLineSearches()
    setDialogOpen(true)
  }

  const openDetail = (order: SalesOrder) => {
    setSelectedOrder(order)
    setDetailOpen(true)
  }

  const openEdit = (order: SalesOrder) => {
    setEditingOrder(order)
    setFormClientId(order.client.id)
    setFormClientOrderNumber(order.clientOrderNumber || '')
    setFormDeliveryDate(order.deliveryDate ? order.deliveryDate.slice(0, 10) : '')
    setFormNotes(order.notes || '')
    setFormLines(order.lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, tvaRate: l.tvaRate, discount: l.discount || 0 })))
    setFormQuoteId(order.quoteId || null)
    setFormQuoteNumber(order.quote?.number || null)
    resetLineSearches()
    setDialogOpen(true)
  }

  // Fetch accepted quotes for the selected client
  const fetchAcceptedQuotes = async (clientId: string) => {
    try {
      setLoadingQuotes(true)
      const params = new URLSearchParams()
      params.set('clientId', clientId)
      params.set('status', 'accepted')
      const data = await api.get<{ quotes: AcceptedQuote[]; total: number }>(`/quotes?${params.toString()}`)
      setAcceptedQuotes(data.quotes || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement des devis')
      setAcceptedQuotes([])
    } finally {
      setLoadingQuotes(false)
    }
  }

  // Open quote import popup
  const openQuoteImport = async () => {
    if (!formClientId) return
    setQuoteImportOpen(true)
    await fetchAcceptedQuotes(formClientId)
  }

  // Select a quote and pre-fill the form
  const selectQuote = (quote: AcceptedQuote) => {
    const importedLines: SalesOrderLine[] = quote.lines.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      tvaRate: line.tvaRate,
      discount: line.discount || 0,
      product: line.product
    }))

    // If quote has no lines, add an empty line
    if (importedLines.length === 0) {
      importedLines.push(emptyLine())
    }

    setFormLines(importedLines)
    setFormQuoteId(quote.id)
    setFormQuoteNumber(quote.number)

    // Pre-fill notes if they exist
    if (quote.notes && !formNotes) {
      setFormNotes(quote.notes)
    }

    setQuoteImportOpen(false)
    toast.success(`Devis ${quote.number} importé avec ${quote.lines.length} ligne(s)`)
  }

  // Clear imported quote data
  const clearQuoteImport = () => {
    setFormQuoteId(null)
    setFormQuoteNumber(null)
    setFormLines([emptyLine()])
  }

  const handleStatusChange = async (order: SalesOrder, newStatus: string) => {
    try {
      await api.put('/sales-orders', { id: order.id, status: newStatus })
      toast.success(`Commande ${order.clientOrderNumber} mise à jour`)
      fetchOrders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur mise à jour')
    }
  }

  const handleCreatePreparation = async (order: SalesOrder) => {
    // Navigate to preparations page with the order pre-selected
    toast.info(`Redirection vers la création d'une préparation pour ${order.clientOrderNumber}`)
    window.dispatchEvent(new CustomEvent('erp:navigate', {
      detail: { target: 'preparations', createForOrderId: order.id }
    }))
  }

  const handleCreateInvoice = async (order: SalesOrder) => {
    try {
      await api.put('/sales-orders', { id: order.id, action: 'create_invoice' })
      toast.success(`Facture créée depuis ${order.clientOrderNumber}`)
      fetchOrders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur création facture')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/sales-orders?id=${id}`)
      toast.success('Commande supprimée')
      fetchOrders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur suppression')
    }
  }

  const handleSave = async () => {
    if (!formClientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (!formClientOrderNumber.trim()) {
      toast.error('Le numéro de commande client est obligatoire')
      return
    }
    const validLines = formLines.filter(l => l.productId)
    if (validLines.length === 0) {
      toast.error('Au moins une ligne est requise')
      return
    }

    try {
      setSaving(true)
      const deliveryDate = formDeliveryDate ? new Date(formDeliveryDate + 'T23:59:59.000Z').toISOString() : undefined
      if (editingOrder) {
        await api.put('/sales-orders', {
          id: editingOrder.id,
          clientId: formClientId,
          clientOrderNumber: formClientOrderNumber.trim(),
          deliveryDate,
          notes: formNotes || undefined,
          lines: validLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
            discount: l.discount || 0
          }))
        })
        toast.success('Commande modifiée')
      } else {
        await api.post('/sales-orders', {
          clientId: formClientId,
          clientOrderNumber: formClientOrderNumber.trim(),
          deliveryDate,
          notes: formNotes || undefined,
          quoteId: formQuoteId || undefined,
          lines: validLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
            discount: l.discount || 0
          }))
        })
        toast.success('Commande créée')
      }
      setDialogOpen(false)
      fetchOrders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || editingOrder ? 'Erreur modification' : 'Erreur création')
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => setFormLines([...formLines, emptyLine()])
  const removeLine = (idx: number) => setFormLines(formLines.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: keyof SalesOrderLine, value: string | number) => {
    const updated = [...formLines]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'productId') {
      const prod = allProducts.find(p => p.id === value)
      if (prod) {
        updated[idx].unitPrice = prod.priceHT || 0
        updated[idx].tvaRate = prod.tvaRate || 20
      }
    }
    setFormLines(updated)
  }

  const getStatusActions = (order: SalesOrder) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (order.status) {
      case 'pending':
        actions.push({ label: 'Confirmer', icon: <CheckCircle className="h-4 w-4" />, action: 'confirmed' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancelled' })
        break
      case 'confirmed':
        actions.push({ label: 'Créer préparation', icon: <ClipboardList className="h-4 w-4" />, action: 'create_preparation' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancelled' })
        break
      case 'in_preparation':
        actions.push({ label: 'Créer préparation', icon: <ClipboardList className="h-4 w-4" />, action: 'create_preparation' })
        // Only show "Marquer préparé" if all lines are fully prepared
        const allFullyPrepared = order.lines.every((l) => (l.quantityPrepared || 0) >= l.quantity)
        if (allFullyPrepared) {
          actions.push({ label: 'Marquer préparé', icon: <CheckCircle className="h-4 w-4" />, action: 'prepared' })
        }
        break
      case 'prepared':
        actions.push({ label: 'Créer BL', icon: <Truck className="h-4 w-4" />, action: 'create_delivery' })
        actions.push({ label: 'Marquer livré', icon: <CheckCircle className="h-4 w-4" />, action: 'delivered' })
        break
      case 'partially_delivered':
        actions.push({ label: 'Créer BL', icon: <Truck className="h-4 w-4" />, action: 'create_delivery' })
        actions.push({ label: 'Marquer livré', icon: <CheckCircle className="h-4 w-4" />, action: 'delivered' })
        break
      case 'delivered':
        actions.push({ label: 'Créer facture', icon: <Receipt className="h-4 w-4" />, action: 'create_invoice' })
        break
    }
    return actions
  }

  // ─── Delivery tracking helpers ───

  const handleCreateDelivery = (order: SalesOrder) => {
    toast.info(`Redirection vers la création d'un BL pour ${order.clientOrderNumber}`)
    // Dispatch a custom event that the parent page can listen to
    window.dispatchEvent(new CustomEvent('erp:navigate-delivery-notes', {
      detail: { salesOrderId: order.id }
    }))
  }

  const executeAction = async (order: SalesOrder, action: string) => {
    switch (action) {
      case 'create_preparation':
        await handleCreatePreparation(order)
        break
      case 'create_delivery':
        handleCreateDelivery(order)
        break
      case 'create_invoice':
        await handleCreateInvoice(order)
        break
      default:
        await handleStatusChange(order, action)
        break
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
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
          <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Commandes clients</h2>
          <Badge variant="secondary">{orders.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="commandes" />
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="in_preparation">En préparation</SelectItem>
            <SelectItem value="prepared">Préparé</SelectItem>
            <SelectItem value="partially_delivered">Partiellement livré</SelectItem>
            <SelectItem value="delivered">Livré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <IconLegend items={salesOrderLegendItems} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Livraison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">% Livraison</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total HT</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {search || statusFilter !== 'all' ? 'Aucune commande trouvée.' : 'Aucune commande enregistrée.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} className={cn("cursor-pointer", expandedOrderId === order.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)} onDoubleClick={() => openEdit(order)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(order.status)}
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-medium text-primary">{order.clientOrderNumber}</span>
                            {order.quoteId && order.quote && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {order.quote.number}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{order.client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(order.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {order.deliveryDate ? format(new Date(order.deliveryDate), 'dd/MM/yyyy', { locale: fr }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[order.status] || ''}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {(() => {
                          if (!order.lines || order.lines.length === 0) return <span className="text-xs text-muted-foreground">—</span>
                          const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0)
                          const totalDelivered = order.lines.reduce((s, l) => s + (l.quantityDelivered || 0), 0)
                          if (totalQty === 0) return <span className="text-xs text-muted-foreground">—</span>
                          const pct = Math.round((totalDelivered / totalQty) * 100)
                          return (
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className={`text-xs font-medium ${pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                {pct}%
                              </span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">
                        {formatCurrency(order.totalHT)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-semibold">
                        {formatCurrency(order.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(order) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {getStatusActions(order).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getStatusActions(order).map((action) => (
                                  <DropdownMenuItem key={action.action} onClick={() => executeAction(order, action.action)}>
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {(order.status === 'pending') && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {isSuperAdmin && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="h-4 w-4" />
                                          <span className="ml-2">Supprimer</span>
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Supprimer la commande</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Êtes-vous sûr de vouloir supprimer la commande <strong>{order.clientOrderNumber}</strong> ?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(order.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Supprimer
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    )}
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

      {/* Inline Detail Panel */}
      {expandedOrderId && (() => {
        const eq = orders.find(o => o.id === expandedOrderId)
        if (!eq) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono text-primary">{eq.clientOrderNumber}</span>
                      <Badge variant="secondary" className={statusColors[eq.status]}>{statusLabels[eq.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{eq.client.name} — {format(new Date(eq.date), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openDetail(eq)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!eq) return
                    printDocument({
                      title: 'COMMANDE',
                      docNumber: eq.clientOrderNumber,
                      infoGrid: [
                        { label: 'Client', value: eq.client.name },
                        { label: 'N° Cmd Client', value: eq.clientOrderNumber },
                        { label: 'Date', value: fmtDate(eq.date) },
                        ...(eq.deliveryDate ? [{ label: 'Livraison', value: fmtDate(eq.deliveryDate) }] : []),
                        ...(eq.quoteId && eq.quote ? [{ label: 'Devis', value: eq.quote.number }] : []),
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'TVA %', align: 'right' },
                        { label: 'Remise %', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: eq.lines.map(l => [
                        { value: `${l.product?.reference || ''} - ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                        { value: fmtMoney(l.unitPrice), align: 'right' },
                        { value: `${l.tvaRate}%`, align: 'right' },
                        { value: `${l.discount || 0}%`, align: 'right' },
                        { value: fmtMoney(l.totalHT || 0), align: 'right' },
                      ]),
                      totals: [
                        { label: 'Total HT', value: fmtMoney(eq.totalHT) },
                        { label: 'TVA', value: fmtMoney(eq.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(eq.totalTTC), bold: true },
                      ],
                      subSections: buildVisaHtml(eq.notes),
                      amountInWords: `${numberToFrenchWords(eq.totalTTC || 0)} dirhams`,
                      amountInWordsLabel: 'Arrêtée la présente commande à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  {eq.status === 'pending' && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(eq)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedOrderId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Livraison</span>
                  <p className="font-medium">{eq.deliveryDate ? format(new Date(eq.deliveryDate), 'dd/MM/yyyy', { locale: fr }) : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Remise</span>
                  <p className="font-medium">{eq.lines.some(l => (l.discount || 0) > 0) ? 'Oui' : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Lignes</span>
                  <p className="font-medium">{eq.lines.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Devis</span>
                  <p className="font-medium">{eq.quoteId && eq.quote ? eq.quote.number : '—'}</p>
                </div>
              </div>

              {eq.lines.length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right w-[70px]">Qté</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. HT</TableHead>
                        <TableHead className="text-right w-[70px]">TVA %</TableHead>
                        <TableHead className="text-right w-[70px]">Remise %</TableHead>
                        <TableHead className="text-right w-[100px]">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eq.lines.map((line) => (
                        <TableRow key={line.id || line.productId}>
                          <TableCell className="font-medium text-sm">
                            <span className="font-mono text-muted-foreground mr-2">{line.product?.reference || ''}</span>
                            {line.product?.designation || '—'}
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right">{line.tvaRate}%</TableCell>
                          <TableCell className="text-right">{line.discount || 0}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(line.totalHT || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {eq.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {eq.notes}</div>
              )}

              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(eq.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(eq.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span>{formatCurrency(eq.totalTTC)}</span></div>
                <div className="text-sm italic text-muted-foreground pt-1">{numberToFrenchWords(eq.totalTTC || 0)} dirhams</div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setFormQuoteId(null)
          setFormQuoteNumber(null)
        }
      }}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingOrder ? (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  Modifier — {editingOrder.number}
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  Nouvelle commande client
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client selection + N° Cmd Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <EntityCombobox
                  entities={clients}
                  value={formClientId}
                  onValueChange={(val) => {
                    setFormClientId(val)
                    clearQuoteImport()
                  }}
                  placeholder="Sélectionner un client"
                  searchPlaceholder="Rechercher par raison sociale, nom, ICE..."
                  showSubText="ice"
                />
              </div>
              <div className="space-y-2">
                <Label>N° Commande Client *</Label>
                <Input
                  placeholder="Saisir le numéro de commande du client"
                  value={formClientOrderNumber}
                  onChange={(e) => setFormClientOrderNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Date de livraison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de livraison souhaitée</Label>
                <Input type="date" value={formDeliveryDate} onChange={(e) => setFormDeliveryDate(e.target.value)} />
              </div>
            </div>

            {/* Import from quote button */}
            {formClientId && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openQuoteImport}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Importer un devis accepté
                </Button>
                {formQuoteId && formQuoteNumber && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 gap-1">
                      <FileText className="h-3 w-3" />
                      Importé de {formQuoteNumber}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearQuoteImport}
                      className="text-muted-foreground hover:text-destructive h-7 px-2"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Quote import info banner */}
            {formQuoteId && formQuoteNumber && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    Cette commande sera créée depuis le devis <strong>{formQuoteNumber}</strong>.
                    Les lignes ont été importées automatiquement. Vous pouvez les modifier si nécessaire.
                  </span>
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes</Label>
                <div className="flex items-center gap-2">
                  {formQuoteId && formLines.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formLines.filter(l => l.productId).length} ligne(s) importée(s)
                    </span>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>
              <div className="rounded border">
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[300px]">Produit</TableHead>
                        <TableHead className="w-[80px]">Qté</TableHead>
                        <TableHead className="w-[100px]">P.U. HT</TableHead>
                        <TableHead className="w-[80px]">TVA %</TableHead>
                        <TableHead className="w-[80px]">Remise %</TableHead>
                        <TableHead className="w-[100px] text-right">Total HT</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formLines.map((line, idx) => (
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
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0.01" step="1" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-full" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full" />
                          </TableCell>
                          <TableCell>
                            <Select value={String(line.tvaRate)} onValueChange={(v) => updateLine(idx, 'tvaRate', parseFloat(v))}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="7">7%</SelectItem>
                                <SelectItem value="10">10%</SelectItem>
                                <SelectItem value="14">14%</SelectItem>
                                <SelectItem value="20">20%</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" max="100" step="1" value={line.discount || 0} onChange={(e) => updateLine(idx, 'discount', parseFloat(e.target.value) || 0)} className="w-full" />
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {line.productId ? formatCurrency(line.quantity * line.unitPrice * (1 - ((line.discount || 0) / 100))) : '—'}
                          </TableCell>
                          <TableCell>
                            {formLines.length > 1 && isSuperAdmin && (
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
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notes internes..." rows={2} />
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(calcFormTotals.totalHT)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(calcFormTotals.totalTVA)}</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span>{formatCurrency(calcFormTotals.totalTTC)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? (editingOrder ? 'Modification...' : 'Création...')
                : (editingOrder ? 'Enregistrer les modifications' : 'Créer la commande')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Import Selection Dialog */}
      <Dialog open={quoteImportOpen} onOpenChange={setQuoteImportOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-emerald-600" />
              Importer un devis accepté
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un devis accepté pour pré-remplir les lignes de la commande.
              Seuls les devis avec le statut &quot;Accepté&quot; sont disponibles.
            </p>

            {loadingQuotes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Chargement des devis...</span>
              </div>
            ) : acceptedQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucun devis accepté trouvé pour ce client.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seuls les devis ayant le statut &quot;Accepté&quot; peuvent être importés.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedQuotes.map((quote) => (
                  <Card key={quote.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold">{quote.number}</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Accepté
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                            <div>
                              <span className="text-muted-foreground">Date : </span>
                              <span>{format(new Date(quote.date), 'dd/MM/yyyy', { locale: fr })}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Lignes : </span>
                              <span>{quote.lines.length}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total TTC : </span>
                              <span className="font-semibold">{formatCurrency(quote.totalTTC)}</span>
                            </div>
                          </div>
                          {quote.lines.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Produits : {quote.lines.map(l => l.product?.reference || '—').join(', ')}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => selectQuote(quote)}
                          className="shrink-0"
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Sélectionner
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteImportOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <ShoppingCart className="h-5 w-5" />
              {selectedOrder?.number}
              {selectedOrder && (
                <Badge variant="secondary" className={statusColors[selectedOrder.status]}>
                  {statusLabels[selectedOrder.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <PrintHeader />
              {/* Quote origin badge */}
              {selectedOrder.quoteId && selectedOrder.quote && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      Cette commande a été créée depuis le devis{' '}
                      <span className="font-semibold">{selectedOrder.quote.number}</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedOrder.client.name}</p></div>
                <div><span className="text-muted-foreground">Date</span><p className="font-medium">{format(new Date(selectedOrder.date), 'dd/MM/yyyy', { locale: fr })}</p></div>
                <div><span className="text-muted-foreground">Livraison</span><p className="font-medium">{selectedOrder.deliveryDate ? format(new Date(selectedOrder.deliveryDate), 'dd/MM/yyyy', { locale: fr }) : 'Non définie'}</p></div>
                <div><span className="text-muted-foreground">Nb lignes</span><p className="font-medium">{selectedOrder.lines.length}</p></div>
              </div>

              {/* ── Delivery Tracking Section ── */}
              {(selectedOrder.status === 'partially_delivered' || selectedOrder.status === 'delivered' || selectedOrder.status === 'prepared') && (
                <div className="rounded-md border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" />
                    Suivi de livraison
                  </h4>
                  {/* Overall delivery progress bar */}
                  {(() => {
                    const totalOrdered = selectedOrder.lines.reduce((s, l) => s + l.quantity, 0)
                    const totalDelivered = selectedOrder.lines.reduce((s, l) => s + (l.quantityDelivered || 0), 0)
                    const overallPct = totalOrdered > 0 ? Math.min(100, Math.round((totalDelivered / totalOrdered) * 100)) : 0
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Avancement global</span>
                          <span className="font-semibold">
                            <span className={overallPct >= 100 ? 'text-green-600' : overallPct > 0 ? 'text-amber-600' : 'text-gray-500'}>
                              {totalDelivered} / {totalOrdered} ({overallPct}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${overallPct >= 100 ? 'bg-green-500' : overallPct > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                            style={{ width: `${overallPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                  {/* Per-line delivery table */}
                  <div className="max-h-[250px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Commandé</TableHead>
                          <TableHead className="text-right">Préparé</TableHead>
                          <TableHead className="text-right">Livré</TableHead>
                          <TableHead className="text-right">Restant</TableHead>
                          <TableHead className="text-center">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.lines.map((line) => {
                          const delivered = line.quantityDelivered || 0
                          const remaining = Math.max(0, line.quantity - delivered)
                          const pct = line.quantity > 0 ? Math.min(100, Math.round((delivered / line.quantity) * 100)) : 0
                          return (
                            <TableRow key={line.id || line.productId}>
                              <TableCell className="font-medium text-sm">
                                <div className="flex items-center gap-1.5">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="truncate">{line.product?.designation}</p>
                                    <p className="text-[11px] text-muted-foreground font-mono">{line.product?.reference}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{line.quantity}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{line.quantityPrepared || 0}</TableCell>
                              <TableCell className="text-right">
                                <span className={delivered > 0 ? 'text-blue-600 font-medium' : ''}>{delivered}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={remaining > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>{remaining}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${
                                    pct >= 100
                                      ? 'bg-green-100 text-green-800'
                                      : pct > 0
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {pct}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Qté préparée</TableHead>
                      <TableHead className="text-right">P.U. HT</TableHead>
                      <TableHead className="text-right">Total HT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.lines.map((line) => (
                      <TableRow key={line.id || line.productId}>
                        <TableCell className="font-medium">{line.product ? `${line.product.reference} - ${line.product.designation}` : (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{line.quantityPrepared || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(line.totalHT || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedOrder.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {selectedOrder.notes}</div>
              )}

              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(selectedOrder.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(selectedOrder.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span>{formatCurrency(selectedOrder.totalTTC)}</span></div>
                <div className="flex justify-between text-sm italic text-muted-foreground pt-1">
                  <span>Arrêtée la présente commande à la somme de :</span>
                </div>
                <div className="text-sm font-medium italic text-right mt-1">
                  {numberToFrenchWords(selectedOrder.totalTTC || 0)} dirhams
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedOrder) return
                    printDocument({
                      title: 'BON DE COMMANDE',
                      docNumber: selectedOrder.number,
                      infoGrid: [
                        { label: 'Client', value: selectedOrder.client.name },
                        { label: 'N° Cmd Client', value: selectedOrder.clientOrderNumber },
                        { label: 'Date', value: fmtDate(selectedOrder.date) },
                        { label: 'Livraison', value: fmtDate(selectedOrder.deliveryDate || '') },
                        { label: 'Nb lignes', value: String(selectedOrder.lines.length) },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'Qté préparée', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: selectedOrder.lines.map(line => [
                        { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                        { value: line.quantity, align: 'right' },
                        { value: line.quantityPrepared || 0, align: 'right' },
                        { value: fmtMoney(line.unitPrice), align: 'right' },
                        { value: fmtMoney(line.totalHT || (line.quantity * line.unitPrice)), align: 'right' },
                      ]),
                      totals: [
                        { label: 'Total HT', value: fmtMoney(selectedOrder.totalHT) },
                        { label: 'TVA', value: fmtMoney(selectedOrder.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(selectedOrder.totalTTC), bold: true },
                      ],
                      subSections: buildVisaHtml(selectedOrder.notes),
                      amountInWords: numberToFrenchWords(selectedOrder.totalTTC || 0) + ' dirhams',
                      amountInWordsLabel: 'Arrêté le présent bon de commande à la somme de',
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {(selectedOrder.status === 'pending') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailOpen(false)
                      openEdit(selectedOrder)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                )}
                {getStatusActions(selectedOrder).map((action) => (
                  <Button
                    key={action.action}
                    variant={action.action === 'create_invoice' ? 'default' : 'outline'}
                    onClick={() => {
                      executeAction(selectedOrder, action.action)
                      setDetailOpen(false)
                    }}
                  >
                    {action.icon}
                    <span className="ml-2">{action.label}</span>
                  </Button>
                ))}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
import { useIsSuperAdmin } from '@/hooks/use-super-admin'
