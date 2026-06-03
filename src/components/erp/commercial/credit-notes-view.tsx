'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  RotateCcw, Plus, Search, MoreVertical, Eye, Trash2, CheckCircle, XCircle,
  ShieldCheck, Pencil, Printer, FileText, RefreshCw, Banknote, Receipt,
  Ban, ArrowDownToLine, PackageReturn, Loader2
} from 'lucide-react'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { EntityCombobox } from '@/components/erp/shared/entity-combobox'
import { HelpButton } from '@/components/erp/shared/help-button'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

// ── Types ──────────────────────────────────────────────

const formatCurrency = (n: number) =>
  (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface CreditNoteLine {
  id?: string
  creditNoteId?: string
  customerReturnLineId?: string | null
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT?: number
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
  amountUsed: number
  amountRefunded: number
  client: { id: string; name: string; raisonSociale?: string | null }
  invoice?: { id: string; number: string } | null
  customerReturns?: { id: string; number: string }[]
  lines: CreditNoteLine[]
}

interface ClientOption {
  id: string
  name: string
  raisonSociale?: string | null
  nomCommercial?: string | null
  ice?: string | null
  ville?: string | null
}

interface CustomerReturnSummary {
  id: string
  number: string
  returnDate: string
  totalTTC: number
  lineCount: number
  linkedToCreditNote: boolean
  lines: Array<{
    id: string
    productId: string
    product?: { reference: string; designation: string }
    quantity: number
    unitPrice: number
    tvaRate: number
  }>
}

interface InvoiceSummary {
  id: string
  number: string
  date: string
  totalTTC: number
  remainingAmount: number
}

// ── Status helpers ─────────────────────────────────────

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  partially_applied: 'Partiellement appliqué',
  applied: 'Appliqué',
  refunded: 'Remboursé',
  cancelled: 'Annulé',
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  validated: 'bg-emerald-100 text-emerald-800',
  partially_applied: 'bg-blue-100 text-blue-800',
  applied: 'bg-blue-100 text-blue-800',
  refunded: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <FileText className="h-4 w-4" />, color: 'text-slate-400' },
    validated: { icon: <ShieldCheck className="h-4 w-4" />, color: 'text-emerald-500' },
    partially_applied: { icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-blue-500' },
    applied: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-blue-500' },
    refunded: { icon: <Banknote className="h-4 w-4" />, color: 'text-orange-500' },
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

const creditNoteLegendItems = [
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Brouillon', color: 'text-slate-400' },
  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Validé', color: 'text-emerald-500' },
  { icon: <ArrowDownToLine className="h-3.5 w-3.5" />, label: 'Partiellement appliqué', color: 'text-blue-500' },
  { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Appliqué', color: 'text-blue-500' },
  { icon: <Banknote className="h-3.5 w-3.5" />, label: 'Remboursé', color: 'text-orange-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulé', color: 'text-red-500' },
]

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

// ── Component ──────────────────────────────────────────

export default function CreditNotesView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCN, setSelectedCN] = useState<CreditNote | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedCNId, setExpandedCNId] = useState<string | null>(null)

  // Clients dropdown
  const [clients, setClients] = useState<ClientOption[]>([])

  // Create dialog wizard state
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1)
  const [createClientId, setCreateClientId] = useState('')
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([])
  const [availableReturns, setAvailableReturns] = useState<CustomerReturnSummary[]>([])
  const [returnsLoading, setReturnsLoading] = useState(false)
  const [createReason, setCreateReason] = useState('')

  // Refund dialog state
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')

  // Apply to invoice dialog state
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyInvoiceId, setApplyInvoiceId] = useState('')
  const [applyAmount, setApplyAmount] = useState('')
  const [clientInvoices, setClientInvoices] = useState<InvoiceSummary[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  const fetchCreditNotes = useCallback(async () => {
    try {
      setLoading(true)
      setExpandedCNId(null)
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const data = await api.get<{ creditNotes: CreditNote[]; total: number }>(`/credit-notes?${params.toString()}`)
      setCreditNotes(data.creditNotes || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement avoirs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get<{ clients: ClientOption[] }>('/clients?dropdown=true')
      setClients(data.clients || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchCreditNotes()
    fetchClients()
  }, [fetchCreditNotes, fetchClients])

  const handleSearch = () => {
    setExpandedCNId(null)
    fetchCreditNotes()
  }

  // ── Create wizard helpers ────────────────────────────

  const resetCreateForm = () => {
    setCreateStep(1)
    setCreateClientId('')
    setSelectedReturnIds([])
    setAvailableReturns([])
    setReturnsLoading(false)
    setCreateReason('')
  }

  const openCreate = () => {
    resetCreateForm()
    setDialogOpen(true)
  }

  // When client is selected in step 1, move to step 2 and fetch restocked returns
  useEffect(() => {
    if (createStep === 2 && createClientId) {
      fetchRestockedReturns(createClientId)
    }
  }, [createStep, createClientId])

  const fetchRestockedReturns = async (clientId: string) => {
    try {
      setReturnsLoading(true)
      const data = await api.get<{ customerReturns: CustomerReturnSummary[] }>(
        `/customer-returns?clientId=${clientId}&status=restocked`
      )
      setAvailableReturns(data.customerReturns || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || 'Erreur chargement des retours')
      setAvailableReturns([])
    } finally {
      setReturnsLoading(false)
    }
  }

  const toggleReturnSelection = (returnId: string) => {
    setSelectedReturnIds((prev) =>
      prev.includes(returnId)
        ? prev.filter((id) => id !== returnId)
        : [...prev, returnId]
    )
  }

  // Get consolidated lines from selected returns
  const getConsolidatedLines = (): CustomerReturnSummary['lines'] => {
    const lines: CustomerReturnSummary['lines'] = []
    for (const ret of availableReturns) {
      if (selectedReturnIds.includes(ret.id)) {
        lines.push(...ret.lines)
      }
    }
    return lines
  }

  const getSelectedReturnsTotalTTC = () => {
    return availableReturns
      .filter((r) => selectedReturnIds.includes(r.id))
      .reduce((sum, r) => sum + (r.totalTTC || 0), 0)
  }

  const handleCreate = async () => {
    if (selectedReturnIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un retour')
      return
    }
    try {
      setSaving(true)
      await api.post('/credit-notes', {
        customerReturnIds: selectedReturnIds,
        reason: createReason || undefined,
      })
      toast.success('Avoir créé avec succès')
      setDialogOpen(false)
      resetCreateForm()
      fetchCreditNotes()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error(msg || "Erreur lors de la création de l'avoir")
    } finally {
      setSaving(false)
    }
  }

  // ── Action handlers ──────────────────────────────────

  const handleAction = async (cn: CreditNote, action: string, extra?: Record<string, unknown>) => {
    try {
      await api.put('/credit-notes', { id: cn.id, action, ...extra })
      const labels: Record<string, string> = {
        validate: 'validé',
        cancel: 'annulé',
        refund: 'remboursé',
        apply_to_invoice: 'appliqué à une facture',
      }
      toast.success(`Avoir ${cn.number} ${labels[action] || 'mis à jour'}`)
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

  // ── Refund ───────────────────────────────────────────

  const openRefund = (cn: CreditNote) => {
    setSelectedCN(cn)
    const available = cn.totalTTC - (cn.amountUsed || 0) - (cn.amountRefunded || 0)
    setRefundAmount(String(Math.max(0, available)))
    setRefundOpen(true)
  }

  const handleRefund = async () => {
    if (!selectedCN) return
    const amount = parseFloat(refundAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    const available = selectedCN.totalTTC - (selectedCN.amountUsed || 0) - (selectedCN.amountRefunded || 0)
    if (amount > available) {
      toast.error(`Le montant ne peut pas dépasser ${formatCurrency(available)}`)
      return
    }
    try {
      setSaving(true)
      await handleAction(selectedCN, 'refund', { refundAmount: amount })
      setRefundOpen(false)
    } catch {
      /* handled in handleAction */
    } finally {
      setSaving(false)
    }
  }

  // ── Apply to Invoice ─────────────────────────────────

  const openApplyInvoice = async (cn: CreditNote) => {
    setSelectedCN(cn)
    setApplyInvoiceId('')
    const available = cn.totalTTC - (cn.amountUsed || 0) - (cn.amountRefunded || 0)
    setApplyAmount(String(Math.max(0, available)))
    setApplyOpen(true)
    // Fetch client's unpaid invoices
    try {
      setInvoicesLoading(true)
      const data = await api.get<{ invoices: InvoiceSummary[] }>(
        `/invoices?clientId=${cn.client.id}&status=sent&limit=100`
      )
      setClientInvoices((data.invoices || []).filter((inv) => (inv.remainingAmount || inv.totalTTC) > 0))
    } catch {
      setClientInvoices([])
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleApplyToInvoice = async () => {
    if (!selectedCN || !applyInvoiceId) {
      toast.error('Veuillez sélectionner une facture')
      return
    }
    const amount = parseFloat(applyAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    const available = selectedCN.totalTTC - (selectedCN.amountUsed || 0) - (selectedCN.amountRefunded || 0)
    if (amount > available) {
      toast.error(`Le montant ne peut pas dépasser ${formatCurrency(available)}`)
      return
    }
    try {
      setSaving(true)
      await handleAction(selectedCN, 'apply_to_invoice', { invoiceId: applyInvoiceId, amount })
      setApplyOpen(false)
    } catch {
      /* handled in handleAction */
    } finally {
      setSaving(false)
    }
  }

  // ── Detail & Print ───────────────────────────────────

  const openDetail = (cn: CreditNote) => {
    setSelectedCN(cn)
    setDetailOpen(true)
  }

  const getRemaining = (cn: CreditNote) =>
    cn.totalTTC - (cn.amountUsed || 0) - (cn.amountRefunded || 0)

  const handlePrint = (cn: CreditNote) => {
    const returnNumbers = cn.customerReturns?.map((r) => r.number).join(', ') || '—'
    printDocument({
      title: 'AVOIR CLIENT',
      docNumber: cn.number,
      infoGrid: [
        { label: 'Client', value: cn.client.raisonSociale || cn.client.name },
        { label: 'Date', value: fmtDate(cn.date) },
        { label: 'Retours liés', value: returnNumbers },
        { label: 'Motif', value: cn.reason || '—' },
        ...(cn.invoice ? [{ label: 'Facture', value: cn.invoice.number }] : []),
      ],
      columns: [
        { label: 'Produit' },
        { label: 'Qté', align: 'right' },
        { label: 'P.U. HT', align: 'right' },
        { label: 'TVA%', align: 'right' },
        { label: 'Total HT', align: 'right' },
      ],
      rows: cn.lines.map((line) => [
        { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
        { value: line.quantity, align: 'right' },
        { value: fmtMoney(line.unitPrice), align: 'right' },
        { value: `${line.tvaRate}%`, align: 'right' },
        { value: fmtMoney(line.totalHT || line.quantity * line.unitPrice), align: 'right' },
      ]),
      totals: [
        { label: 'Total HT', value: `-${fmtMoney(cn.totalHT)}`, negative: true },
        { label: 'TVA', value: `-${fmtMoney(cn.totalTVA)}`, negative: true },
        { label: 'Total TTC', value: `-${fmtMoney(cn.totalTTC)}`, bold: true, negative: true },
        ...(cn.amountUsed > 0 ? [{ label: 'Montant utilisé', value: fmtMoney(cn.amountUsed) }] : []),
        ...(cn.amountRefunded > 0 ? [{ label: 'Montant remboursé', value: fmtMoney(cn.amountRefunded) }] : []),
        { label: 'Reste disponible', value: fmtMoney(getRemaining(cn)), bold: true },
      ],
      subSections: buildVisaHtml(cn.reason),
      negativeTotals: true,
      amountInWords: numberToFrenchWords(cn.totalTTC || 0) + ' dirhams',
      amountInWordsLabel: 'Arrêté le présent avoir à la somme de',
    })
  }

  // ── Actions per status ───────────────────────────────

  const getActions = (cn: CreditNote) => {
    const actions: { label: string; icon: React.ReactNode; action: string; variant?: string }[] = []
    switch (cn.status) {
      case 'draft':
        actions.push({ label: 'Valider', icon: <ShieldCheck className="h-4 w-4" />, action: 'validate' })
        actions.push({ label: 'Modifier', icon: <Pencil className="h-4 w-4" />, action: 'edit' })
        break
      case 'validated':
        actions.push({ label: 'Rembourser', icon: <Banknote className="h-4 w-4" />, action: 'refund' })
        actions.push({ label: 'Appliquer à une facture', icon: <Receipt className="h-4 w-4" />, action: 'apply' })
        actions.push({ label: 'Annuler', icon: <Ban className="h-4 w-4" />, action: 'cancel', variant: 'destructive' })
        break
      case 'partially_applied':
        actions.push({ label: 'Appliquer à une facture', icon: <Receipt className="h-4 w-4" />, action: 'apply' })
        actions.push({ label: 'Annuler', icon: <Ban className="h-4 w-4" />, action: 'cancel', variant: 'destructive' })
        break
      case 'applied':
      case 'refunded':
      case 'cancelled':
        // No actions
        break
    }
    return actions
  }

  // ── Loading skeleton ────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Avoirs clients</h2>
          <Badge variant="secondary">{creditNotes.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="avoirs" />
          <Button variant="outline" size="sm" onClick={fetchCreditNotes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
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
            <SelectItem value="partially_applied">Partiellement appliqué</SelectItem>
            <SelectItem value="applied">Appliqué</SelectItem>
            <SelectItem value="refunded">Remboursé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <IconLegend items={creditNoteLegendItems} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Utilisé</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Reste</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || statusFilter !== 'all'
                        ? 'Aucun avoir trouvé.'
                        : 'Aucun avoir enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  creditNotes.map((cn) => (
                    <TableRow
                      key={cn.id}
                      className={cn(
                        'cursor-pointer',
                        expandedCNId === cn.id && 'bg-primary/5 border-l-2 border-l-primary'
                      )}
                      onClick={() =>
                        setExpandedCNId(expandedCNId === cn.id ? null : cn.id)
                      }
                      onDoubleClick={() => openDetail(cn)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(cn.status)}
                          <span className="font-mono font-medium">{cn.number}</span>
                        </div>
                      </TableCell>
                      <TableCell>{cn.client.raisonSociale || cn.client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(cn.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[cn.status] || ''}
                        >
                          {statusLabels[cn.status] || cn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -{formatCurrency(cn.totalTTC)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                        {formatCurrency(cn.amountUsed || 0)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-medium">
                        {formatCurrency(getRemaining(cn))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDetail(cn)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {getActions(cn).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getActions(cn).map((action) => (
                                  <DropdownMenuItem
                                    key={action.action}
                                    className={cn(
                                      action.variant === 'destructive' &&
                                        'text-destructive focus:text-destructive'
                                    )}
                                    onClick={() => {
                                      if (action.action === 'validate') {
                                        handleAction(cn, 'validate')
                                      } else if (action.action === 'cancel') {
                                        handleAction(cn, 'cancel')
                                      } else if (action.action === 'refund') {
                                        openRefund(cn)
                                      } else if (action.action === 'apply') {
                                        openApplyInvoice(cn)
                                      }
                                      // edit handled separately
                                    }}
                                  >
                                    {action.icon}
                                    <span className="ml-2">{action.label}</span>
                                  </DropdownMenuItem>
                                ))}
                                {cn.status === 'draft' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {isSuperAdmin && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onSelect={(e) => e.preventDefault()}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="ml-2">Supprimer</span>
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>
                                              Supprimer l&apos;avoir
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Êtes-vous sûr de vouloir supprimer l&apos;avoir{' '}
                                              <strong>{cn.number}</strong> ? Cette action est
                                              irréversible.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDelete(cn.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
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
      {expandedCNId &&
        (() => {
          const ecn = creditNotes.find((c) => c.id === expandedCNId)
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
                        <Badge
                          variant="secondary"
                          className={statusColors[ecn.status]}
                        >
                          {statusLabels[ecn.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ecn.client.raisonSociale || ecn.client.name} —{' '}
                        {format(new Date(ecn.date), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => openDetail(ecn)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ouvrir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(ecn)}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Imprimer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setExpandedCNId(null)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <span className="text-muted-foreground text-xs">Retours liés</span>
                    <p className="font-medium font-mono">
                      {ecn.customerReturns?.map((r) => r.number).join(', ') || '—'}
                    </p>
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
                    <p className="font-medium text-red-600">
                      -{formatCurrency(ecn.totalTTC)}
                    </p>
                  </div>
                </div>

                {/* Amount summary */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <span className="text-muted-foreground text-xs">Utilisé</span>
                    <p className="font-medium">{formatCurrency(ecn.amountUsed || 0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <span className="text-muted-foreground text-xs">Remboursé</span>
                    <p className="font-medium">
                      {formatCurrency(ecn.amountRefunded || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                    <span className="text-muted-foreground text-xs">Reste disponible</span>
                    <p className="font-semibold text-emerald-700">
                      {formatCurrency(getRemaining(ecn))}
                    </p>
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
                          <TableHead className="text-right w-[100px]">Total HT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ecn.lines.map((line) => (
                          <TableRow key={line.id || line.productId}>
                            <TableCell className="font-medium text-sm">
                              <span className="font-mono text-muted-foreground mr-2">
                                {line.product?.reference || ''}
                              </span>
                              {line.product?.designation || '—'}
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(line.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right">{line.tvaRate}%</TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              -{formatCurrency(line.totalHT || line.quantity * line.unitPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(ecn.totalHT)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(ecn.totalTVA)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                    <span>Total TTC</span>
                    <span className="text-red-600">-{formatCurrency(ecn.totalTTC)}</span>
                  </div>
                  <div className="text-sm italic text-muted-foreground pt-1">
                    {numberToFrenchWords(ecn.totalTTC || 0)} dirhams
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })()}

      {/* ── Create Dialog (3-step wizard) ──────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateForm()
          setDialogOpen(open)
        }}
      >
        <DialogContent resizable className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Nouvel avoir client
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
                    createStep >= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5',
                      createStep > step ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {createStep === 1 && 'Sélection du client'}
              {createStep === 2 && 'Sélection des retours'}
              {createStep === 3 && 'Récapitulatif'}
            </span>
          </div>

          <div className="overflow-auto max-h-[calc(90vh-12rem)]">
            {/* Step 1: Select client */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <EntityCombobox
                    entities={clients}
                    value={createClientId}
                    onValueChange={setCreateClientId}
                    placeholder="Sélectionner un client..."
                    searchPlaceholder="Rechercher par raison sociale, nom, ICE..."
                  />
                </div>
                {createClientId && (
                  <div className="flex justify-end">
                    <Button onClick={() => setCreateStep(2)} size="sm">
                      Suivant
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Select restocked returns */}
            {createStep === 2 && (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreateStep(1)
                    setSelectedReturnIds([])
                  }}
                >
                  ← Retour
                </Button>

                {returnsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Chargement des retours...
                    </span>
                  </div>
                ) : availableReturns.length === 0 ? (
                  <div className="text-center py-12">
                    <PackageReturn className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Aucun retour remis en stock disponible pour ce client.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Les retours doivent être au statut &quot;Remis en stock&quot; pour pouvoir
                      créer un avoir.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez un ou plusieurs retours remis en stock pour créer
                      l&apos;avoir :
                    </p>
                    <div className="grid gap-3">
                      {availableReturns.map((ret) => (
                        <Card
                          key={ret.id}
                          className={cn(
                            'cursor-pointer transition-colors border-2',
                            selectedReturnIds.includes(ret.id)
                              ? 'border-primary bg-primary/5'
                              : ret.linkedToCreditNote
                                ? 'border-muted bg-muted/30 opacity-60 cursor-not-allowed'
                                : 'border-border hover:border-primary/40'
                          )}
                          onClick={() => {
                            if (ret.linkedToCreditNote) return
                            toggleReturnSelection(ret.id)
                          }}
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className="pt-0.5">
                              <Checkbox
                                checked={
                                  ret.linkedToCreditNote
                                    ? true
                                    : selectedReturnIds.includes(ret.id)
                                }
                                disabled={ret.linkedToCreditNote}
                                onCheckedChange={() => toggleReturnSelection(ret.id)}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-sm">
                                  {ret.number}
                                </span>
                                {ret.linkedToCreditNote && (
                                  <Badge variant="outline" className="text-xs">
                                    Déjà utilisé
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {format(new Date(ret.returnDate), 'dd/MM/yyyy', {
                                    locale: fr,
                                  })}
                                </span>
                                <span>{ret.lineCount} article(s)</span>
                                <span className="font-medium text-foreground">
                                  {formatCurrency(ret.totalTTC)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {selectedReturnIds.length > 0 && (
                      <div className="flex justify-end">
                        <Button onClick={() => setCreateStep(3)} size="sm">
                          Suivant ({selectedReturnIds.length} retour(s))
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 3: Preview */}
            {createStep === 3 && (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateStep(2)}
                >
                  ← Retour
                </Button>

                {/* Selected returns summary */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <p className="text-sm font-medium">Retours sélectionnés :</p>
                  {availableReturns
                    .filter((r) => selectedReturnIds.includes(r.id))
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-mono">{r.number}</span>
                        <span>{formatCurrency(r.totalTTC)}</span>
                      </div>
                    ))}
                  <div className="flex items-center justify-between text-sm font-semibold border-t pt-2">
                    <span>Total</span>
                    <span className="text-red-600">
                      -{formatCurrency(getSelectedReturnsTotalTTC())}
                    </span>
                  </div>
                </div>

                {/* Consolidated article list */}
                {getConsolidatedLines().length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Articles consolidés
                    </Label>
                    <div className="rounded border overflow-hidden">
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
                          {getConsolidatedLines().map((line, idx) => {
                            const lineHT = line.quantity * line.unitPrice
                            return (
                              <TableRow key={`${line.productId}-${idx}`}>
                                <TableCell className="font-medium text-sm">
                                  <span className="font-mono text-muted-foreground mr-2">
                                    {line.product?.reference || ''}
                                  </span>
                                  {line.product?.designation || '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {line.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(line.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {line.tvaRate}%
                                </TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  -{formatCurrency(lineHT)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Motif de l&apos;avoir</Label>
                  <Textarea
                    value={createReason}
                    onChange={(e) => setCreateReason(e.target.value)}
                    placeholder="Motif de l'avoir (retour client, erreur, remise...)"
                    rows={2}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? 'Création...' : 'Créer l\'avoir'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Refund Dialog ────────────────────────────── */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent resizable className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Rembourser — {selectedCN?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedCN && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total TTC</span>
                  <span className="font-medium">{formatCurrency(selectedCN.totalTTC)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Déjà utilisé</span>
                  <span className="font-medium">
                    {formatCurrency(selectedCN.amountUsed || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Déjà remboursé</span>
                  <span className="font-medium">
                    {formatCurrency(selectedCN.amountRefunded || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Reste disponible</span>
                  <span className="text-emerald-700">
                    {formatCurrency(
                      selectedCN.totalTTC -
                        (selectedCN.amountUsed || 0) -
                        (selectedCN.amountRefunded || 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Montant du remboursement (MAD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRefund} disabled={saving}>
              {saving ? 'Traitement...' : 'Confirmer le remboursement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Apply to Invoice Dialog ──────────────────── */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent resizable className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Appliquer à une facture — {selectedCN?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedCN && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Reste disponible</span>
                  <span className="text-emerald-700">
                    {formatCurrency(
                      selectedCN.totalTTC -
                        (selectedCN.amountUsed || 0) -
                        (selectedCN.amountRefunded || 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Facture impayée *</Label>
                {invoicesLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Chargement des factures...
                    </span>
                  </div>
                ) : (
                  <Select value={applyInvoiceId} onValueChange={setApplyInvoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une facture..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientInvoices.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                          Aucune facture impayée pour ce client
                        </div>
                      ) : (
                        clientInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            <span className="font-mono">{inv.number}</span>
                            <span className="ml-2 text-muted-foreground">
                              — Reste : {formatCurrency(inv.remainingAmount || inv.totalTTC)}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Montant à appliquer (MAD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleApplyToInvoice} disabled={saving || !applyInvoiceId}>
              {saving ? 'Traitement...' : 'Appliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ───────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Avoir {selectedCN?.number}
              {selectedCN && (
                <Badge
                  variant="secondary"
                  className={statusColors[selectedCN.status]}
                >
                  {statusLabels[selectedCN.status]}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedCN && (
            <div className="space-y-4">
              <PrintHeader />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">
                    {selectedCN.client.raisonSociale || selectedCN.client.name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedCN.date), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <Badge
                    variant="secondary"
                    className={statusColors[selectedCN.status]}
                  >
                    {statusLabels[selectedCN.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Motif</p>
                  <p className="font-medium">{selectedCN.reason || '—'}</p>
                </div>
              </div>

              {/* Linked returns */}
              {selectedCN.customerReturns && selectedCN.customerReturns.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Retours liés</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCN.customerReturns.map((r) => (
                      <Badge key={r.id} variant="outline" className="font-mono">
                        {r.number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Total TTC</span>
                  <p className="font-medium text-red-600">
                    -{formatCurrency(selectedCN.totalTTC)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Utilisé</span>
                  <p className="font-medium">
                    {formatCurrency(selectedCN.amountUsed || 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Remboursé</span>
                  <p className="font-medium">
                    {formatCurrency(selectedCN.amountRefunded || 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                  <span className="text-muted-foreground text-xs">
                    Reste disponible
                  </span>
                  <p className="font-semibold text-emerald-700">
                    {formatCurrency(getRemaining(selectedCN))}
                  </p>
                </div>
              </div>

              {/* Lines */}
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
                  {selectedCN.lines.map((line, i) => (
                    <TableRow key={line.id || line.productId || i}>
                      <TableCell className="font-medium text-sm">
                        <span className="font-mono text-muted-foreground mr-2">
                          {line.product?.reference || ''}
                        </span>
                        {line.product?.designation || '—'}
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">{line.tvaRate}%</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        -{formatCurrency(line.totalHT || line.quantity * line.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(selectedCN.totalHT)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVA</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(selectedCN.totalTVA)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                  <span>Total TTC</span>
                  <span className="text-red-600">
                    -{formatCurrency(selectedCN.totalTTC)}
                  </span>
                </div>
                <div className="text-sm italic text-muted-foreground pt-1">
                  {numberToFrenchWords(selectedCN.totalTTC || 0)} dirhams
                </div>
              </div>

              {/* Print button */}
              <div className="flex justify-end">
                <Button onClick={() => handlePrint(selectedCN)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
