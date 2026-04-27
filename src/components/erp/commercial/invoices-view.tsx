'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  Receipt, Plus, Search, MoreVertical, Eye, Send, CheckCircle,
  XCircle, Trash2, Edit, DollarSign, ShieldCheck, RotateCcw, Truck, Loader2, FileText, Printer, Pencil
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { ProductCombobox, ProductOption, useProductSearch } from '@/components/erp/shared/product-combobox'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface InvoiceLine {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT?: number
  product?: { id: string; reference: string; designation: string }
}

interface InvoiceDeliveryNoteRel {
  id: string
  deliveryNoteId: string
  deliveryNote: {
    id: string
    number: string
    date: string
    totalHT: number
    totalTVA: number
    totalTTC: number
    status: string
  }
}

interface Invoice {
  id: string
  number: string
  status: string
  date: string
  dueDate: string
  paymentDate: string | null
  discountRate: number
  shippingCost: number
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  client: { id: string; name: string }
  salesOrder: { id: string; number: string } | null
  lines: InvoiceLine[]
  payments: { id: string; amount: number; date: string; method: string }[]
  creditNotes: { id: string; number: string; totalTTC: number }[]
  deliveryNotes: InvoiceDeliveryNoteRel[]
}

interface Client { id: string; name: string }
interface Product { id: string; reference: string; designation: string; priceHT: number; tvaRate: number }

interface UninvoicedBL {
  id: string
  number: string
  status: string
  date: string
  deliveryDate: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  salesOrder: { id: string; number: string } | null
  client: { id: string; name: string }
  lines: {
    id: string
    quantity: number
    unitPrice: number
    tvaRate: number
    totalHT: number
    product: { id: string; reference: string; designation: string }
  }[]
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée'
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  validated: 'bg-emerald-100 text-emerald-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800'
}

const emptyLine = (): InvoiceLine => ({
  productId: '',
  quantity: 1,
  unitPrice: 0,
  tvaRate: 20
})

