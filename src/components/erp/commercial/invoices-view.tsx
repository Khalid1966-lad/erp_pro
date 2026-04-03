'use client'

import { useState, useEffect, useMemo } from 'react'
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
  XCircle, Trash2, Edit, DollarSign, ShieldCheck, RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

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
}

interface Client { id: string; name: string }
interface Product { id: string; reference: string; designation: string; priceHT: number; tvaRate: number }

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

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formDiscountRate, setFormDiscountRate] = useState('0')
  const [formShippingCost, setFormShippingCost] = useState('0')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<InvoiceLine[]>([emptyLine()])

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

  const fetchDropdowns = async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        api.get<{ clients: Client[] }>('/clients'),
        api.get<{ products: Product[] }>('/products')
      ])
      setClients(clientsRes.clients || [])
      setProducts(productsRes.products || [])
    } catch (err) {
      console.error('Erreur chargement dropdowns:', err)
    }
  }

  useEffect(() => {
    fetchInvoices()
    fetchDropdowns()
  }, [statusFilter])

  const handleSearch = () => fetchInvoices()

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

  const openCreate = () => {
    setSelectedInvoice(null)
    setFormClientId('')
    const in30 = new Date()
    in30.setDate(in30.getDate() + 30)
    setFormDueDate(in30.toISOString().slice(0, 10))
    setFormDiscountRate('0')
    setFormShippingCost('0')
    setFormNotes('')
    setFormLines([emptyLine()])
    setDialogOpen(true)
  }

  const openDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setDetailOpen(true)
  }

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

  const handleSave = async () => {
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
      toast.error('Veuillez indiquer une date d\'échéance')
      return
    }

    try {
      setSaving(true)
      const dueDateISO = new Date(formDueDate + 'T23:59:59.000Z').toISOString()
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
      const prod = products.find(p => p.id === value)
      if (prod) {
        updated[idx].unitPrice = prod.priceHT
        updated[idx].tvaRate = prod.tvaRate
      }
    }
    setFormLines(updated)
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
          <div className="max-h-[500px] overflow-y-auto">
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
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium">{invoice.number}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{invoice.client.name}</span>
                          {invoice.salesOrder && (
                            <p className="text-xs text-muted-foreground">BC {invoice.salesOrder.number}</p>
                          )}
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
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(invoice)}>
                            <Eye className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                          <Select value={line.productId} onValueChange={(v) => updateLine(idx, 'productId', v)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Produit" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.reference} - {p.designation}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                              <SelectItem value="2.1">2,1%</SelectItem>
                              <SelectItem value="5.5">5,5%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
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
                <Label>Frais de port (€)</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Création...' : 'Créer la facture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {selectedInvoice?.number}
              {selectedInvoice && (
                <Badge variant="secondary" className={statusColors[selectedInvoice.status]}>
                  {statusLabels[selectedInvoice.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
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
                      <TableCell className="font-medium">{line.product?.reference} - {line.product?.designation}</TableCell>
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
              </div>

              <DialogFooter>
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
