'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'
import {
  FileText, Plus, Search, MoreVertical, Eye, Send, CheckCircle, XCircle, ArrowRight,
  Trash2, Edit, Printer, Check, ChevronsUpDown, Loader2, Pencil, Clock, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { HelpButton } from '@/components/erp/shared/help-button'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

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
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

interface Quote {
  id: string
  number: string
  status: string
  date: string
  validUntil: string
  discountRate: number
  shippingCost: number
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  client: { id: string; name: string }
  lines: QuoteLine[]
}

interface ClientOption {
  id: string
  name: string
  raisonSociale: string | null
  nomCommercial: string | null
  ice: string | null
  ville: string | null
  statut: string | null
}

interface ProductOption {
  id: string
  reference: string
  designation: string
  priceHT: number
  tvaRate: number
  productUsage: string
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Rejeté',
  expired: 'Expiré',
  cancelled: 'Annulé'
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-200 text-gray-700'
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <FileText className="h-4 w-4" />, color: 'text-slate-400' },
    sent: { icon: <Send className="h-4 w-4" />, color: 'text-blue-500' },
    accepted: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
    rejected: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
    expired: { icon: <Clock className="h-4 w-4" />, color: 'text-orange-500' },
    cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500' },
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

const quoteLegendItems = [
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Brouillon', color: 'text-slate-400' },
  { icon: <Send className="h-3.5 w-3.5" />, label: 'Envoyé', color: 'text-blue-500' },
  { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Accepté', color: 'text-green-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Rejeté', color: 'text-red-500' },
  { icon: <Clock className="h-3.5 w-3.5" />, label: 'Expiré', color: 'text-orange-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulé', color: 'text-gray-500' },
]

const emptyLine = (): QuoteLine => ({
  productId: '',
  quantity: 1,
  unitPrice: 0,
  tvaRate: 20,
  discount: 0
})

export default function QuotesView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)

  // Dropdown data for comboboxes
  const [allClients, setAllClients] = useState<ClientOption[]>([])
  const [allProducts, setAllProducts] = useState<ProductOption[]>([])
  const [dropdownsLoading, setDropdownsLoading] = useState(false)

  // Client combobox state
  const [clientSearch, setClientSearch] = useState('')
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)

  // Product combobox state per line
  const [lineSearches, setLineSearches] = useState<Record<number, string>>({})

  // Form state
  const [formNumber, setFormNumber] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formValidUntil, setFormValidUntil] = useState('')
  const [formDiscountRate, setFormDiscountRate] = useState('0')
  const [formShippingCost, setFormShippingCost] = useState('0')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<QuoteLine[]>([emptyLine()])

  const fetchQuotes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ quotes: Quote[]; total: number }>(`/quotes?${params.toString()}`)
      setQuotes(data.quotes)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement devis')
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdowns = useCallback(async () => {
    try {
      setDropdownsLoading(true)
      const [clientsRes, productsRes] = await Promise.all([
        api.get<{ clients: ClientOption[] }>('/clients?dropdown=true'),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      setAllClients(clientsRes.clients || [])
      setAllProducts(productsRes.products || [])
    } catch (err) {
      console.error('Erreur chargement dropdowns:', err)
    } finally {
      setDropdownsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotes()
    fetchDropdowns()
    setExpandedQuoteId(null)
  }, [statusFilter, fetchDropdowns])

  const handleSearch = () => {
    setExpandedQuoteId(null)
    fetchQuotes()
  }

  const filteredQuotes = useMemo(() => quotes, [quotes])

  // Client combobox: filter by raisonSociale / name
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients
    const q = clientSearch.toLowerCase()
    return allClients.filter(c =>
      (c.raisonSociale && c.raisonSociale.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.nomCommercial && c.nomCommercial.toLowerCase().includes(q)) ||
      (c.ice && c.ice.toLowerCase().includes(q))
    )
  }, [allClients, clientSearch])

  const selectedClient = useMemo(() => {
    return allClients.find(c => c.id === formClientId)
  }, [allClients, formClientId])

  // Product combobox: filter by designation / reference
  const getFilteredProducts = useCallback((idx: number) => {
    const q = (lineSearches[idx] || '').toLowerCase()
    if (!q.trim()) return allProducts
    return allProducts.filter(p =>
      p.designation.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q)
    )
  }, [allProducts, lineSearches])

  const calcFormTotals = useMemo(() => {
    let totalHT = 0
    let totalTVA = 0
    for (const line of formLines) {
      const lineHT = line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100)
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

  const openCreate = () => {
    setEditingQuote(null)
    setSelectedQuote(null)
    setFormNumber('') // auto-generated server-side
    setFormClientId('')
    setClientSearch('')
    setLineSearches({})
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    setFormValidUntil(in30.toISOString().slice(0, 10))
    setFormDiscountRate('0')
    setFormShippingCost('0')
    setFormNotes('')
    setFormLines([emptyLine()])
    setDialogOpen(true)
  }

  const openDetail = (quote: Quote) => {
    setSelectedQuote(quote)
    setDetailOpen(true)
  }

  const handleStatusChange = async (quote: Quote, newStatus: string) => {
    try {
      await api.put('/quotes', { id: quote.id, status: newStatus })
      toast.success(`Devis ${quote.number} mis à jour`)
      fetchQuotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur mise à jour')
    }
  }

  const handleTransform = async (quote: Quote) => {
    try {
      await api.put('/quotes', { id: quote.id, action: 'transform' })
      toast.success(`Devis ${quote.number} transformé en commande`)
      fetchQuotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur transformation')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/quotes?id=${id}`)
      toast.success('Devis supprimé')
      fetchQuotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur suppression')
    }
  }

  const handleSave = async () => {
    // Number is auto-generated — no manual validation needed
    if (!formClientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    const validLines = formLines.filter(l => l.productId)
    if (validLines.length === 0) {
      toast.error('Au moins une ligne est requise')
      return
    }
    if (!formValidUntil) {
      toast.error('Veuillez indiquer une date de validité')
      return
    }

    try {
      setSaving(true)
      const validUntilDate = new Date(formValidUntil + 'T23:59:59.000Z')
      await api.post('/quotes', {
        clientId: formClientId,
        status: 'draft',
        validUntil: validUntilDate.toISOString(),
        discountRate: parseFloat(formDiscountRate) || 0,
        shippingCost: parseFloat(formShippingCost) || 0,
        notes: formNotes || undefined,
        lines: validLines.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
          discount: l.discount || 0
        }))
      })
      toast.success('Devis créé')
      setDialogOpen(false)
      fetchQuotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur création')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (quote: Quote) => {
    setEditingQuote(quote)
    setSelectedQuote(quote)
    setFormNumber(quote.number)
    setFormClientId(quote.client.id)
    setClientSearch('')
    setLineSearches({})
    setFormValidUntil(quote.validUntil.slice(0, 10))
    setFormDiscountRate(String(quote.discountRate))
    setFormShippingCost(String(quote.shippingCost))
    setFormNotes(quote.notes || '')
    setFormLines(quote.lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, tvaRate: l.tvaRate, discount: l.discount || 0 })))
    setDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingQuote) return
    if (!formClientId) {
      toast.error('Veuillez sélectionner un client')
      return
    }
    const validLines = formLines.filter(l => l.productId)
    if (validLines.length === 0) {
      toast.error('Au moins une ligne est requise')
      return
    }
    if (!formValidUntil) {
      toast.error('Veuillez indiquer une date de validité')
      return
    }

    try {
      setSaving(true)
      const validUntilDate = new Date(formValidUntil + 'T23:59:59.000Z')
      await api.put('/quotes', {
        id: editingQuote.id,
        clientId: formClientId,
        validUntil: validUntilDate.toISOString(),
        discountRate: parseFloat(formDiscountRate) || 0,
        shippingCost: parseFloat(formShippingCost) || 0,
        notes: formNotes || undefined,
        lines: validLines.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
          discount: l.discount || 0
        }))
      })
      toast.success('Devis modifié')
      setDialogOpen(false)
      fetchQuotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur modification')
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => setFormLines([...formLines, emptyLine()])
  const removeLine = (idx: number) => setFormLines(formLines.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: keyof QuoteLine, value: string | number) => {
    const updated = [...formLines]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'productId') {
      const prod = allProducts.find(p => p.id === value)
      if (prod) {
        updated[idx].unitPrice = prod.priceHT
        updated[idx].tvaRate = prod.tvaRate
      }
    }
    setFormLines(updated)
  }

  const getStatusActions = (quote: Quote) => {
    const actions: { label: string; icon: React.ReactNode; status: string; variant?: string }[] = []
    switch (quote.status) {
      case 'draft':
        actions.push({ label: 'Envoyer', icon: <Send className="h-4 w-4" />, status: 'sent' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, status: 'cancelled' })
        break
      case 'sent':
        actions.push({ label: 'Accepter', icon: <CheckCircle className="h-4 w-4" />, status: 'accepted' })
        actions.push({ label: 'Rejeter', icon: <XCircle className="h-4 w-4" />, status: 'rejected' })
        actions.push({ label: 'Marquer expiré', icon: <XCircle className="h-4 w-4" />, status: 'expired' })
        break
      case 'rejected':
      case 'expired':
      case 'cancelled':
        actions.push({ label: 'Remettre en brouillon', icon: <Edit className="h-4 w-4" />, status: 'draft' })
        break
      case 'accepted':
        actions.push({ label: 'Transformer en commande', icon: <ArrowRight className="h-4 w-4" />, status: 'transform' })
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
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Devis</h2>
          <Badge variant="secondary">{quotes.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="devis" />
          <Button variant="outline" size="sm" onClick={fetchQuotes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau devis
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
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="sent">Envoyé</SelectItem>
            <SelectItem value="accepted">Accepté</SelectItem>
            <SelectItem value="rejected">Rejeté</SelectItem>
            <SelectItem value="expired">Expiré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <IconLegend items={quoteLegendItems} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total HT</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || statusFilter !== 'all' ? 'Aucun devis trouvé.' : 'Aucun devis enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className={cn("cursor-pointer", expandedQuoteId === quote.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)} onDoubleClick={() => openEdit(quote)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(quote.status)}
                          <span className="font-mono font-medium">{quote.number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{quote.client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(quote.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {format(new Date(quote.validUntil), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[quote.status] || ''}>
                          {statusLabels[quote.status] || quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">
                        {formatCurrency(quote.totalHT)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-semibold">
                        {formatCurrency(quote.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(quote)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(quote.status === 'draft' || quote.status === 'rejected' || quote.status === 'expired' || quote.status === 'cancelled') && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(quote) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {getStatusActions(quote).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getStatusActions(quote).map((action) => (
                                  <DropdownMenuItem
                                    key={action.status}
                                    onClick={() => {
                                      if (action.status === 'transform') {
                                        handleTransform(quote)
                                      } else {
                                        handleStatusChange(quote, action.status)
                                      }
                                    }}
                                  >
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {quote.status === 'draft' && (
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
                                          <AlertDialogTitle>Supprimer le devis</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Êtes-vous sûr de vouloir supprimer le devis <strong>{quote.number}</strong> ?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(quote.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
      {expandedQuoteId && (() => {
        const eq = quotes.find(q => q.id === expandedQuoteId)
        if (!eq) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{eq.number}</span>
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
                      title: 'DEVIS',
                      docNumber: eq.number,
                      infoGrid: [
                        { label: 'Client', value: eq.client.name },
                        { label: 'Date', value: fmtDate(eq.date) },
                        { label: 'Validité', value: fmtDate(eq.validUntil) },
                        { label: 'Remise', value: `${eq.discountRate}%` },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Remise', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: eq.lines.map(l => [
                        { value: `${l.product?.reference || ''} - ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                        { value: fmtMoney(l.unitPrice), align: 'right' },
                        { value: `${l.discount || 0}%`, align: 'right' },
                        { value: fmtMoney(l.totalHT || 0), align: 'right' },
                      ]),
                      totals: [
                        ...(eq.shippingCost > 0 ? [{ label: 'Frais de port', value: fmtMoney(eq.shippingCost) }] : []),
                        { label: 'Total HT', value: fmtMoney(eq.totalHT) },
                        { label: 'TVA', value: fmtMoney(eq.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(eq.totalTTC), bold: true },
                      ],
                      notes: eq.notes || undefined,
                      amountInWords: `${numberToFrenchWords(eq.totalTTC || 0)} dirhams`,
                      amountInWordsLabel: 'Arrêté le présent devis à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  {(eq.status === 'draft' || eq.status === 'rejected' || eq.status === 'expired' || eq.status === 'cancelled') && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(eq)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedQuoteId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Validité</span>
                  <p className="font-medium">{format(new Date(eq.validUntil), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Remise</span>
                  <p className="font-medium">{eq.discountRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Frais de port</span>
                  <p className="font-medium">{formatCurrency(eq.shippingCost)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Lignes</span>
                  <p className="font-medium">{eq.lines.length}</p>
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
                        <TableHead className="text-right w-[70px]">TVA</TableHead>
                        <TableHead className="text-right w-[70px]">Remise</TableHead>
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingQuote ? (
                <>
                  <FileText className="h-5 w-5" />
                  Modifier — {editingQuote.number}
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Nouveau devis
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto scrollbar-visible max-h-[calc(90vh-8rem)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quote Number — auto-generated */}
              <div className="space-y-2">
                <Label>N° Devis</Label>
                <Input
                  value={editingQuote ? editingQuote.number : 'Auto-généré à la création'}
                  className="font-mono bg-muted/50"
                  disabled
                />
                <p className="text-[10px] text-muted-foreground">Numéro automatique non modifiable (DEV-YYYY-NNNN)</p>
              </div>
              {/* Client searchable combobox */}
              <div className="space-y-2">
                <Label>Client *</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {dropdownsLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement...
                        </span>
                      ) : selectedClient ? (
                        <span>
                          {selectedClient.raisonSociale || selectedClient.name}
                          {selectedClient.ice && (
                            <span className="ml-2 text-xs text-muted-foreground">({selectedClient.ice})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sélectionner un client...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher par raison sociale..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Aucun client trouvé.
                        </div>
                      ) : (
                        filteredClients.map((c) => (
                          <div
                            key={c.id}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent text-sm',
                              formClientId === c.id && 'bg-accent'
                            )}
                            onClick={() => {
                              setFormClientId(c.id)
                              setClientSearch('')
                              setClientPopoverOpen(false)
                            }}
                          >
                            {formClientId === c.id && <Check className="h-4 w-4 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {c.raisonSociale || c.name || '—'}
                              </div>
                              {c.nomCommercial && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {c.nomCommercial}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-2">
                              {c.ville && <span>{c.ville}</span>}
                              {c.ice && <span>{c.ice}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Valide jusqu&apos;au *</Label>
                <Input type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} />
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
                          {/* Product searchable combobox */}
                          <ProductCombobox
                            products={getFilteredProducts(idx)}
                            value={line.productId}
                            loading={dropdownsLoading}
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
                          {formatCurrency(line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100))}
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
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={editingQuote ? handleUpdate : handleSave} disabled={saving}>
              {saving
                ? (editingQuote ? 'Modification...' : 'Création...')
                : (editingQuote ? 'Enregistrer les modifications' : 'Créer le devis')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedQuote?.number}
              {selectedQuote && (
                <Badge variant="secondary" className={statusColors[selectedQuote.status]}>
                  {statusLabels[selectedQuote.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto scrollbar-visible max-h-[calc(90vh-8rem)]">
          {selectedQuote && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedQuote.client.name}</p></div>
                <div><span className="text-muted-foreground">Date</span><p className="font-medium">{format(new Date(selectedQuote.date), 'dd/MM/yyyy', { locale: fr })}</p></div>
                <div><span className="text-muted-foreground">Validité</span><p className="font-medium">{format(new Date(selectedQuote.validUntil), 'dd/MM/yyyy', { locale: fr })}</p></div>
                <div><span className="text-muted-foreground">Remise</span><p className="font-medium">{selectedQuote.discountRate}%</p></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U. HT</TableHead>
                    <TableHead className="text-right">Remise</TableHead>
                    <TableHead className="text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedQuote.lines.map((line) => (
                    <TableRow key={line.id || line.productId}>
                      <TableCell className="font-medium">{line.product ? `${line.product.reference} - ${line.product.designation}` : (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{line.discount || 0}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(line.totalHT || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedQuote.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {selectedQuote.notes}</div>
              )}

              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                {selectedQuote.shippingCost > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Frais de port</span><span>{formatCurrency(selectedQuote.shippingCost)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(selectedQuote.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(selectedQuote.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total TTC</span><span>{formatCurrency(selectedQuote.totalTTC)}</span></div>
                <div className="flex justify-between text-sm italic text-muted-foreground pt-1">
                  <span>Arrêté le présent devis à la somme de :</span>
                </div>
                <div className="text-sm font-medium italic text-right mt-1">
                  {numberToFrenchWords(selectedQuote.totalTTC || 0)} dirhams
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedQuote) return
                    printDocument({
                      title: 'DEVIS',
                      docNumber: selectedQuote.number,
                      infoGrid: [
                        { label: 'Client', value: selectedQuote.client.name },
                        { label: 'Date', value: fmtDate(selectedQuote.date) },
                        { label: 'Validité', value: fmtDate(selectedQuote.validUntil) },
                        { label: 'Remise', value: `${selectedQuote.discountRate}%` },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Remise', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: selectedQuote.lines.map(l => [
                        { value: `${l.product?.reference || ''} - ${l.product?.designation || ''}` },
                        { value: l.quantity, align: 'right' },
                        { value: fmtMoney(l.unitPrice), align: 'right' },
                        { value: `${l.discount || 0}%`, align: 'right' },
                        { value: fmtMoney(l.totalHT || 0), align: 'right' },
                      ]),
                      totals: [
                        ...(selectedQuote.shippingCost > 0 ? [{ label: 'Frais de port', value: fmtMoney(selectedQuote.shippingCost) }] : []),
                        { label: 'Total HT', value: fmtMoney(selectedQuote.totalHT) },
                        { label: 'TVA', value: fmtMoney(selectedQuote.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(selectedQuote.totalTTC), bold: true },
                      ],
                      notes: selectedQuote.notes || undefined,
                      amountInWords: `${numberToFrenchWords(selectedQuote.totalTTC || 0)} dirhams`,
                      amountInWordsLabel: 'Arrêté le présent devis à la somme de',
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {(selectedQuote.status === 'draft' || selectedQuote.status === 'rejected' || selectedQuote.status === 'expired' || selectedQuote.status === 'cancelled') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailOpen(false)
                      openEdit(selectedQuote)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                )}
                {getStatusActions(selectedQuote).map((action) => (
                  <Button
                    key={action.status}
                    variant={action.status === 'transform' ? 'default' : 'outline'}
                    onClick={() => {
                      if (action.status === 'transform') {
                        handleTransform(selectedQuote)
                      } else {
                        handleStatusChange(selectedQuote, action.status)
                      }
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── ProductCombobox sub-component ───────────────────────────────────────────────
function ProductCombobox({
  products,
  value,
  loading,
  searchValue,
  onSearchChange,
  onSelect,
}: {
  products: ProductOption[]
  value: string
  loading: boolean
  searchValue: string
  onSearchChange: (val: string) => void
  onSelect: (productId: string) => void
}) {
  const [open, setOpen] = useState(false)

  // Compute the label for the selected product
  const selected = useMemo(() => products.find(p => p.id === value), [products, value])
  const selectedLabel = useMemo(() => {
    if (selected) return `${selected.reference} - ${selected.designation}`
    return ''
  }, [selected])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9 text-xs"
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Chargement...
            </span>
          ) : selected || selectedLabel ? (
            <span className="truncate">
              {selected ? `${selected.reference} - ${selected.designation}` : selectedLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">Produit...</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[550px] p-0" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Désignation / Réf..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-[250px] overflow-y-auto">
          {products.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Aucun produit trouvé.
            </div>
          ) : (
            products.slice(0, 50).map((p) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-xs',
                  value === p.id && 'bg-accent'
                )}
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                }}
              >
                {value === p.id && <Check className="h-3 w-3 shrink-0" />}
                <span className="font-mono shrink-0 text-muted-foreground">{p.reference}</span>
                <span className="truncate flex-1">{p.designation}</span>
                <span className="shrink-0 font-medium">{formatCurrency(p.priceHT)}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
