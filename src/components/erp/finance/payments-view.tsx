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
  Plus, Edit, Trash2, CreditCard, Banknote, FileText, ArrowLeftRight, Search
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

type PaymentType = 'client_payment' | 'supplier_payment' | 'cash_in' | 'cash_out'
type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'card' | 'effet'

interface Payment {
  id: string
  invoiceId: string | null
  type: PaymentType
  amount: number
  method: PaymentMethod
  reference: string | null
  date: string
  notes: string | null
  createdAt: string
  bankAccountId?: string | null
  cashRegisterId?: string | null
  bankAccount?: { id: string; name: string } | null
  cashRegister?: { id: string; name: string } | null
  effetsCheques?: Array<{ id: string; type: string; numero: string; statut: string }>
  invoice?: {
    id: string
    number: string
    client: { id: string; name: string }
  }
}

interface PaymentResponse {
  payments: Payment[]
  total: number
  page: number
  limit: number
}

interface BankAccount {
  id: string
  name: string
  isActive: boolean
}

interface CashRegister {
  id: string
  name: string
  isActive: boolean
}

interface EffetFormData {
  type: 'cheque' | 'effet'
  numero: string
  montant: string
  beneficiaire: string
  banqueEmettrice: string
  dateEmission: string
  dateEcheance: string
  notes: string
}

const paymentTypeLabels: Record<PaymentType, string> = {
  client_payment: 'Paiement client',
  supplier_payment: 'Paiement fournisseur',
  cash_in: 'Entrée de caisse',
  cash_out: 'Sortie de caisse'
}

const paymentTypeColors: Record<PaymentType, string> = {
  client_payment: 'bg-green-100 text-green-800 hover:bg-green-100',
  supplier_payment: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  cash_in: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  cash_out: 'bg-red-100 text-red-800 hover:bg-red-100'
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  check: 'Chèque',
  bank_transfer: 'Virement',
  card: 'Carte',
  effet: 'Effet de commerce'
}

const MethodIcon = ({ method }: { method: PaymentMethod }) => {
  switch (method) {
    case 'cash': return <Banknote className="h-4 w-4" />
    case 'check': return <FileText className="h-4 w-4" />
    case 'bank_transfer': return <ArrowLeftRight className="h-4 w-4" />
    case 'card': return <CreditCard className="h-4 w-4" />
    case 'effet': return <FileText className="h-4 w-4" />
    default: return null
  }
}

const emptyPayment = {
  invoiceId: '',
  type: 'client_payment' as PaymentType,
  amount: '',
  method: 'bank_transfer' as PaymentMethod,
  reference: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  bankAccountId: '',
  cashRegisterId: ''
}

const emptyEffet: EffetFormData = {
  type: 'cheque',
  numero: '',
  montant: '',
  beneficiaire: '',
  banqueEmettrice: '',
  dateEmission: new Date().toISOString().split('T')[0],
  dateEcheance: '',
  notes: ''
}

