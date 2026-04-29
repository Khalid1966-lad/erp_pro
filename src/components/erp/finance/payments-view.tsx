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
  Plus, Edit, Trash2, CreditCard, Banknote, FileText, ArrowLeftRight, Search,
  ChevronLeft, ChevronRight, CheckSquare, Square, ArrowDownToLine, ArrowUpFromLine,
  Eye, Building2, Wallet
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

// ── Types ──────────────────────────────────────────────────────────────────────

type PaymentType = 'client_payment' | 'supplier_payment' | 'cash_in' | 'cash_out'
type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'card' | 'effet'
type WizardMode = 'client_payment' | 'supplier_payment' | 'cash_in' | 'cash_out' | null

interface Payment {
  id: string
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
  effetsCheques?: Array<{ id: string; type: string; numero: string; statut: string; montant: number }>
  paymentLines?: Array<PaymentLine>
}

interface PaymentLine {
  id: string
  invoiceId: string | null
  supplierInvoiceId: string | null
  amount: number
  invoice?: { id: string; number: string; totalTTC: number; amountPaid: number; status: string; client?: { id: string; name: string } } | null
  supplierInvoice?: { id: string; number: string; totalTTC: number; amountPaid: number; status: string; supplier?: { id: string; name: string } } | null
}

interface PaymentResponse {
  payments: Payment[]
  total: number
  page: number
  limit: number
}

interface Client {
  id: string
  name: string
  code: string
  balance: number
}

interface Supplier {
  id: string
  name: string
  code: string
  balance: number
}

