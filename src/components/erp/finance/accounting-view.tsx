'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus, Trash2, BookOpen, Scale, Layers, AlertCircle, CheckCircle2, Search, Pencil, Download, Printer
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { HelpButton } from '@/components/erp/shared/help-button'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface AccountingEntry {
  id: string
  date: string
  label: string
  account: string
  debit: number
  credit: number
  documentRef: string | null
  createdAt: string
}

interface AccountingResponse {
  entries: AccountingEntry[]
  total: number
  page: number
  limit: number
  totals: {
    totalDebit: number
    totalCredit: number
    balance: number
  }
}

const accountCodes = [
  { value: '411000', label: '411000 — Clients' },
  { value: '401000', label: '401000 — Fournisseurs' },
  { value: '706000', label: '706000 — Ventes' },
  { value: '445710', label: '445710 — TVA collectée' },
  { value: '445660', label: '445660 — TVA deductible' },
  { value: '512000', label: '512000 — Banque' },
  { value: '530000', label: '530000 — Caisse' },
  { value: '606000', label: '606000 — Achats' },
  { value: '370000', label: '370000 — Stock' },
]

const accountLabelMap: Record<string, string> = Object.fromEntries(
  accountCodes.map(a => [a.value, a.label.split(' — ')[1] || ''])
)

const accountColorMap: Record<string, string> = {
  '411000': 'bg-blue-50 text-blue-800',
  '401000': 'bg-orange-50 text-orange-800',
  '706000': 'bg-green-50 text-green-800',
  '445710': 'bg-purple-50 text-purple-800',
  '445660': 'bg-purple-50 text-purple-800',
  '512000': 'bg-cyan-50 text-cyan-800',
  '530000': 'bg-amber-50 text-amber-800',
  '606000': 'bg-red-50 text-red-800',
  '370000': 'bg-slate-100 text-slate-800',
}

interface BatchEntry {
  date: string
  label: string
  account: string
  debit: string
  credit: string
  documentRef: string
}

const emptySingleEntry = {
  date: new Date().toISOString().split('T')[0],
  label: '',
  account: '',
  debit: '',
  credit: '',
  documentRef: ''
}

const emptyBatchEntry = (): BatchEntry => ({
  date: new Date().toISOString().split('T')[0],
  label: '',
  account: '',
  debit: '',
  credit: '',
  documentRef: ''
})

