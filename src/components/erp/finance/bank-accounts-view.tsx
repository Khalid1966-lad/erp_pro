'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Plus, Edit, Trash2, Landmark, CheckCircle2, Circle, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface BankAccount {
  id: string
  name: string
  iban: string
  bic: string | null
  balance: number
  isActive: boolean
  _count: { bankTransactions: number }
}

interface BankTransaction {
  id: string
  bankAccountId: string
  date: string
  label: string
  amount: number
  reference: string | null
  isReconciled: boolean
  reconciledWith: string | null
  createdAt: string
  bankAccount: { id: string; name: string; iban: string }
}

const emptyAccount = {
  name: '',
  iban: '',
  bic: ''
}

const emptyTransaction = {
  date: new Date().toISOString().split('T')[0],
  label: '',
  amount: '',
  reference: '',
  isReconciled: false
}

export default function BankAccountsView() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [transactionForm, setTransactionForm] = useState(emptyTransaction)
  const [saving, setSaving] = useState(false)

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ accounts: BankAccount[] }>('/finance/bank')
      setAccounts(data.accounts || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement comptes bancaires')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTransactions = useCallback(async (accountId: string) => {
    try {
      setTransactionsLoading(true)
      const data = await api.get<{ transactions: BankTransaction[]; total: number; page: number; limit: number }>(
        `/finance/bank?view=transactions&bankAccountId=${accountId}`
      )
      setTransactions(data.transactions || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement transactions')
    } finally {
      setTransactionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    if (selectedAccountId) {
      fetchTransactions(selectedAccountId)
    } else {
      setTransactions([])
    }
  }, [selectedAccountId, fetchTransactions])

  const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0)
  const totalTransactions = accounts.reduce((acc, a) => acc + a._count.bankTransactions, 0)
  const reconciledCount = transactions.filter(t => t.isReconciled).length
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  const maskIban = (iban: string) => {
    if (iban.length <= 8) return iban
    return iban.substring(0, 4) + ' **** **** ' + iban.substring(iban.length - 4)
  }

  const openCreateAccount = () => {
    setEditingAccount(null)
    setAccountForm(emptyAccount)
    setAccountDialogOpen(true)
  }

  const openEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc)
    setAccountForm({
      name: acc.name,
      iban: acc.iban,
      bic: acc.bic || ''
    })
    setAccountDialogOpen(true)
  }

  const handleSaveAccount = async () => {
    if (!accountForm.name.trim() || !accountForm.iban.trim()) return
    try {
      setSaving(true)
      if (editingAccount) {
        await api.put('/finance/bank', {
          id: editingAccount.id,
          entityType: 'account',
          name: accountForm.name.trim(),
          iban: accountForm.iban.trim(),
          bic: accountForm.bic.trim() || null
        })
        toast.success('Compte modifié')
      } else {
        await api.post('/finance/bank', {
          entityType: 'account',
          name: accountForm.name.trim(),
          iban: accountForm.iban.trim(),
          bic: accountForm.bic.trim() || null
        })
        toast.success('Compte créé')
      }
      setAccountDialogOpen(false)
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      await api.delete(`/finance/bank?id=${id}&entityType=account`)
      toast.success('Compte supprimé')
      if (selectedAccountId === id) {
        setSelectedAccountId(null)
      }
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  const openAddTransaction = () => {
    if (!selectedAccountId) return
    setTransactionForm(emptyTransaction)
    setTransactionDialogOpen(true)
  }

  const handleSaveTransaction = async () => {
    if (!selectedAccountId || !transactionForm.label.trim() || !transactionForm.amount) return
    try {
      setSaving(true)
      await api.post('/finance/bank', {
        bankAccountId: selectedAccountId,
        date: new Date(transactionForm.date).toISOString(),
        label: transactionForm.label.trim(),
        amount: parseFloat(transactionForm.amount),
        reference: transactionForm.reference || null,
        isReconciled: transactionForm.isReconciled
      })
      toast.success('Transaction enregistrée')
      setTransactionDialogOpen(false)
      fetchTransactions(selectedAccountId)
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleReconcile = async (tx: BankTransaction) => {
    try {
      await api.put('/finance/bank', {
        id: tx.id,
        entityType: 'transaction',
        isReconciled: !tx.isReconciled
      })
      if (selectedAccountId) fetchTransactions(selectedAccountId)
      toast.success(tx.isReconciled ? 'Transaction dé-rapprochée' : 'Transaction rapprochée')
    } catch (err: any) {
      toast.error(err.message || 'Erreur rapprochement')
    }
  }

  const handleDeleteTransaction = async (id: string) => {
    try {
      await api.delete(`/finance/bank?id=${id}&entityType=transaction`)
      toast.success('Transaction supprimée')
      if (selectedAccountId) fetchTransactions(selectedAccountId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
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
          <Landmark className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Comptes bancaires</h2>
          <Badge variant="secondary">{accounts.length}</Badge>
        </div>
        <Button onClick={openCreateAccount} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nouveau compte
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Rapprochées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedAccountId ? `${reconciledCount}/${transactions.length}` : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Account list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes disponibles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nom</TableHead>
                  <TableHead className="hidden md:table-cell">IBAN</TableHead>
                  <TableHead className="hidden lg:table-cell">BIC</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Transactions</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun compte bancaire.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => (
                    <TableRow
                      key={acc.id}
                      className={`cursor-pointer ${selectedAccountId === acc.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedAccountId(acc.id)}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{acc.name}</span>
                          {!acc.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-sm">
                        {maskIban(acc.iban)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-sm">
                        {acc.bic || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={acc.balance < 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(acc.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant="outline">{acc._count.bankTransactions}</Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditAccount(acc)}>
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
                                <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer le compte <strong>{acc.name}</strong> ?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAccount(acc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Transactions panel */}
      {selectedAccount && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Transactions — {selectedAccount.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Solde actuel : <span className="font-semibold">{formatCurrency(selectedAccount.balance)}</span>
                {' · '}
                IBAN : <span className="font-mono">{selectedAccount.iban}</span>
              </p>
            </div>
            <Button onClick={openAddTransaction} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle transaction
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {transactionsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 w-10">État</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="hidden md:table-cell">Référence</TableHead>
                      <TableHead className="text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucune transaction enregistrée.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="pl-4">
                            <button
                              onClick={() => handleToggleReconcile(tx)}
                              className="hover:opacity-80 transition-opacity"
                              title={tx.isReconciled ? 'Dé-rapprocher' : 'Rapprocher'}
                            >
                              {tx.isReconciled ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                            {format(new Date(tx.date), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tx.amount >= 0 ? (
                                <ArrowDownLeft className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-red-600 shrink-0" />
                              )}
                              <span className={tx.isReconciled ? '' : 'font-medium'}>{tx.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {tx.reference || '—'}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer la transaction</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Supprimer la transaction <strong>{tx.label}</strong> ?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Modifier le compte' : 'Nouveau compte bancaire'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acc-name">Nom *</Label>
              <Input
                id="acc-name"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                placeholder="Nom du compte"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-iban">IBAN *</Label>
              <Input
                id="acc-iban"
                value={accountForm.iban}
                onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-bic">BIC / SWIFT</Label>
              <Input
                id="acc-bic"
                value={accountForm.bic}
                onChange={(e) => setAccountForm({ ...accountForm, bic: e.target.value })}
                placeholder="BNPAFRPP"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveAccount} disabled={!accountForm.name.trim() || !accountForm.iban.trim() || saving}>
              {saving ? 'Enregistrement...' : editingAccount ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle transaction</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Compte : {selectedAccount?.name}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Date *</Label>
              <Input
                id="tx-date"
                type="date"
                value={transactionForm.date}
                onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-label">Libellé *</Label>
              <Input
                id="tx-label"
                value={transactionForm.label}
                onChange={(e) => setTransactionForm({ ...transactionForm, label: e.target.value })}
                placeholder="Libellé de la transaction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-amount">Montant (€) *</Label>
              <p className="text-xs text-muted-foreground">Utiliser un montant négatif pour les sorties</p>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-ref">Référence</Label>
              <Input
                id="tx-ref"
                value={transactionForm.reference}
                onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                placeholder="Référence (facultatif)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tx-reconciled"
                checked={transactionForm.isReconciled}
                onCheckedChange={(checked) => setTransactionForm({ ...transactionForm, isReconciled: !!checked })}
              />
              <Label htmlFor="tx-reconciled" className="text-sm">Déjà rapprochée</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveTransaction} disabled={!transactionForm.label.trim() || !transactionForm.amount || saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