interface UnpaidInvoice {
  id: string
  number: string
  date: string
  totalTTC: number
  amountPaid: number
  status: string
  client?: { name: string }
  supplier?: { name: string }
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

interface SelectedInvoice {
  id: string
  number: string
  totalTTC: number
  amountPaid: number
  remaining: number
  amountToPay: number
  checked: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const paymentTypeLabels: Record<PaymentType, string> = {
  client_payment: 'Paiement client',
  supplier_payment: 'Paiement fournisseur',
  cash_in: 'Entrée de caisse',
  cash_out: 'Sortie de caisse'
}

const paymentTypeColors: Record<PaymentType, string> = {
  client_payment: 'bg-green-100 text-green-800 hover:bg-green-100',
  supplier_payment: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  cash_in: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  cash_out: 'bg-red-100 text-red-800 hover:bg-red-100'
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  check: 'Chèque',
  bank_transfer: 'Virement',
  card: 'Carte',
  effet: 'Effet'
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function PaymentsView() {
  // ── Payments list state ───────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [wizardMode, setWizardMode] = useState<WizardMode>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Wizard step ───────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState(1)

  // ── Step 1: Client / Supplier selection ───────────────────────────────────
  const [clients, setClients] = useState<Client[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [entitySearch, setEntitySearch] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<Client | Supplier | null>(null)

  // ── Step 2: Unpaid invoices ───────────────────────────────────────────────
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<SelectedInvoice[]>([])

  // ── Step 3: Payment details ───────────────────────────────────────────────
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bank_transfer')
  const [payBankAccountId, setPayBankAccountId] = useState('')
  const [payCashRegisterId, setPayCashRegisterId] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payReference, setPayReference] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [effetForm, setEffetForm] = useState<EffetFormData>(emptyEffet)
  const [showEffetForm, setShowEffetForm] = useState(false)

  // ── Cash in/out form ──────────────────────────────────────────────────────
  const [cashAmount, setCashAmount] = useState('')
  const [cashMethod, setCashMethod] = useState<PaymentMethod>('cash')
  const [cashBankAccountId, setCashBankAccountId] = useState('')
  const [cashCashRegisterId, setCashCashRegisterId] = useState('')
  const [cashDate, setCashDate] = useState(new Date().toISOString().split('T')[0])
  const [cashReference, setCashReference] = useState('')
  const [cashNotes, setCashNotes] = useState('')

  // ── Edit form ─────────────────────────────────────────────────────────────
  const [editReference, setEditReference] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')

  // ── Bank / Cash registers ─────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([])

  // ── Payment counter for auto reference ────────────────────────────────────
  const [paymentCount, setPaymentCount] = useState(0)

  // ── Fetch functions ───────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    try {
      const [banks, cashes] = await Promise.all([
        api.get<{ accounts: BankAccount[] }>('/finance/bank').then(r => r.accounts || []),
        api.get<{ registers: CashRegister[] }>('/finance/cash').then(r => r.registers || []),
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
      setPaymentCount(data.total || 0)
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

  // ── Computed values ───────────────────────────────────────────────────────

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (methodFilter !== 'all' && p.method !== methodFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const invoiceNumbers = (p.paymentLines || [])
          .map(l => l.invoice?.number || l.supplierInvoice?.number)
          .filter(Boolean)
          .join(' ')
        return (
          p.reference?.toLowerCase().includes(s) ||
          p.notes?.toLowerCase().includes(s) ||
          invoiceNumbers.toLowerCase().includes(s) ||
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

  const needsBankAccount = (method: PaymentMethod) =>
    method === 'check' || method === 'effet' || method === 'bank_transfer' || method === 'card'
  const needsCashRegister = (method: PaymentMethod) => method === 'cash'

  const totalSelected = useMemo(() => {
    return selectedInvoices
      .filter(inv => inv.checked)
      .reduce((acc, inv) => acc + inv.amountToPay, 0)
  }, [selectedInvoices])

  const wizardTitle = useMemo(() => {
    if (editingPayment) return 'Modifier le paiement'
    if (wizardMode === 'client_payment') return 'Paiement client'
    if (wizardMode === 'supplier_payment') return 'Paiement fournisseur'
    if (wizardMode === 'cash_in') return 'Entrée de caisse'
    if (wizardMode === 'cash_out') return 'Sortie de caisse'
    return 'Paiement'
  }, [editingPayment, wizardMode])

  // ── Generate auto reference ───────────────────────────────────────────────

  const generateReference = useCallback((type: PaymentType) => {
    const prefix = type === 'client_payment' ? 'PAY-CLI' : type === 'supplier_payment' ? 'PAY-FRS' : 'PAY'
    const num = String(paymentCount + 1).padStart(4, '0')
    return `${prefix}-${num}`
  }, [paymentCount])

  // ── Open wizard ───────────────────────────────────────────────────────────

  const resetWizardState = useCallback(() => {
    setWizardStep(1)
    setEntitySearch('')
    setSelectedEntity(null)
    setSelectedInvoices([])
    setPayMethod('bank_transfer')
    setPayBankAccountId('')
    setPayCashRegisterId('')
    setPayDate(new Date().toISOString().split('T')[0])
    setPayReference('')
    setPayNotes('')
    setEffetForm(emptyEffet)
    setShowEffetForm(false)
  }, [])

  const resetCashState = useCallback(() => {
    setCashAmount('')
    setCashMethod('cash')
    setCashBankAccountId('')
    setCashCashRegisterId('')
    setCashDate(new Date().toISOString().split('T')[0])
    setCashReference('')
    setCashNotes('')
  }, [])

  const openWizard = useCallback((mode: WizardMode) => {
    setWizardMode(mode)
    setEditingPayment(null)
    setDialogOpen(true)
    if (mode === 'cash_in' || mode === 'cash_out') {
      resetCashState()
    } else {
      resetWizardState()
    }
  }, [resetWizardState, resetCashState])

  const openEdit = useCallback((payment: Payment) => {
    setEditingPayment(payment)
    setWizardMode(payment.type)
    setEditReference(payment.reference || '')
    setEditNotes(payment.notes || '')
    setEditDate(payment.date ? payment.date.split('T')[0] : new Date().toISOString().split('T')[0])
    setDialogOpen(true)
  }, [])

  const openView = useCallback((payment: Payment) => {
    setViewingPayment(payment)
    setViewDialogOpen(true)
  }, [])

  // ── Fetch clients / suppliers ─────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get<{ clients: Client[] }>('/clients?isDeleted=false&limit=100')
      setClients(data.clients || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement clients')
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await api.get<{ suppliers: Supplier[] }>('/suppliers?limit=100')
      setSuppliers(data.suppliers || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement fournisseurs')
    }
  }, [])

  // ── When wizard opens step 1, fetch entities ─────────────────────────────

  useEffect(() => {
    if (dialogOpen && wizardMode === 'client_payment' && !editingPayment) {
      fetchClients()
    }
  }, [dialogOpen, wizardMode, editingPayment, fetchClients])

  useEffect(() => {
    if (dialogOpen && wizardMode === 'supplier_payment' && !editingPayment) {
      fetchSuppliers()
    }
  }, [dialogOpen, wizardMode, editingPayment, fetchSuppliers])

  // ── Fetch unpaid invoices after entity selected ───────────────────────────

  const fetchUnpaidInvoices = useCallback(async (entity: Client | Supplier) => {
    setInvoicesLoading(true)
    try {
      let invoices: UnpaidInvoice[] = []
      if (wizardMode === 'client_payment') {
        const data = await api.get<{ invoices: UnpaidInvoice[] }>(
          `/invoices?clientId=${entity.id}&status=validated,sent,overdue,partially_paid&limit=100`
        )
        invoices = data.invoices || []
      } else if (wizardMode === 'supplier_payment') {
        const data = await api.get<{ supplierInvoices: UnpaidInvoice[] }>(
          `/supplier-invoices?supplierId=${entity.id}&status=received,verified,partially_paid&limit=100`
        )
        invoices = data.supplierInvoices || []
      }
      setSelectedInvoices(
        invoices.map(inv => ({
          id: inv.id,
          number: inv.number,
          totalTTC: inv.totalTTC,
          amountPaid: inv.amountPaid,
          remaining: inv.totalTTC - inv.amountPaid,
          amountToPay: Math.max(0, inv.totalTTC - inv.amountPaid),
          checked: false
        }))
      )
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement factures impayées')
      setSelectedInvoices([])
    } finally {
      setInvoicesLoading(false)
    }
  }, [wizardMode])

  const handleEntitySelect = useCallback((entityId: string) => {
    const isClient = wizardMode === 'client_payment'
    const list = isClient ? clients : suppliers
    const entity = list.find(e => e.id === entityId) || null
    setSelectedEntity(entity)
    if (entity) {
      setPayReference(generateReference(isClient ? 'client_payment' : 'supplier_payment'))
      fetchUnpaidInvoices(entity)
    }
  }, [wizardMode, clients, suppliers, generateReference, fetchUnpaidInvoices])

  // ── Invoice selection handlers ────────────────────────────────────────────

  const toggleInvoiceCheck = useCallback((invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId ? { ...inv, checked: !inv.checked } : inv
      )
    )
  }, [])

  const selectAllInvoices = useCallback(() => {
    setSelectedInvoices(prev => prev.map(inv => ({ ...inv, checked: true })))
  }, [])

  const deselectAllInvoices = useCallback(() => {
    setSelectedInvoices(prev => prev.map(inv => ({ ...inv, checked: false })))
  }, [])

  const payAllInvoices = useCallback(() => {
    setSelectedInvoices(prev =>
      prev.map(inv => ({
        ...inv,
        checked: true,
        amountToPay: inv.remaining
      }))
    )
  }, [])

  const updateInvoiceAmount = useCallback((invoiceId: string, amount: string) => {
    const val = parseFloat(amount) || 0
    setSelectedInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId ? { ...inv, amountToPay: Math.min(val, inv.remaining) } : inv
      )
    )
  }, [])

  // ── Handle save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Edit mode (simplified)
    if (editingPayment) {
      if (!editDate) return
      try {
        setSaving(true)
        await api.put('/finance/payments', {
          id: editingPayment.id,
          reference: editReference || null,
          notes: editNotes || null,
          date: new Date(editDate).toISOString()
        })
        toast.success('Paiement modifié')
        setDialogOpen(false)
        fetchPayments()
      } catch (err: any) {
        toast.error(err.message || 'Erreur modification')
      } finally {
        setSaving(false)
      }
      return
    }

    // Cash in/out mode
    if (wizardMode === 'cash_in' || wizardMode === 'cash_out') {
      if (!cashAmount || parseFloat(cashAmount) <= 0) {
        toast.error('Veuillez saisir un montant valide')
        return
      }
      try {
        setSaving(true)
        const body: Record<string, unknown> = {
          type: wizardMode,
          amount: parseFloat(cashAmount),
          method: cashMethod,
          reference: cashReference || null,
          date: cashDate ? new Date(cashDate).toISOString() : new Date().toISOString(),
          notes: cashNotes || null,
          bankAccountId: needsBankAccount(cashMethod) ? (cashBankAccountId || null) : null,
          cashRegisterId: needsCashRegister(cashMethod) ? (cashCashRegisterId || null) : null,
          lines: []
        }
        await api.post('/finance/payments', body)
        toast.success(wizardMode === 'cash_in' ? 'Entrée de caisse enregistrée' : 'Sortie de caisse enregistrée')
        setDialogOpen(false)
        fetchPayments()
      } catch (err: any) {
        toast.error(err.message || 'Erreur sauvegarde')
      } finally {
        setSaving(false)
      }
      return
    }

    // Wizard mode (client_payment / supplier_payment)
    const checkedInvoices = selectedInvoices.filter(inv => inv.checked)
    if (checkedInvoices.length === 0) {
      toast.error('Veuillez sélectionner au moins une facture')
      return
    }
    if (totalSelected <= 0) {
      toast.error('Le montant total doit être supérieur à 0')
      return
    }

    const isClient = wizardMode === 'client_payment'
    if (needsBankAccount(payMethod) && !payBankAccountId) {
      toast.error('Veuillez sélectionner un compte bancaire')
      return
    }
    if (needsCashRegister(payMethod) && !payCashRegisterId) {
      toast.error('Veuillez sélectionner une caisse')
      return
    }

    try {
      setSaving(true)
      const lines = checkedInvoices.map(inv => ({
        invoiceId: isClient ? inv.id : null,
        supplierInvoiceId: !isClient ? inv.id : null,
        amount: inv.amountToPay
      }))

      const body: Record<string, unknown> = {
        type: wizardMode,
        amount: totalSelected,
        method: payMethod,
        reference: payReference || null,
        date: payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        notes: payNotes || null,
        bankAccountId: needsBankAccount(payMethod) ? (payBankAccountId || null) : null,
        cashRegisterId: needsCashRegister(payMethod) ? (payCashRegisterId || null) : null,
        lines
      }

      const result = await api.post<Payment>('/finance/payments', body)
      const paymentId = result.id

      // Create EffetCheque if needed
      if ((payMethod === 'check' || payMethod === 'effet') && effetForm.numero) {
        try {
          await api.post('/effets-cheques', {
            paymentId,
            bankAccountId: payBankAccountId || null,
            type: payMethod === 'effet' ? 'effet' : 'cheque',
            numero: effetForm.numero,
            montant: totalSelected,
            beneficiaire: effetForm.beneficiaire || null,
            banqueEmettrice: effetForm.banqueEmettrice || null,
            dateEmission: effetForm.dateEmission ? new Date(effetForm.dateEmission).toISOString() : new Date().toISOString(),
            dateEcheance: effetForm.dateEcheance ? new Date(effetForm.dateEcheance).toISOString() : null,
            notes: effetForm.notes || null
          })
          toast.success('Effet enregistré')
        } catch (effetErr: any) {
          toast.error(effetErr.message || 'Erreur enregistrement effet')
        }
      }

      toast.success(isClient ? 'Paiement client enregistré' : 'Paiement fournisseur enregistré')
      setDialogOpen(false)
      fetchPayments()
    } catch (err: any) {
      toast.error(err.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/finance/payments?id=${id}`)
      toast.success('Paiement supprimé')
      fetchPayments()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  // ── Filtered entity lists for search ──────────────────────────────────────

  const filteredClients = useMemo(() => {
    if (!entitySearch) return clients
    const s = entitySearch.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)
    )
  }, [clients, entitySearch])

  const filteredSuppliers = useMemo(() => {
    if (!entitySearch) return suppliers
    const s = entitySearch.toLowerCase()
    return suppliers.filter(sup =>
      sup.name.toLowerCase().includes(s) || sup.code.toLowerCase().includes(s)
    )
  }, [suppliers, entitySearch])

  // ── Can proceed step validation ───────────────────────────────────────────

  const canGoStep2 = !!(selectedEntity && selectedInvoices.length >= 0)

  const canGoStep3 = selectedInvoices.some(inv => inv.checked) && totalSelected > 0

  const canSaveStep3 = (() => {
    if (!canGoStep3) return false
    if (needsBankAccount(payMethod) && !payBankAccountId) return false
    if (needsCashRegister(payMethod) && !payCashRegisterId) return false
    return true
  })()

  // ── Get linked invoice numbers for display ────────────────────────────────

  const getLinkedInvoiceNumbers = (payment: Payment): string => {
    if (!payment.paymentLines || payment.paymentLines.length === 0) return '—'
    return payment.paymentLines
      .map(line => line.invoice?.number || line.supplierInvoice?.number)
      .filter(Boolean)
      .join(', ')
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-32" />
          </div>
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Paiements</h2>
          <Badge variant="secondary">{filteredPayments.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openWizard('client_payment')} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <ArrowDownToLine className="h-4 w-4 mr-1" />
            Paiement client
          </Button>
          <Button onClick={() => openWizard('supplier_payment')} size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
            <ArrowUpFromLine className="h-4 w-4 mr-1" />
            Paiement fournisseur
          </Button>
          <Button onClick={() => openWizard('cash_in')} size="sm" variant="outline">
            <Wallet className="h-4 w-4 mr-1" />
            Entrée caisse
          </Button>
          <Button onClick={() => openWizard('cash_out')} size="sm" variant="outline">
            <Wallet className="h-4 w-4 mr-1" />
            Sortie caisse
          </Button>
        </div>
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
                  <TableHead className="hidden lg:table-cell">Factures liées</TableHead>
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
                    <TableRow key={payment.id} className="cursor-pointer" onDoubleClick={() => openView(payment)}>
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
                        <div className="flex items-center gap-1">
                          {payment.bankAccount ? (
                            <><Building2 className="h-3.5 w-3.5" />{payment.bankAccount.name}</>
                          ) : payment.cashRegister ? (
                            <><Wallet className="h-3.5 w-3.5" />{payment.cashRegister.name}</>
                          ) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm font-mono">
                        {payment.reference || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {payment.type === 'cash_in' || payment.type === 'cash_out' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="font-mono text-xs">{getLinkedInvoiceNumbers(payment)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openView(payment) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(payment) }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN DIALOG — Wizard (client/supplier) / Cash in-out / Edit
         ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{wizardTitle}</DialogTitle>
          </DialogHeader>

          {/* ── Edit Mode ─────────────────────────────────────────────────── */}
          {editingPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="secondary" className={paymentTypeColors[editingPayment.type]}>
                    {paymentTypeLabels[editingPayment.type]}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="font-semibold">{formatCurrency(editingPayment.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="text-sm flex items-center gap-1.5">
                    <MethodIcon method={editingPayment.method} />
                    {paymentMethodLabels[editingPayment.method]}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ref">Référence</Label>
                <Input
                  id="edit-ref"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                  placeholder="Référence (facultatif)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes (facultatif)"
                  rows={3}
                />
              </div>
              {editingPayment.paymentLines && editingPayment.paymentLines.length > 0 && (
                <div className="space-y-2">
                  <Label>Factures liées</Label>
                  <div className="border rounded-lg p-3 space-y-1 bg-muted/30">
                    {editingPayment.paymentLines.map(line => (
                      <div key={line.id} className="flex justify-between text-sm">
                        <span className="font-mono">
                          {line.invoice?.number || line.supplierInvoice?.number}
                        </span>
                        <span className="font-medium">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Modifier'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ── Cash In / Cash Out Mode ───────────────────────────────────── */}
          {!editingPayment && (wizardMode === 'cash_in' || wizardMode === 'cash_out') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Montant (MAD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={cashMethod === value ? 'default' : 'outline'}
                      className="w-full justify-center gap-2 text-xs sm:text-sm"
                      onClick={() => {
                        const newMethod = value as PaymentMethod
                        setCashMethod(newMethod)
                        if (needsBankAccount(newMethod) && needsCashRegister(cashMethod)) setCashCashRegisterId('')
                        if (needsCashRegister(newMethod) && needsBankAccount(cashMethod)) setCashBankAccountId('')
                      }}
                    >
                      <MethodIcon method={value as PaymentMethod} />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
              {needsBankAccount(cashMethod) && (
                <div className="space-y-2">
                  <Label>Compte bancaire</Label>
                  <Select value={cashBankAccountId} onValueChange={setCashBankAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un compte bancaire" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.length === 0 && <SelectItem value="__none" disabled>Aucun compte actif</SelectItem>}
                      {bankAccounts.map(ba => (
                        <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsCashRegister(cashMethod) && (
                <div className="space-y-2">
                  <Label>Caisse</Label>
                  <Select value={cashCashRegisterId} onValueChange={setCashCashRegisterId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner une caisse" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashRegisters.length === 0 && <SelectItem value="__none" disabled>Aucune caisse active</SelectItem>}
                      {cashRegisters.map(cr => (
                        <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Référence</Label>
                <Input value={cashReference} onChange={(e) => setCashReference(e.target.value)} placeholder="Référence (facultatif)" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={cashNotes} onChange={(e) => setCashNotes(e.target.value)} placeholder="Notes (facultatif)" rows={2} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={!cashAmount || parseFloat(cashAmount) <= 0 || saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ── Wizard Mode (Client / Supplier Payment) ───────────────────── */}
          {!editingPayment && (wizardMode === 'client_payment' || wizardMode === 'supplier_payment') && (
            <div className="space-y-4">
              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3].map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-colors ${
                      step === wizardStep
                        ? 'bg-primary text-primary-foreground'
                        : step < wizardStep
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {step < wizardStep ? '✓' : step}
                    </div>
                    <span className={`text-xs ${step === wizardStep ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {step === 1
                        ? (wizardMode === 'client_payment' ? 'Client' : 'Fournisseur')
                        : step === 2
                          ? 'Factures'
                          : 'Paiement'}
                    </span>
                    {step < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>

              {/* ── Step 1: Select Client / Supplier ──────────────────────── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      {wizardMode === 'client_payment' ? 'Sélectionner un client' : 'Sélectionner un fournisseur'}
                    </Label>
                    <Input
                      placeholder="Rechercher par nom ou code..."
                      value={entitySearch}
                      onChange={(e) => setEntitySearch(e.target.value)}
                    />
                  </div>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    {(wizardMode === 'client_payment' ? filteredClients : filteredSuppliers).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {entitySearch ? 'Aucun résultat trouvé' : 'Chargement...'}
                      </div>
                    ) : (
                      (wizardMode === 'client_payment' ? filteredClients : filteredSuppliers).map(entity => (
                        <button
                          key={entity.id}
                          type="button"
                          className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b last:border-b-0 transition-colors hover:bg-muted/50 ${
                            selectedEntity?.id === entity.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                          }`}
                          onClick={() => handleEntitySelect(entity.id)}
                        >
                          <div>
                            <span className="font-medium">{entity.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({entity.code})</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-mono ${entity.balance > 0 ? 'text-green-600' : entity.balance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {formatCurrency(entity.balance)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                    <Button disabled={!selectedEntity} onClick={() => setWizardStep(2)}>
                      Suivant
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* ── Step 2: Unpaid Invoices ──────────────────────────────── */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Factures impayées — {selectedEntity?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedInvoices.filter(inv => inv.checked).length} facture(s) sélectionnée(s)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllInvoices}>
                        <CheckSquare className="h-3.5 w-3.5 mr-1" />
                        Tout sélectionner
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllInvoices}>
                        <Square className="h-3.5 w-3.5 mr-1" />
                        Tout déselectionner
                      </Button>
                      <Button variant="outline" size="sm" onClick={payAllInvoices}>
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Tout payer
                      </Button>
                    </div>
                  </div>

                  {invoicesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : selectedInvoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
                      Aucune facture impayée trouvée pour ce {wizardMode === 'client_payment' ? 'client' : 'fournisseur'}.
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10 pl-3"></TableHead>
                              <TableHead>N° Facture</TableHead>
                              <TableHead className="hidden sm:table-cell">Date</TableHead>
                              <TableHead className="text-right">Montant TTC</TableHead>
                              <TableHead className="text-right hidden sm:table-cell">Déjà payé</TableHead>
                              <TableHead className="text-right">Reste à payer</TableHead>
                              <TableHead className="text-right pr-3">Montant à payer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedInvoices.map(inv => (
                              <TableRow key={inv.id} className={inv.checked ? 'bg-primary/5' : ''}>
                                <TableCell className="pl-3">
                                  <Checkbox
                                    checked={inv.checked}
                                    onCheckedChange={() => toggleInvoiceCheck(inv.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                                  {format(new Date(inv.date), 'dd/MM/yyyy', { locale: fr })}
                                </TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(inv.totalTTC)}</TableCell>
                                <TableCell className="text-right text-sm hidden sm:table-cell text-muted-foreground">
                                  {formatCurrency(inv.amountPaid)}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-red-600">
                                  {formatCurrency(inv.remaining)}
                                </TableCell>
                                <TableCell className="text-right pr-3">
                                  {inv.checked && (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={inv.remaining}
                                      value={inv.amountToPay}
                                      onChange={(e) => updateInvoiceAmount(inv.id, e.target.value)}
                                      className="w-28 ml-auto text-right text-sm h-8"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/30">
                    <span className="font-medium">Total sélectionné</span>
                    <span className="text-lg font-bold">{formatCurrency(totalSelected)}</span>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWizardStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Retour
                    </Button>
                    <Button disabled={!canGoStep3} onClick={() => setWizardStep(3)}>
                      Suivant
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* ── Step 3: Payment Method & Details ─────────────────────── */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{selectedEntity?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedInvoices.filter(inv => inv.checked).length} facture(s)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(totalSelected)}</p>
                          <p className="text-xs text-muted-foreground">
                            {wizardMode === 'client_payment' ? 'Encaissement' : 'Décaissement'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment method */}
                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {Object.entries(paymentMethodLabels).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          variant={payMethod === value ? 'default' : 'outline'}
                          className="w-full justify-center gap-2 text-xs sm:text-sm"
                          onClick={() => {
                            const newMethod = value as PaymentMethod
                            setPayMethod(newMethod)
                            if (needsBankAccount(newMethod) && needsCashRegister(payMethod)) setPayCashRegisterId('')
                            if (needsCashRegister(newMethod) && needsBankAccount(payMethod)) setPayBankAccountId('')
                            setShowEffetForm(newMethod === 'check' || newMethod === 'effet')
                            if (newMethod === 'check' || newMethod === 'effet') {
                              setEffetForm({ ...emptyEffet, montant: String(totalSelected) })
                            }
                          }}
                        >
                          <MethodIcon method={value as PaymentMethod} />
                          <span className="hidden sm:inline">{label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Destination account */}
                  {needsBankAccount(payMethod) && (
                    <div className="space-y-2">
                      <Label>Compte bancaire</Label>
                      <Select value={payBankAccountId} onValueChange={setPayBankAccountId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionner un compte bancaire" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.length === 0 && <SelectItem value="__none" disabled>Aucun compte actif</SelectItem>}
                          {bankAccounts.map(ba => (
                            <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {needsCashRegister(payMethod) && (
                    <div className="space-y-2">
                      <Label>Caisse</Label>
                      <Select value={payCashRegisterId} onValueChange={setPayCashRegisterId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionner une caisse" />
                        </SelectTrigger>
                        <SelectContent>
                          {cashRegisters.length === 0 && <SelectItem value="__none" disabled>Aucune caisse active</SelectItem>}
                          {cashRegisters.map(cr => (
                            <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* EffetCheque sub-form */}
                  {showEffetForm && (payMethod === 'check' || payMethod === 'effet') && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {payMethod === 'effet' ? "Détails de l'effet de commerce" : 'Détails du chèque'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Numéro *</Label>
                          <Input
                            value={effetForm.numero}
                            onChange={(e) => setEffetForm({ ...effetForm, numero: e.target.value })}
                            placeholder="Numéro du chèque/effet"
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
                        <div className="space-y-2">
                          <Label>Date d'émission</Label>
                          <Input
                            type="date"
                            value={effetForm.dateEmission}
                            onChange={(e) => setEffetForm({ ...effetForm, dateEmission: e.target.value })}
                          />
                        </div>
                        {payMethod === 'effet' && (
                          <div className="space-y-2">
                            <Label>Date d'échéance</Label>
                            <Input
                              type="date"
                              value={effetForm.dateEcheance}
                              onChange={(e) => setEffetForm({ ...effetForm, dateEcheance: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Montant</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={effetForm.montant}
                            onChange={(e) => setEffetForm({ ...effetForm, montant: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
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

                  {/* Date, Reference, Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Référence</Label>
                      <Input
                        value={payReference}
                        onChange={(e) => setPayReference(e.target.value)}
                        placeholder="Référence (auto-générée)"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Notes (facultatif)"
                      rows={2}
                    />
                  </div>

                  {/* Final summary */}
                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Montant</p>
                          <p className="font-bold">{formatCurrency(totalSelected)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Mode</p>
                          <p className="font-medium flex items-center gap-1">
                            <MethodIcon method={payMethod} />
                            {paymentMethodLabels[payMethod]}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Compte</p>
                          <p className="font-medium text-xs">
                            {needsBankAccount(payMethod) && payBankAccountId
                              ? bankAccounts.find(b => b.id === payBankAccountId)?.name || '—'
                              : needsCashRegister(payMethod) && payCashRegisterId
                                ? cashRegisters.find(c => c.id === payCashRegisterId)?.name || '—'
                                : '—'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWizardStep(2)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Retour
                    </Button>
                    <Button onClick={handleSave} disabled={!canSaveStep3 || saving}>
                      {saving ? 'Enregistrement...' : (
                        <>
                          <CreditCard className="h-4 w-4 mr-1" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW DETAIL DIALOG
         ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails du paiement</DialogTitle>
          </DialogHeader>
          {viewingPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="secondary" className={paymentTypeColors[viewingPayment.type]}>
                    {paymentTypeLabels[viewingPayment.type]}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-lg font-bold">{formatCurrency(viewingPayment.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="text-sm flex items-center gap-1.5">
                    <MethodIcon method={viewingPayment.method} />
                    {paymentMethodLabels[viewingPayment.method]}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Compte</p>
                  <p className="text-sm">
                    {viewingPayment.bankAccount ? (
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{viewingPayment.bankAccount.name}</span>
                    ) : viewingPayment.cashRegister ? (
                      <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />{viewingPayment.cashRegister.name}</span>
                    ) : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm">{format(new Date(viewingPayment.date || viewingPayment.createdAt), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="text-sm font-mono">{viewingPayment.reference || '—'}</p>
                </div>
              </div>
              {viewingPayment.notes && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{viewingPayment.notes}</p>
                </div>
              )}
              {viewingPayment.paymentLines && viewingPayment.paymentLines.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Factures liées</p>
                  <div className="border rounded-lg divide-y">
                    {viewingPayment.paymentLines.map(line => (
                      <div key={line.id} className="flex justify-between items-center px-3 py-2 text-sm">
                        <div>
                          <span className="font-mono">{line.invoice?.number || line.supplierInvoice?.number}</span>
                          {line.invoice?.client && (
                            <span className="text-muted-foreground ml-2 text-xs">{line.invoice.client.name}</span>
                          )}
                          {line.supplierInvoice?.supplier && (
                            <span className="text-muted-foreground ml-2 text-xs">{line.supplierInvoice.supplier.name}</span>
                          )}
                        </div>
                        <span className="font-medium">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewingPayment.effetsCheques && viewingPayment.effetsCheques.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Effets / Chèques</p>
                  <div className="border rounded-lg divide-y">
                    {viewingPayment.effetsCheques.map(ec => (
                      <div key={ec.id} className="flex justify-between items-center px-3 py-2 text-sm">
                        <div>
                          <span className="font-mono">{ec.numero}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">{ec.type}</Badge>
                        </div>
                        <span className="font-medium">{formatCurrency(ec.montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