export default function AccountingView() {
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [totals, setTotals] = useState({ totalDebit: 0, totalCredit: 0, balance: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('')

  const [singleDialogOpen, setSingleDialogOpen] = useState(false)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [singleForm, setSingleForm] = useState(emptySingleEntry)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([emptyBatchEntry()])
  const [batchDescription, setBatchDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<AccountingResponse>('/finance/accounting')
      setEntries(data.entries || [])
      setTotals(data.totals || { totalDebit: 0, totalCredit: 0, balance: 0 })
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement écritures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (accountFilter !== 'all' && e.account !== accountFilter) return false
      if (dateFilter) {
        const entryDate = format(new Date(e.date), 'yyyy-MM-dd')
        if (entryDate !== dateFilter) return false
      }
      if (search) {
        const s = search.toLowerCase()
        return (
          e.label.toLowerCase().includes(s) ||
          e.account.includes(s) ||
          (e.documentRef && e.documentRef.toLowerCase().includes(s))
        )
      }
      return true
    })
  }, [entries, search, accountFilter, dateFilter])

  const filteredTotals = useMemo(() => {
    const totalDebit = filteredEntries.reduce((acc, e) => acc + e.debit, 0)
    const totalCredit = filteredEntries.reduce((acc, e) => acc + e.credit, 0)
    return { totalDebit, totalCredit, balance: totalDebit - totalCredit }
  }, [filteredEntries])

  const isBalanced = Math.abs(totals.totalDebit - totals.totalCredit) < 0.01
  const batchTotalDebit = batchEntries.reduce((acc, e) => acc + (parseFloat(e.debit) || 0), 0)
  const batchTotalCredit = batchEntries.reduce((acc, e) => acc + (parseFloat(e.credit) || 0), 0)
  const batchIsBalanced = Math.abs(batchTotalDebit - batchTotalCredit) < 0.01

  const openSingle = () => {
    setEditingId(null)
    setSingleForm(emptySingleEntry)
    setSingleDialogOpen(true)
  }

  const openEdit = (entry: AccountingEntry) => {
    setEditingId(entry.id)
    setSingleForm({
      date: format(new Date(entry.date), 'yyyy-MM-dd'),
      label: entry.label,
      account: entry.account,
      debit: entry.debit > 0 ? String(entry.debit) : '',
      credit: entry.credit > 0 ? String(entry.credit) : '',
      documentRef: entry.documentRef || ''
    })
    setSingleDialogOpen(true)
  }

  const openBatch = () => {
    setBatchEntries([emptyBatchEntry()])
    setBatchDescription('')
    setBatchDialogOpen(true)
  }

  const handleSaveSingle = async () => {
    if (!singleForm.label.trim() || !singleForm.account) return
    if (!singleForm.debit && !singleForm.credit) {
      toast.error('Indiquez un montant au débit ou au crédit')
      return
    }
    try {
      setSaving(true)
      const payload = {
        date: singleForm.date ? new Date(singleForm.date).toISOString() : new Date().toISOString(),
        label: singleForm.label.trim(),
        account: singleForm.account,
        debit: singleForm.debit ? parseFloat(singleForm.debit) : 0,
        credit: singleForm.credit ? parseFloat(singleForm.credit) : 0,
        documentRef: singleForm.documentRef || null
      }
      if (editingId) {
        await api.put('/finance/accounting', { id: editingId, ...payload })
        toast.success('Écriture modifiée')
      } else {
        await api.post('/finance/accounting', payload)
        toast.success('Écriture enregistrée')
      }
      setSingleDialogOpen(false)
      setEditingId(null)
      fetchEntries()
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBatch = async () => {
    const validEntries = batchEntries.filter(e => e.label.trim() && e.account)
    if (validEntries.length < 2) {
      toast.error('Minimum 2 écritures pour une opération multiple')
      return
    }
    if (!batchIsBalanced) {
      toast.error('Les écritures doivent être équilibrées (débit = crédit)')
      return
    }
    try {
      setSaving(true)
      await api.post('/finance/accounting', {
        batch: true,
        description: batchDescription || null,
        entries: validEntries.map(e => ({
          date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
          label: e.label.trim(),
          account: e.account,
          debit: parseFloat(e.debit) || 0,
          credit: parseFloat(e.credit) || 0,
          documentRef: e.documentRef || null
        }))
      })
      toast.success(`${validEntries.length} écritures enregistrées`)
      setBatchDialogOpen(false)
      fetchEntries()
    } catch (err: any) {
      toast.error(err.message || "Erreur enregistrement du lot")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/accounting?id=${id}`)
      toast.success('Écriture supprimée')
      fetchEntries()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  const updateBatchEntry = (index: number, field: keyof BatchEntry, value: string) => {
    setBatchEntries(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addBatchEntry = () => {
    setBatchEntries(prev => [...prev, emptyBatchEntry()])
  }

  const removeBatchEntry = (index: number) => {
    setBatchEntries(prev => prev.filter((_, i) => i !== index))
  }

  const handleExportExcel = () => {
    const rows = filteredEntries.map(e => ({
      Date: format(new Date(e.date), 'dd/MM/yyyy'),
      Compte: e.account,
      Libellé: e.label,
      Débit: e.debit || '',
      Crédit: e.credit || '',
      Pièce: e.documentRef || '',
    }))
    rows.push({
      Date: '',
      Compte: '',
      Libellé: 'TOTAUX',
      Débit: filteredTotals.totalDebit,
      Crédit: filteredTotals.totalCredit,
      Pièce: '',
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Journal')
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    XLSX.writeFile(wb, `journal-comptable-${dateStr}.xlsx`)
  }

  const handlePrint = () => {
    const el = document.getElementById('printable-accounting')
    if (!el) return

    // Clone the printable content into a new temporary window for clean printing
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      toast.error('Veuillez autoriser les fenêtres pop-up pour imprimer')
      return
    }

    const printDate = format(new Date(), 'dd/MM/yyyy à HH:mm')
    const html = el.innerHTML

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Journal Comptable — GEMA ERP PRO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20mm 10mm; color: #000; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 4pt; }
    .print-date { text-align: center; font-size: 10pt; color: #555; margin-bottom: 12pt; }
    table { border-collapse: collapse; width: 100%; margin-top: 8pt; }
    th, td { border: 1px solid #ccc; padding: 4pt 6pt; font-size: 9pt; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; text-align: left; }
    td.text-right, th.text-right { text-align: right; }
    td.hidden-print, th.hidden-print { display: none; }
    tfoot td { font-weight: 600; background: #f0f0f0; }
    @media print { body { padding: 10mm; } }
  </style>
</head>
<body>
  <h1>Journal Comptable — GEMA ERP PRO</h1>
  <p class="print-date">Imprimé le ${printDate}</p>
  ${html}
  <script>
    // Remove the last column (Actions) from all rows
    document.querySelectorAll('table tr').forEach(tr => {
      const lastCell = tr.lastElementChild
      if (lastCell && (lastCell.tagName === 'TD' || lastCell.tagName === 'TH')) {
        lastCell.remove()
      }
    });
    window.onafterprint = () => window.close();
    setTimeout(() => { window.print(); }, 300);
  </script>
</body>
</html>`)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Comptabilité</h2>
          <Badge variant="secondary">{filteredEntries.length} écritures</Badge>
        </div>
        <div className="flex gap-2">
          <HelpButton section="finance" sub="comptabilite" />
          <Button onClick={openSingle} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Écriture simple
          </Button>
          <Button onClick={openBatch} size="sm">
            <Layers className="h-4 w-4 mr-1" />
            Opération multiple
          </Button>
          <Button onClick={handleExportExcel} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-1" />
            Export Excel
          </Button>
          <Button onClick={handlePrint} size="sm" variant="outline">
            <Printer className="h-4 w-4 mr-1" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Débit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(filteredTotals.totalDebit)}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Crédit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(filteredTotals.totalCredit)}</div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${isBalanced ? 'border-l-blue-400' : 'border-l-amber-400'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              {isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              Solde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${Math.abs(filteredTotals.balance) < 0.01 ? 'text-blue-600' : 'text-amber-600'}`}>
              {formatCurrency(filteredTotals.balance)}
              {Math.abs(filteredTotals.balance) < 0.01 && (
                <span className="text-sm ml-2 font-normal text-blue-600">Équilibré</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par libellé, compte, réf..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Compte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les comptes</SelectItem>
            {accountCodes.map(a => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-full sm:w-[180px]"
        />
        {(search || accountFilter !== 'all' || dateFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setAccountFilter('all'); setDateFilter('') }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Journal Table */}
      <div id="printable-accounting">
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-[100px]">Date</TableHead>
                  <TableHead className="w-[120px]">Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right w-[130px]">Débit</TableHead>
                  <TableHead className="text-right w-[130px]">Crédit</TableHead>
                  <TableHead className="hidden md:table-cell">Pièce</TableHead>
                  <TableHead className="text-right pr-4 w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search || accountFilter !== 'all' || dateFilter
                        ? 'Aucune écriture trouvée.'
                        : 'Aucune écriture comptable.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 text-muted-foreground text-sm">
                        {format(new Date(entry.date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`font-mono text-xs ${accountColorMap[entry.account] || ''}`}>
                          {entry.account}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{entry.label}</TableCell>
                      <TableCell className="text-right">
                        {entry.debit > 0 ? (
                          <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
                            {formatCurrency(entry.debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.credit > 0 ? (
                          <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                            {formatCurrency(entry.credit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {entry.documentRef || '—'}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                            onClick={() => openEdit(entry)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer l&apos;écriture</AlertDialogTitle>
                              <AlertDialogDescription>
                                Supprimer l&apos;écriture <strong>{entry.label}</strong> ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filteredEntries.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3} className="pl-4">Totaux</TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600">{formatCurrency(filteredTotals.totalDebit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600">{formatCurrency(filteredTotals.totalCredit)}</span>
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      </div>

      {/* Single Entry Dialog */}
      <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'écriture' : 'Nouvelle écriture'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={singleForm.date}
                onChange={(e) => setSingleForm({ ...singleForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-account">Compte *</Label>
              <Select value={singleForm.account} onValueChange={(v) => setSingleForm({ ...singleForm, account: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un compte" />
                </SelectTrigger>
                <SelectContent>
                  {accountCodes.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-label">Libellé *</Label>
              <Input
                id="entry-label"
                value={singleForm.label}
                onChange={(e) => setSingleForm({ ...singleForm, label: e.target.value })}
                placeholder="Description de l'écriture"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry-debit" className="text-red-600">Débit</Label>
                <Input
                  id="entry-debit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={singleForm.debit}
                  onChange={(e) => setSingleForm({ ...singleForm, debit: e.target.value })}
                  placeholder="0.00"
                  className="border-red-200 focus-visible:ring-red-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-credit" className="text-green-600">Crédit</Label>
                <Input
                  id="entry-credit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={singleForm.credit}
                  onChange={(e) => setSingleForm({ ...singleForm, credit: e.target.value })}
                  placeholder="0.00"
                  className="border-green-200 focus-visible:ring-green-400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-ref">Référence pièce</Label>
              <Input
                id="entry-ref"
                value={singleForm.documentRef}
                onChange={(e) => setSingleForm({ ...singleForm, documentRef: e.target.value })}
                placeholder="Référence du document (facultatif)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSingleDialogOpen(false); setEditingId(null) }}>Annuler</Button>
            <Button onClick={handleSaveSingle} disabled={!singleForm.label.trim() || !singleForm.account || (!singleForm.debit && !singleForm.credit) || saving}>
              {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Entry Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Opération multiple
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-desc">Description</Label>
              <Input
                id="batch-desc"
                value={batchDescription}
                onChange={(e) => setBatchDescription(e.target.value)}
                placeholder="Description de l'opération (facultatif)"
              />
            </div>

            {/* Balance indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
              batchIsBalanced
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {batchIsBalanced ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>Débit : {formatCurrency(batchTotalDebit)} — Crédit : {formatCurrency(batchTotalCredit)}</span>
              <span className="ml-auto">
                {batchIsBalanced ? 'Équilibré' : `Écart : ${formatCurrency(Math.abs(batchTotalDebit - batchTotalCredit))}`}
              </span>
            </div>

            {/* Batch entries table */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead className="w-[130px]">Compte</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right w-[120px]">Débit</TableHead>
                    <TableHead className="text-right w-[120px]">Crédit</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchEntries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="date"
                          value={entry.date}
                          onChange={(e) => updateBatchEntry(index, 'date', e.target.value)}
                          className="h-9 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={entry.account} onValueChange={(v) => updateBatchEntry(index, 'account', v)}>
                          <SelectTrigger className="h-9 text-sm font-mono">
                            <SelectValue placeholder="Compte" />
                          </SelectTrigger>
                          <SelectContent>
                            {accountCodes.map(a => (
                              <SelectItem key={a.value} value={a.value}>{a.value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.label}
                          onChange={(e) => updateBatchEntry(index, 'label', e.target.value)}
                          placeholder="Libellé"
                          className="h-9 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.debit}
                          onChange={(e) => updateBatchEntry(index, 'debit', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm text-right border-red-200"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.credit}
                          onChange={(e) => updateBatchEntry(index, 'credit', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm text-right border-green-200"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeBatchEntry(index)}
                          disabled={batchEntries.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addBatchEntry}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter une ligne
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleSaveBatch}
              disabled={!batchIsBalanced || batchEntries.filter(e => e.label.trim() && e.account).length < 2 || saving}
            >
              {saving ? 'Enregistrement...' : `Enregistrer ${batchEntries.filter(e => e.label.trim() && e.account).length} écritures`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