export default function PaymentsView() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [form, setForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([])

  const [effetForm, setEffetForm] = useState<EffetFormData>(emptyEffet)
  const [showEffetForm, setShowEffetForm] = useState(false)

  const fetchAccounts = useCallback(async () => {
    try {
      const [banks, cashes] = await Promise.all([
        api.get<{ accounts: BankAccount[] }>('/finance/bank').then(r => r.accounts || []),
        api.get<{ registers: CashRegister[] }>('/finance/cash-registers').then(r => r.registers || []),
      ])
      setBankAccounts(banks.filter(b => b.isActive))
      setCashRegisters(cashes.filter(c => c.isActive))
    } catch {
      // silently ignore
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<PaymentResponse>('/finance/payments')
      setPayments(data.payments || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement paiements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
    fetchAccounts()
  }, [fetchPayments, fetchAccounts])

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (methodFilter !== 'all' && p.method !== methodFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          p.reference?.toLowerCase().includes(s) ||
          p.notes?.toLowerCase().includes(s) ||
          p.invoice?.number?.toLowerCase().includes(s) ||
          p.invoice?.client?.name?.toLowerCase().includes(s) ||
          paymentTypeLabels[p.type].toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [payments, search, typeFilter, methodFilter])

  const stats = useMemo(() => {
    const totalIn = payments
      .filter(p => p.type === 'client_payment' || p.type === 'cash_in')
      .reduce((acc, p) => acc + p.amount, 0)
    const totalOut = payments
      .filter(p => p.type === 'supplier_payment' || p.type === 'cash_out')
      .reduce((acc, p) => acc + p.amount, 0)
    return { totalIn, totalOut, balance: totalIn - totalOut }
  }, [payments])

  const needsBankAccount = (method: PaymentMethod) => method === 'check' || method === 'effet' || method === 'bank_transfer' || method === 'card'
  const needsCashRegister = (method: PaymentMethod) => method === 'cash'

  const openCreate = () => {
    setEditingPayment(null)
    setForm(emptyPayment)
    setEffetForm(emptyEffet)
    setShowEffetForm(false)
    setDialogOpen(true)
  }

  const openEdit = (payment: Payment) => {
    setEditingPayment(payment)
    setForm({
      invoiceId: payment.invoiceId || '',
      type: payment.type,
      amount: payment.amount.toString(),
      method: payment.method,
      reference: payment.reference || '',
      date: payment.date ? payment.date.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: payment.notes || '',
      bankAccountId: payment.bankAccountId || '',
      cashRegisterId: payment.cashRegisterId || ''
    })
    setShowEffetForm(false)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.amount || !form.type) return
    try {
      setSaving(true)
      const body: Record<string, unknown> = {
        invoiceId: form.invoiceId || null,
        type: form.type,
        amount: parseFloat(form.amount),
        method: form.method,
        reference: form.reference || null,
        date: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
        notes: form.notes || null,
        bankAccountId: form.bankAccountId || null,
        cashRegisterId: form.cashRegisterId || null
      }

      let paymentId: string

      if (editingPayment) {
        await api.put('/finance/payments', { id: editingPayment.id, ...body })
        paymentId = editingPayment.id
        toast.success('Paiement modifié')
      } else {
        const result = await api.post<Payment>('/finance/payments', body)
        paymentId = result.id
        toast.success('Paiement enregistré')
      }

      // Create EffetCheque if needed
      if ((form.method === 'check' || form.method === 'effet') && !editingPayment) {
        if (effetForm.numero && effetForm.montant) {
          try {
            await api.post('/effets-cheques', {
              paymentId,
              bankAccountId: form.bankAccountId || null,
              type: form.method === 'effet' ? 'effet' : 'cheque',
              numero: effetForm.numero,
              montant: parseFloat(effetForm.montant),
              beneficiaire: effetForm.beneficiaire || null,
              banqueEmettrice: effetForm.banqueEmettrice || null,
              dateEmission: effetForm.dateEmission ? new Date(effetForm.dateEmission).toISOString() : new Date().toISOString(),
              dateEcheance: effetForm.dateEcheance ? new Date(effetForm.dateEcheance).toISOString() : null,
              notes: effetForm.notes || null,
            })
            toast.success('Effet enregistré')
          } catch (effetErr: any) {
            toast.error(effetErr.message || 'Erreur enregistrement effet')
          }
        }
      }

      setDialogOpen(false)
      fetchPayments()
    } catch (err: any) {
      toast.error(err.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/payments?id=${id}`)
      toast.success('Paiement supprimé')
      fetchPayments()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
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
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Paiements</h2>
          <Badge variant="secondary">{filteredPayments.length}</Badge>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nouveau paiement
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total encaissements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalIn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total décaissements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOut)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence, note, facture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Type de paiement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(paymentTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Mode de paiement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="hidden md:table-cell">Compte</TableHead>
                  <TableHead className="hidden lg:table-cell">Référence</TableHead>
                  <TableHead className="hidden lg:table-cell">Facture / Client</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || typeFilter !== 'all' || methodFilter !== 'all'
                        ? 'Aucun paiement trouvé.'
                        : 'Aucun paiement enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="pl-4 text-muted-foreground text-sm">
                        {format(new Date(payment.date || payment.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={paymentTypeColors[payment.type]}>
                          {paymentTypeLabels[payment.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MethodIcon method={payment.method} />
                          <span className="text-sm">{paymentMethodLabels[payment.method]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {payment.bankAccount?.name || payment.cashRegister?.name || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {payment.reference || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {payment.invoice ? (
                          <div>
                            <span className="font-medium">{payment.invoice.number}</span>
                            <span className="text-muted-foreground ml-1">— {payment.invoice.client.name}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(payment)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer le paiement</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Supprimer ce paiement de {formatCurrency(payment.amount)} ?
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Modifier le paiement' : 'Nouveau paiement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-type">Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PaymentType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Montant (MAD) *</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement *</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={form.method === value ? 'default' : 'outline'}
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      const newMethod = value as PaymentMethod
                      const newForm = { ...form, method: newMethod }
                      // Reset account fields when switching methods
                      if (needsBankAccount(newMethod) && needsCashRegister(form.method)) {
                        newForm.cashRegisterId = ''
                      } else if (needsCashRegister(newMethod) && needsBankAccount(form.method)) {
                        newForm.bankAccountId = ''
                      }
                      setForm(newForm)
                      setShowEffetForm(newMethod === 'check' || newMethod === 'effet')
                      if (newMethod === 'check' || newMethod === 'effet') {
                        setEffetForm({ ...emptyEffet, montant: form.amount })
                      }
                    }}
                  >
                    <MethodIcon method={value as PaymentMethod} />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Compte de destination */}
            {needsBankAccount(form.method) && (
              <div className="space-y-2">
                <Label>Compte bancaire de destination</Label>
                <Select value={form.bankAccountId} onValueChange={(v) => setForm({ ...form, bankAccountId: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un compte bancaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun compte actif</SelectItem>
                    )}
                    {bankAccounts.map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsCashRegister(form.method) && (
              <div className="space-y-2">
                <Label>Caisse de destination</Label>
                <Select value={form.cashRegisterId} onValueChange={(v) => setForm({ ...form, cashRegisterId: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner une caisse" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashRegisters.length === 0 && (
                      <SelectItem value="__none" disabled>Aucune caisse active</SelectItem>
                    )}
                    {cashRegisters.map((cr) => (
                      <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* EffetCheque sub-form */}
            {showEffetForm && !editingPayment && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {form.method === 'effet' ? 'Détails de l\'effet de commerce' : 'Détails du chèque'}
                  </span>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={effetForm.type}
                    onValueChange={(v) => setEffetForm({ ...effetForm, type: v as 'cheque' | 'effet' })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="effet">Effet de commerce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Numéro *</Label>
                  <Input
                    value={effetForm.numero}
                    onChange={(e) => setEffetForm({ ...effetForm, numero: e.target.value })}
                    placeholder="Numéro du chèque/effet"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Montant *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={effetForm.montant}
                    onChange={(e) => setEffetForm({ ...effetForm, montant: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bénéficiaire</Label>
                  <Input
                    value={effetForm.beneficiaire}
                    onChange={(e) => setEffetForm({ ...effetForm, beneficiaire: e.target.value })}
                    placeholder="Nom du bénéficiaire"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banque émettrice</Label>
                  <Input
                    value={effetForm.banqueEmettrice}
                    onChange={(e) => setEffetForm({ ...effetForm, banqueEmettrice: e.target.value })}
                    placeholder="Banque de l'émetteur"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date d'émission</Label>
                    <Input
                      type="date"
                      value={effetForm.dateEmission}
                      onChange={(e) => setEffetForm({ ...effetForm, dateEmission: e.target.value })}
                    />
                  </div>
                  {effetForm.type === 'effet' && (
                    <div className="space-y-2">
                      <Label>Date d'échéance</Label>
                      <Input
                        type="date"
                        value={effetForm.dateEcheance}
                        onChange={(e) => setEffetForm({ ...effetForm, dateEcheance: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={effetForm.notes}
                    onChange={(e) => setEffetForm({ ...effetForm, notes: e.target.value })}
                    placeholder="Notes (facultatif)"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-invoice">N° de facture (optionnel)</Label>
              <Input
                id="pay-invoice"
                value={form.invoiceId}
                onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
                placeholder="Lier à une facture (ID)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">Référence</Label>
              <Input
                id="pay-ref"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="Référence (facultatif)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Notes</Label>
              <Textarea
                id="pay-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes (facultatif)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.amount || saving}>
              {saving ? 'Enregistrement...' : editingPayment ? 'Modifier' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
