'use client'

import { useState, useEffect, useCallback } from 'react'
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
  RotateCcw, Plus, Search, MoreVertical, Eye, Trash2, CheckCircle, XCircle, ShieldCheck, Pencil, Printer
} from 'lucide-react'
import { PrintHeader, PrintFooter } from '@/components/erp/shared/print-header'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ProductCombobox, ProductOption, useProductSearch } from '@/components/erp/shared/product-combobox'
import { HelpButton } from '@/components/erp/shared/help-button'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface CreditNoteLine {
  id?: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT?: number
  discount?: number
  product?: { id: string; reference: string; designation: string }
}

interface CreditNote {
  id: string
  number: string
  status: string
  date: string
  reason: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  client: { id: string; name: string }
  invoice: { id: string; number: string }
  lines: CreditNoteLine[]
}

interface Invoice {
  id: string
  number: string
  client: { id: string; name: string }
  lines: { id: string; productId: string; quantity: number; unitPrice: number; tvaRate: number; product: { id: string; reference: string; designation: string } }[]
}

interface Product { id: string; reference: string; designation: string; priceHT: number; tvaRate: number }

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  applied: 'Appliqué',
  cancelled: 'Annulé'
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  validated: 'bg-emerald-100 text-emerald-800',
  applied: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

const emptyLine = (): CreditNoteLine => ({
  productId: '',
  quantity: 1,
  unitPrice: 0,
  tvaRate: 20
})