type CreateMode = 'manual' | 'from_bl'

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [allProducts, setAllProducts] = useState<ProductOption[]>([])

  // Create mode
  const [createMode, setCreateMode] = useState<CreateMode>('manual')

  // Form state (manual mode)
  const [formClientId, setFormClientId] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formDiscountRate, setFormDiscountRate] = useState('0')
  const [formShippingCost, setFormShippingCost] = useState('0')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<InvoiceLine[]>([emptyLine()])

  // BL mode state
  const [blClientId, setBlClientId] = useState('')
  const [uninvoicedBLs, setUninvoicedBLs] = useState<UninvoicedBL[]>([])
  const [selectedBLIds, setSelectedBLIds] = useState<string[]>([])
  const [loadingBLs, setLoadingBLs] = useState(false)
  const [blDueDate, setBlDueDate] = useState('')
  const [blDiscountRate, setBlDiscountRate] = useState('0')
  const [blShippingCost, setBlShippingCost] = useState('0')
  const [blNotes, setBlNotes] = useState('')

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ invoices: Invoice[]; total: number }>(`/invoices?${params.toString()}`)
      setInvoices(data.invoices)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement factures')
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdowns = useCallback(async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        api.get<{ clients: Client[] }>('/clients'),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      setClients(clientsRes.clients || [])
      setAllProducts(productsRes.products || [])
    } catch (err) {
      console.error('Erreur chargement dropdowns:', err)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    fetchDropdowns()
  }, [statusFilter, fetchDropdowns])

  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(allProducts)

  const handleSearch = () => fetchInvoices()

  // ─── Manual mode totals ───
  const calcFormTotals = useMemo(() => {
    let totalHT = 0
    let totalTVA = 0
    for (const line of formLines) {
      if (!line.productId) continue
      const lineHT = line.quantity * line.unitPrice
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
    }
    const discountRate = parseFloat(formDiscountRate) || 0
    const shippingCost = parseFloat(formShippingCost) || 0
    const discountedHT = totalHT * (1 - discountRate / 100)
    const finalHT = discountedHT + shippingCost
    const finalTVA = totalTVA * (1 - discountRate / 100)
    return { totalHT: finalHT, totalTVA: finalTVA, totalTTC: finalHT + finalTVA }
  }, [formLines, formDiscountRate, formShippingCost])

  // ─── BL mode totals ───
  const blSelectedBLs = useMemo(
    () => uninvoicedBLs.filter((bl) => selectedBLIds.includes(bl.id)),
    [uninvoicedBLs, selectedBLIds]
  )

  const blFormTotals = useMemo(() => {
    let totalHT = 0
    let totalTVA = 0
    for (const bl of blSelectedBLs) {
      totalHT += bl.totalHT
      totalTVA += bl.totalTVA
    }
    const discountRate = parseFloat(blDiscountRate) || 0
    const shippingCost = parseFloat(blShippingCost) || 0
    const discountedHT = totalHT * (1 - discountRate / 100)
    const finalHT = discountedHT + shippingCost
    const finalTVA = totalTVA * (1 - discountRate / 100)
    return { totalHT: finalHT, totalTVA: finalTVA, totalTTC: finalHT + finalTVA }
  }, [blSelectedBLs, blDiscountRate, blShippingCost])

  // ─── Open create dialog ───
  const openCreate = () => {
    setEditingInvoice(null)
    setSelectedInvoice(null)
    setCreateMode('manual')
    // Reset manual form
    setFormClientId('')
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    const dateStr = in30.toISOString().slice(0, 10)
    setFormDueDate(dateStr)
    setFormDiscountRate('0')
    setFormShippingCost('0')
    setFormNotes('')
    setFormLines([emptyLine()])
    resetLineSearches()
    // Reset BL form
    setBlClientId('')
    setUninvoicedBLs([])
    setSelectedBLIds([])
    setBlDueDate(dateStr)
    setBlDiscountRate('0')
    setBlShippingCost('0')
    setBlNotes('')
    setDialogOpen(true)
  }

  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setDetailOpen(true)
  }

  const openEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setSelectedInvoice(invoice)
    setCreateMode('manual')
    setFormClientId(invoice.client.id)
    setFormDueDate(invoice.dueDate.slice(0, 10))
    setFormDiscountRate(String(invoice.discountRate))
    setFormShippingCost(String(invoice.shippingCost))
    setFormNotes(invoice.notes || '')
    setFormLines(invoice.lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, tvaRate: l.tvaRate })))
    resetLineSearches()
    setDialogOpen(true)
  }

  // ─── Fetch uninvoiced BLs when BL client changes ───
  useEffect(() => {
    if (createMode !== 'from_bl' || !blClientId || !dialogOpen) {
      setUninvoicedBLs([])
      setSelectedBLIds([])
      return
    }
    const fetchBLs = async () => {
      try {
        setLoadingBLs(true)
        const data = await api.get<{ deliveryNotes: UninvoicedBL[] }>(
          `/invoices/uninvoiced-bls?clientId=${blClientId}`
        )
        setUninvoicedBLs(data.deliveryNotes || [])
        setSelectedBLIds([])
      } catch (err: any) {
        toast.error(err.message || 'Erreur chargement BLs')
        setUninvoicedBLs([])
      } finally {
        setLoadingBLs(false)
      }
    }
    fetchBLs()
  }, [blClientId, createMode, dialogOpen])

  const handleAction = async (invoice: Invoice, action: string) => {
    try {
      await api.put('/invoices', { id: invoice.id, action })
      const labels: Record<string, string> = {
        validate: 'validée',
        send: 'envoyée',
        pay: 'marquée comme payée',
        cancel: 'annulée'
      }
      toast.success(`Facture ${invoice.number} ${labels[action]}`)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Erreur action')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/invoices?id=${id}`)
      toast.success('Facture supprimée')
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  // ─── Save manual invoice ───
  const handleSaveManual = async () => {
    if (!formClientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    const validLines = formLines.filter(l => l.productId)
    if (validLines.length === 0) {
      toast.error('Au moins une ligne est requise')
      return
    }
    if (!formDueDate) {
      toast.error("Veuillez indiquer une date d'échéance")
      return
    }

    try {
      setSaving(true)
      const dueDateISO = new Date(formDueDate + 'T23:59:59.000Z').toISOString()
      if (editingInvoice) {
        await api.put('/invoices', {
          id: editingInvoice.id,
          clientId: formClientId,
          dueDate: dueDateISO,
          discountRate: parseFloat(formDiscountRate) || 0,
          shippingCost: parseFloat(formShippingCost) || 0,
          notes: formNotes || undefined,
          lines: validLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate
          }))
        })
        toast.success('Facture modifiée')
      } else {
        await api.post('/invoices', {
          clientId: formClientId,
          dueDate: dueDateISO,
          discountRate: parseFloat(formDiscountRate) || 0,
          shippingCost: parseFloat(formShippingCost) || 0,
          notes: formNotes || undefined,
          lines: validLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate
          }))
        })
        toast.success('Facture créée')
      }
      setDialogOpen(false)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || editingInvoice ? 'Erreur modification' : 'Erreur création')
    } finally {
      setSaving(false)
    }
  }

  // ─── Save invoice from BLs ───
  const handleSaveFromBL = async () => {
    if (!blClientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    if (selectedBLIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un bon de livraison')
      return
    }
    if (!blDueDate) {
      toast.error("Veuillez indiquer une date d'échéance")
      return
    }

    try {
      setSaving(true)
      const dueDateISO = new Date(blDueDate + 'T23:59:59.000Z').toISOString()
      await api.post('/invoices', {
        clientId: blClientId,
        deliveryNoteIds: selectedBLIds,
        dueDate: dueDateISO,
        discountRate: parseFloat(blDiscountRate) || 0,
        shippingCost: parseFloat(blShippingCost) || 0,
        notes: blNotes || undefined,
      })
      toast.success(`Facture créée depuis ${selectedBLIds.length} BL(s)`)
      setDialogOpen(false)
      fetchInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Erreur création')
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => setFormLines([...formLines, emptyLine()])
  const removeLine = (idx: number) => setFormLines(formLines.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: keyof InvoiceLine, value: any) => {
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

  const toggleBL = (blId: string) => {
    setSelectedBLIds((prev) =>
      prev.includes(blId) ? prev.filter((id) => id !== blId) : [...prev, blId]
    )
  }

  const toggleAllBLs = () => {
    if (selectedBLIds.length === uninvoicedBLs.length) {
      setSelectedBLIds([])
    } else {
      setSelectedBLIds(uninvoicedBLs.map((bl) => bl.id))
    }
  }

  const getActions = (invoice: Invoice) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (invoice.status) {
      case 'draft':
        actions.push({ label: 'Valider', icon: <ShieldCheck className="h-4 w-4" />, action: 'validate' })
        break
      case 'validated':
        actions.push({ label: 'Envoyer', icon: <Send className="h-4 w-4" />, action: 'send' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
      case 'sent':
        actions.push({ label: 'Marquer payée', icon: <DollarSign className="h-4 w-4" />, action: 'pay' })
        break
      case 'overdue':
        actions.push({ label: 'Marquer payée', icon: <DollarSign className="h-4 w-4" />, action: 'pay' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
    }
    return actions
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
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
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Factures</h2>
          <Badge variant="secondary">{invoices.length}</Badge>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle facture
        </Button>
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
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="validated">Validée</SelectItem>
            <SelectItem value="sent">Envoyée</SelectItem>
            <SelectItem value="paid">Payée</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total HT</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || statusFilter !== 'all' ? 'Aucune facture trouvée.' : 'Aucune facture enregistrée.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="cursor-pointer" onDoubleClick={() => openEdit(invoice)}>
                      <TableCell className="font-mono font-medium">{invoice.number}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{invoice.client.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {invoice.salesOrder && (
                              <span className="text-xs text-muted-foreground">BC {invoice.salesOrder.number}</span>
                            )}
                            {invoice.deliveryNotes && invoice.deliveryNotes.length > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-amber-50 text-amber-700 border-amber-200">
                                <Truck className="h-2.5 w-2.5 mr-0.5" />
                                {invoice.deliveryNotes.length} BL
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(invoice.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[invoice.status] || ''}>
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">
                        {formatCurrency(invoice.totalHT)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-semibold">
                        {formatCurrency(invoice.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(invoice)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(invoice) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {getActions(invoice).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActions(invoice).map((action) => (
                                  <DropdownMenuItem key={action.action} onClick={() => handleAction(invoice, action.action)}>
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {invoice.status === 'draft' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="h-4 w-4" />
                                          <span className="ml-2">Supprimer</span>
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Supprimer la facture</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Êtes-vous sûr de vouloir supprimer la facture <strong>{invoice.number}</strong> ?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(invoice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Supprimer
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingInvoice ? (
                <>
                  <Receipt className="h-5 w-5" />
                  Modifier — {editingInvoice.number}
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5" />
                  Nouvelle facture
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode Toggle */}
            {!editingInvoice && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={createMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCreateMode('manual')}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Manuelle
                </Button>
                <Button
                  type="button"
                  variant={createMode === 'from_bl' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCreateMode('from_bl')}
                >
                  <Truck className="h-4 w-4 mr-1" />
                  Depuis BL
                </Button>
              </div>
            )}

            {/* ═══ MANUAL MODE ═══ */}
            {(createMode === 'manual' || editingInvoice) && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Select value={formClientId} onValueChange={setFormClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date d&apos;échéance *</Label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Lignes</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[220px]">Produit</TableHead>
                          <TableHead className="w-[80px]">Qté</TableHead>
                          <TableHead className="w-[100px]">P.U. HT</TableHead>
                          <TableHead className="w-[80px]">TVA %</TableHead>
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
                            <TableCell className="text-right font-medium text-sm">
                              {line.productId ? formatCurrency(line.quantity * line.unitPrice) : '—'}
                            </TableCell>
                            <TableCell>
                              {formLines.length > 1 && (
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Remise globale (%)</Label>
                    <Input type="number" min="0" max="100" step="1" value={formDiscountRate} onChange={(e) => setFormDiscountRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Frais de port (MAD)</Label>
                    <Input type="number" min="0" step="0.01" value={formShippingCost} onChange={(e) => setFormShippingCost(e.target.value)} />
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
              </>
            )}

            {/* ═══ FROM BL MODE ═══ */}
            {!editingInvoice && createMode === 'from_bl' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Select value={blClientId} onValueChange={(v) => {
                      setBlClientId(v)
                      setFormClientId(v) // sync for reference
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date d&apos;échéance *</Label>
                    <Input type="date" value={blDueDate} onChange={(e) => setBlDueDate(e.target.value)} />
                  </div>
                </div>

                {/* BL Selection */}
                {blClientId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1">
                        <Truck className="h-4 w-4" />
                        Bons de livraison disponibles
                      </Label>
                      {uninvoicedBLs.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" onClick={toggleAllBLs}>
                          {selectedBLIds.length === uninvoicedBLs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </Button>
                      )}
                    </div>

                    {loadingBLs ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : uninvoicedBLs.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                        <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Aucun BL livré ou confirmé disponible pour ce client.
                      </div>
                    ) : (
                      <div className="rounded border max-h-[240px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]">
                                <Checkbox
                                  checked={selectedBLIds.length === uninvoicedBLs.length && uninvoicedBLs.length > 0}
                                  onCheckedChange={toggleAllBLs}
                                />
                              </TableHead>
                              <TableHead>N° BL</TableHead>
                              <TableHead className="hidden md:table-cell">Date</TableHead>
                              <TableHead className="hidden md:table-cell">Commande</TableHead>
                              <TableHead className="text-right">Nb articles</TableHead>
                              <TableHead className="text-right">Total TTC</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {uninvoicedBLs.map((bl) => (
                              <TableRow
                                key={bl.id}
                                className={selectedBLIds.includes(bl.id) ? 'bg-amber-50/50' : 'cursor-pointer'}
                                onClick={() => toggleBL(bl.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedBLIds.includes(bl.id)}
                                    onCheckedChange={() => toggleBL(bl.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono font-medium text-sm">{bl.number}</TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                  {format(new Date(bl.date), 'dd/MM/yyyy', { locale: fr })}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                  {bl.salesOrder ? (
                                    <span className="font-mono">{bl.salesOrder.number}</span>
                                  ) : (
                                    <span className="italic">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm">{bl.lines.length}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(bl.totalTTC)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Selected BLs summary */}
                    {selectedBLIds.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5 text-sm">
                        <p className="font-medium text-amber-800">
                          {selectedBLIds.length} BL sélectionné{selectedBLIds.length > 1 ? 's' : ''} :
                        </p>
                        <div className="space-y-1">
                          {blSelectedBLs.map((bl) => (
                            <div key={bl.id} className="flex items-center justify-between text-amber-700">
                              <span className="font-mono text-xs">{bl.number}</span>
                              <span className="text-xs">{formatCurrency(bl.totalTTC)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!blClientId && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                    <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Sélectionnez un client pour voir les BLs disponibles.
                  </div>
                )}

                {/* BL aggregated lines preview */}
                {selectedBLIds.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Aperçu des lignes</Label>
                    <div className="rounded border max-h-[200px] overflow-y-auto">
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
                          {blSelectedBLs.flatMap((bl) =>
                            bl.lines.map((line) => (
                              <TableRow key={`${bl.id}-${line.id}`}>
                                <TableCell className="text-sm">
                                  {line.product.reference} - {line.product.designation}
                                </TableCell>
                                <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(line.unitPrice)}</TableCell>
                                <TableCell className="text-right text-sm">{line.tvaRate}%</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(line.totalHT)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Remise globale (%)</Label>
                    <Input type="number" min="0" max="100" step="1" value={blDiscountRate} onChange={(e) => setBlDiscountRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Frais de port (MAD)</Label>
                    <Input type="number" min="0" step="0.01" value={blShippingCost} onChange={(e) => setBlShippingCost(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={blNotes} onChange={(e) => setBlNotes(e.target.value)} placeholder="Notes internes..." rows={2} />
                </div>

                {/* BL Totals */}
                <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                  {selectedBLIds.length > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Sous-total BLs</span><span>{formatCurrency(blSelectedBLs.reduce((a, b) => a + b.totalHT, 0))}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(blFormTotals.totalHT)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(blFormTotals.totalTVA)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span>{formatCurrency(blFormTotals.totalTTC)}</span></div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            {createMode === 'manual' || editingInvoice ? (
              <Button onClick={handleSaveManual} disabled={saving}>
                {saving
                  ? (editingInvoice ? 'Modification...' : 'Création...')
                  : (editingInvoice ? 'Enregistrer les modifications' : 'Créer la facture')
                }
              </Button>
            ) : (
              <Button onClick={handleSaveFromBL} disabled={saving || selectedBLIds.length === 0}>
                {saving ? 'Création...' : `Créer la facture (${selectedBLIds.length} BL)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {selectedInvoice?.number}
              {selectedInvoice && (
                <Badge variant="secondary" className={statusColors[selectedInvoice.status]}>
                  {statusLabels[selectedInvoice.status]}
                </Badge>
              )}
              {selectedInvoice && selectedInvoice.deliveryNotes.length > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <Truck className="h-3 w-3 mr-1" />
                  {selectedInvoice.deliveryNotes.length} BL
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedInvoice.client.name}</p></div>
                <div><span className="text-muted-foreground">Date</span><p className="font-medium">{format(new Date(selectedInvoice.date), 'dd/MM/yyyy', { locale: fr })}</p></div>
                <div><span className="text-muted-foreground">Échéance</span><p className="font-medium">{format(new Date(selectedInvoice.dueDate), 'dd/MM/yyyy', { locale: fr })}</p></div>
                <div><span className="text-muted-foreground">Paiement</span>
                  <p className="font-medium">
                    {selectedInvoice.paymentDate
                      ? format(new Date(selectedInvoice.paymentDate), 'dd/MM/yyyy', { locale: fr })
                      : 'Non payée'}
                  </p>
                </div>
              </div>

              {selectedInvoice.salesOrder && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Commande associée :</span>{' '}
                  <span className="font-mono font-medium">{selectedInvoice.salesOrder.number}</span>
                </div>
              )}

              {/* Linked BLs section */}
              {selectedInvoice.deliveryNotes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1">
                    <Truck className="h-4 w-4 text-amber-600" /> Bons de livraison facturés
                  </h4>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-amber-100/50">
                          <TableHead>N° BL</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="hidden md:table-cell">Statut</TableHead>
                          <TableHead className="text-right">Total TTC</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.deliveryNotes.map((rel) => (
                          <TableRow key={rel.id}>
                            <TableCell className="font-mono font-medium text-sm">{rel.deliveryNote.number}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                              {format(new Date(rel.deliveryNote.date), 'dd/MM/yyyy', { locale: fr })}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="secondary" className={
                                rel.deliveryNote.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                              }>
                                {rel.deliveryNote.status === 'delivered' ? 'Livré' : 'Confirmé'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">{formatCurrency(rel.deliveryNote.totalTTC)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
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
                  {selectedInvoice.lines.map((line) => (
                    <TableRow key={line.id || line.productId}>
                      <TableCell className="font-medium">{line.product ? `${line.product.reference} - ${line.product.designation}` : (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{line.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(line.totalHT || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Payments & Credit Notes */}
              {selectedInvoice.payments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1">
                    <DollarSign className="h-4 w-4" /> Paiements
                  </h4>
                  <div className="space-y-1">
                    {selectedInvoice.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm bg-green-50 rounded px-3 py-2">
                        <span>{payment.method} - {format(new Date(payment.date), 'dd/MM/yyyy', { locale: fr })}</span>
                        <span className="font-medium text-green-700">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.creditNotes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1">
                    <RotateCcw className="h-4 w-4" /> Avoirs
                  </h4>
                  <div className="space-y-1">
                    {selectedInvoice.creditNotes.map((cn) => (
                      <div key={cn.id} className="flex items-center justify-between text-sm bg-orange-50 rounded px-3 py-2">
                        <span className="font-mono">{cn.number}</span>
                        <span className="font-medium text-orange-700">-{formatCurrency(cn.totalTTC)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {selectedInvoice.notes}</div>
              )}

              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                {selectedInvoice.discountRate > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Remise</span><span>{selectedInvoice.discountRate}%</span></div>
                )}
                {selectedInvoice.shippingCost > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Frais de port</span><span>{formatCurrency(selectedInvoice.shippingCost)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(selectedInvoice.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(selectedInvoice.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span>{formatCurrency(selectedInvoice.totalTTC)}</span></div>
                <div className="flex justify-between text-sm italic text-muted-foreground pt-1">
                  <span>Arrêtée la présente facture à la somme de :</span>
                </div>
                <div className="text-sm font-medium italic text-right mt-1">
                  {numberToFrenchWords(selectedInvoice.totalTTC || 0)} dirhams
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedInvoice) return
                    const linesHT = selectedInvoice.lines.reduce((s, l) => s + (l.totalHT || (l.quantity * l.unitPrice)), 0)
                    const discountAmount = selectedInvoice.discountRate > 0 ? linesHT * selectedInvoice.discountRate / 100 : 0
                    printDocument({
                      title: 'FACTURE',
                      docNumber: selectedInvoice.number,
                      infoGrid: [
                        { label: 'Client', value: selectedInvoice.client.name },
                        { label: 'Date', value: fmtDate(selectedInvoice.date) },
                        { label: 'Échéance', value: fmtDate(selectedInvoice.dueDate) },
                        { label: 'Paiement', value: selectedInvoice.paymentDate ? fmtDate(selectedInvoice.paymentDate) : statusLabels[selectedInvoice.status] || selectedInvoice.status },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Remise', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: selectedInvoice.lines.map(line => [
                        { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                        { value: line.quantity, align: 'right' },
                        { value: fmtMoney(line.unitPrice), align: 'right' },
                        { value: '0', align: 'right' },
                        { value: fmtMoney(line.totalHT || 0), align: 'right' },
                      ]),
                      totals: [
                        ...(selectedInvoice.discountRate > 0 ? [{ label: `Remise (${selectedInvoice.discountRate}%)`, value: `-${fmtMoney(discountAmount)}` }] : []),
                        ...(selectedInvoice.shippingCost > 0 ? [{ label: 'Frais de port', value: fmtMoney(selectedInvoice.shippingCost) }] : []),
                        { label: 'Total HT', value: fmtMoney(selectedInvoice.totalHT) },
                        { label: 'TVA', value: fmtMoney(selectedInvoice.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(selectedInvoice.totalTTC), bold: true },
                      ],
                      notes: selectedInvoice.notes || undefined,
                      amountInWords: numberToFrenchWords(selectedInvoice.totalTTC || 0) + ' dirhams',
                      amountInWordsLabel: 'Arrêté la présente facture à la somme de',
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {(selectedInvoice.status === 'draft') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailOpen(false)
                      openEdit(selectedInvoice)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                )}
                {getActions(selectedInvoice).map((action) => (
                  <Button
                    key={action.action}
                    variant={action.action === 'pay' ? 'default' : 'outline'}
                    onClick={() => {
                      handleAction(selectedInvoice, action.action)
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