export default function CreditNotesView() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCN, setSelectedCN] = useState<CreditNote | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [allProducts, setAllProducts] = useState<ProductOption[]>([])

  // Form state
  const [formInvoiceId, setFormInvoiceId] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formLines, setFormLines] = useState<CreditNoteLine[]>([emptyLine()])
  const [expandedCNId, setExpandedCNId] = useState<string | null>(null)

  const fetchCreditNotes = async () => {
    try {
      setLoading(true)
      setExpandedCNId(null)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ creditNotes: CreditNote[]; total: number }>(`/credit-notes?${params.toString()}`)
      setCreditNotes(data.creditNotes)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement avoirs')
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdowns = useCallback(async () => {
    try {
      const [invoicesRes, productsRes] = await Promise.all([
        api.get<{ invoices: Invoice[] }>('/invoices'),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      // Only show invoices that are validated/sent/paid (not draft/cancelled) for creating credit notes
      setInvoices((invoicesRes.invoices || []).filter((inv) => !['draft', 'cancelled'].includes(inv.status)))
      setAllProducts(productsRes.products || [])
    } catch (err) {
      console.error('Erreur chargement dropdowns:', err)
    }
  }, [])

  useEffect(() => {
    setExpandedCNId(null)
    fetchCreditNotes()
    fetchDropdowns()
  }, [statusFilter, fetchDropdowns])

  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(allProducts)

  const handleSearch = () => fetchCreditNotes()

  const calcFormTotals = () => {
    let totalHT = 0
    let totalTVA = 0
    for (const line of formLines) {
      if (!line.productId) continue
      const lineHT = line.quantity * line.unitPrice
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
    }
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }

  const openCreate = () => {
    setSelectedCN(null)
    setIsEditing(false)
    setFormInvoiceId('')
    setFormReason('')
    setFormLines([emptyLine()])
    resetLineSearches()
    setDialogOpen(true)
  }

  const openDetail = (cn: CreditNote) => {
    setSelectedCN(cn)
    setDetailOpen(true)
  }

  const openEdit = (cn: CreditNote) => {
    setSelectedCN(cn)
    setIsEditing(true)
    setFormInvoiceId(cn.invoice.id)
    setFormReason(cn.reason || '')
    setFormLines(
      cn.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        tvaRate: l.tvaRate,
        product: l.product
      }))
    )
    resetLineSearches()
    setDialogOpen(true)
  }

  const handleAction = async (cn: CreditNote, action: string) => {
    try {
      await api.put('/credit-notes', { id: cn.id, action })
      const labels: Record<string, string> = {
        validate: 'validé',
        apply: 'appliqué',
        cancel: 'annulé'
      }
      toast.success(`Avoir ${cn.number} ${labels[action]}`)
      fetchCreditNotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur action')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/credit-notes?id=${id}`)
      toast.success('Avoir supprimé')
      fetchCreditNotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur suppression')
    }
  }

  const handleSave = async () => {
    if (!formInvoiceId) {
      toast.error('Veuillez sélectionner une facture')
      return
    }
    const validLines = formLines.filter(l => l.productId)
    if (validLines.length === 0) {
      toast.error('Au moins une ligne est requise')
      return
    }

    try {
      setSaving(true)
      const payload = {
        invoiceId: formInvoiceId,
        reason: formReason || undefined,
        lines: validLines.map(l => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate
        }))
      }

      if (isEditing && selectedCN) {
        await api.put('/credit-notes', { id: selectedCN.id, ...payload })
        toast.success('Avoir modifié')
      } else {
        await api.post('/credit-notes', payload)
        toast.success('Avoir créé')
      }
      setDialogOpen(false)
      fetchCreditNotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const handleInvoiceChange = (invoiceId: string) => {
    setFormInvoiceId(invoiceId)
    const invoice = invoices.find(inv => inv.id === invoiceId)
    if (invoice) {
      setFormLines(
        invoice.lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
          product: l.product
        }))
      )
    }
  }

  const addLine = () => setFormLines([...formLines, emptyLine()])
  const removeLine = (idx: number) => setFormLines(formLines.filter((_, i) => i !== idx))
  const updateLine = (idx: number, field: keyof CreditNoteLine, value: string | number) => {
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

  const getActions = (cn: CreditNote) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (cn.status) {
      case 'draft':
        actions.push({ label: 'Valider', icon: <ShieldCheck className="h-4 w-4" />, action: 'validate' })
        break
      case 'validated':
        actions.push({ label: 'Appliquer', icon: <CheckCircle className="h-4 w-4" />, action: 'apply' })
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
          <Skeleton className="h-9 w-36" />
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
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Avoirs</h2>
          <Badge variant="secondary">{creditNotes.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="avoirs" />
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvel avoir
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
            <SelectItem value="validated">Validé</SelectItem>
            <SelectItem value="applied">Appliqué</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
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
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total HT</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || statusFilter !== 'all' ? 'Aucun avoir trouvé.' : 'Aucun avoir enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  creditNotes.map((creditNote) => (
                    <TableRow key={creditNote.id} className={cn("cursor-pointer", expandedCNId === creditNote.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedCNId(expandedCNId === creditNote.id ? null : creditNote.id)} onDoubleClick={() => openEdit(creditNote)}>
                      <TableCell className="font-mono font-medium">{creditNote.number}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{creditNote.invoice.number}</TableCell>
                      <TableCell>{creditNote.client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(creditNote.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[creditNote.status] || ''}>
                          {statusLabels[creditNote.status] || creditNote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium text-red-600">
                        -{formatCurrency(creditNote.totalHT)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-semibold text-red-600">
                        -{formatCurrency(creditNote.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(creditNote)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {creditNote.status === 'draft' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(creditNote) }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {getActions(creditNote).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActions(creditNote).map((action) => (
                                  <DropdownMenuItem key={action.action} onClick={() => handleAction(creditNote, action.action)}>
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {creditNote.status === 'draft' && (
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
                                          <AlertDialogTitle>Supprimer l&apos;avoir</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Êtes-vous sûr de vouloir supprimer l&apos;avoir <strong>{creditNote.number}</strong> ?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(creditNote.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Inline Detail Panel */}
      {expandedCNId && (() => {
        const ecn = creditNotes.find(c => c.id === expandedCNId)
        if (!ecn) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{ecn.number}</span>
                      <Badge variant="secondary" className={statusColors[ecn.status]}>{statusLabels[ecn.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ecn.client.name} — {format(new Date(ecn.date), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openDetail(ecn)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!ecn) return
                    printDocument({
                      title: 'AVOIR',
                      docNumber: ecn.number,
                      infoGrid: [
                        { label: 'Client', value: ecn.client.name },
                        { label: 'Facture', value: ecn.invoice?.number || '—' },
                        { label: 'Date', value: fmtDate(ecn.date) },
                        { label: 'Motif', value: ecn.reason || '—' },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'TVA%', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: ecn.lines.map(line => [
                        { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                        { value: line.quantity, align: 'right' },
                        { value: fmtMoney(line.unitPrice), align: 'right' },
                        { value: `${line.tvaRate}%`, align: 'right' },
                        { value: fmtMoney(line.totalHT || 0), align: 'right' },
                      ]),
                      totals: [
                        { label: 'Total HT', value: `-${fmtMoney(ecn.totalHT)}`, negative: true },
                        { label: 'TVA', value: `-${fmtMoney(ecn.totalTVA)}`, negative: true },
                        { label: 'Total TTC', value: `-${fmtMoney(ecn.totalTTC)}`, bold: true, negative: true },
                      ],
                      notes: ecn.reason || undefined,
                      negativeTotals: true,
                      amountInWords: numberToFrenchWords(ecn.totalTTC || 0) + ' dirhams',
                      amountInWordsLabel: 'Arrêté le présent avoir à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  {ecn.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(ecn)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedCNId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Facture liée</span>
                  <p className="font-medium font-mono">{ecn.invoice?.number || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Motif</span>
                  <p className="font-medium">{ecn.reason || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Nb Lignes</span>
                  <p className="font-medium">{ecn.lines.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Total TTC</span>
                  <p className="font-medium text-red-600">-{formatCurrency(ecn.totalTTC)}</p>
                </div>
              </div>

              {ecn.lines.length > 0 && (
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
                      {ecn.lines.map((line) => (
                        <TableRow key={line.id || line.productId}>
                          <TableCell className="font-medium text-sm">
                            <span className="font-mono text-muted-foreground mr-2">{line.product?.reference || ''}</span>
                            {line.product?.designation || '—'}
                          </TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right">{line.tvaRate}%</TableCell>
                          <TableCell className="text-right">{line.discount != null ? `${line.discount}%` : '—'}</TableCell>
                          <TableCell className="text-right font-medium text-red-600">-{formatCurrency(line.totalHT || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ecn.reason && (
                <div className="text-sm"><span className="text-muted-foreground">Motif :</span> {ecn.reason}</div>
              )}

              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium text-red-600">-{formatCurrency(ecn.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium text-red-600">-{formatCurrency(ecn.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span className="text-red-600">-{formatCurrency(ecn.totalTTC)}</span></div>
                <div className="text-sm italic text-muted-foreground pt-1">{numberToFrenchWords(ecn.totalTTC || 0)} dirhams</div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setIsEditing(false); setDialogOpen(open) }}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <RotateCcw className="h-5 w-5" />
                  Modifier — {selectedCN?.number}
                </>
              ) : (
                <>
                  <RotateCcw className="h-5 w-5" />
                  Nouvel avoir
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Facture source *</Label>
              <Select value={formInvoiceId} onValueChange={handleInvoiceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une facture" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.number} - {inv.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Motif</Label>
              <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Motif de l'avoir (retour, remise, erreur...)" rows={2} />
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
                        <TableCell className="text-right font-medium text-sm text-red-600">
                          {line.productId ? `-${formatCurrency(line.quantity * line.unitPrice)}` : '—'}
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

            {/* Totals */}
            {(() => {
              const totals = calcFormTotals()
              return (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium text-red-700">-{formatCurrency(totals.totalHT)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium text-red-700">-{formatCurrency(totals.totalTVA)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t border-red-200 pt-2"><span>Total TTC</span><span className="text-red-700">-{formatCurrency(totals.totalTTC)}</span></div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (isEditing ? 'Modification...' : 'Création...') : (isEditing ? 'Modifier l\'avoir' : 'Créer l\'avoir')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {selectedCN?.number}
              {selectedCN && (
                <Badge variant="secondary" className={statusColors[selectedCN.status]}>
                  {statusLabels[selectedCN.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCN && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedCN.client.name}</p></div>
                <div><span className="text-muted-foreground">Facture</span><p className="font-mono font-medium">{selectedCN.invoice.number}</p></div>
                <div><span className="text-muted-foreground">Date</span><p className="font-medium">{format(new Date(selectedCN.date), 'dd/MM/yyyy', { locale: fr })}</p></div>
                {selectedCN.reason && (
                  <div><span className="text-muted-foreground">Motif</span><p className="font-medium">{selectedCN.reason}</p></div>
                )}
              </div>

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
                  {selectedCN.lines.map((line) => (
                    <TableRow key={line.id || line.productId}>
                      <TableCell className="font-medium">{line.product ? `${line.product.reference} - ${line.product.designation}` : (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{line.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium text-red-600">-{formatCurrency(line.totalHT || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium text-red-700">-{formatCurrency(selectedCN.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium text-red-700">-{formatCurrency(selectedCN.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t border-red-200 pt-2"><span>Total TTC</span><span className="text-red-700">-{formatCurrency(selectedCN.totalTTC)}</span></div>
              </div>

              <PrintFooter 
                amount={selectedCN.totalTTC} 
                label="Arrêté le présent avoir à la somme de" 
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  if (!selectedCN) return
                  printDocument({
                    title: 'AVOIR',
                    docNumber: selectedCN.number,
                    infoGrid: [
                      { label: 'Client', value: selectedCN.client.name },
                      { label: 'Facture', value: selectedCN.invoice?.number || '—' },
                      { label: 'Date', value: fmtDate(selectedCN.date) },
                      { label: 'Motif', value: selectedCN.reason || '—' },
                    ],
                    columns: [
                      { label: 'Produit' },
                      { label: 'Qté', align: 'right' },
                      { label: 'P.U. HT', align: 'right' },
                      { label: 'TVA%', align: 'right' },
                      { label: 'Total HT', align: 'right' },
                    ],
                    rows: selectedCN.lines.map(line => [
                      { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                      { value: line.quantity, align: 'right' },
                      { value: fmtMoney(line.unitPrice), align: 'right' },
                      { value: `${line.tvaRate}%`, align: 'right' },
                      { value: fmtMoney(line.totalHT || 0), align: 'right' },
                    ]),
                    totals: [
                      { label: 'Total HT', value: `-${fmtMoney(selectedCN.totalHT)}`, negative: true },
                      { label: 'TVA', value: `-${fmtMoney(selectedCN.totalTVA)}`, negative: true },
                      { label: 'Total TTC', value: `-${fmtMoney(selectedCN.totalTTC)}`, bold: true, negative: true },
                    ],
                    notes: selectedCN.notes || undefined,
                    negativeTotals: true,
                    amountInWords: numberToFrenchWords(selectedCN.totalTTC || 0) + ' dirhams',
                    amountInWordsLabel: 'Arrêté le présent avoir à la somme de',
                  })
                }}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {getActions(selectedCN).map((action) => (
                  <Button
                    key={action.action}
                    variant={action.action === 'apply' ? 'default' : 'outline'}
                    onClick={() => {
                      handleAction(selectedCN, action.action)
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
