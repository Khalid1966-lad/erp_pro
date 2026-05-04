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
import {
  Plus, Edit, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Printer
} from 'lucide-react'
import { HelpButton } from '@/components/erp/shared/help-button'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { PrintHeader } from '@/components/erp/shared/print-header'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

interface CashRegister {
  id: string
  name: string
  description: string | null
  balance: number
  minBalance: number | null
  isActive: boolean
  _count: { cashMovements: number }
}

interface CashMovement {
  id: string
  cashRegisterId: string
  type: 'in' | 'out'
  amount: number
  paymentMethod: string | null
  reference: string | null
  notes: string | null
  createdAt: string
  cashRegister: { id: string; name: string }
}

const emptyMovement = {
  type: 'in' as const,
  amount: '',
  paymentMethod: 'cash',
  reference: '',
  notes: ''
}

const emptyRegister = {
  name: '',
  description: '',
  minBalance: ''
}

export default function CashRegistersView() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null)
  const [movementTotal, setMovementTotal] = useState(0)

  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [editingRegister, setEditingRegister] = useState<CashRegister | null>(null)
  const [registerForm, setRegisterForm] = useState(emptyRegister)
  const [movementForm, setMovementForm] = useState(emptyMovement)
  const [saving, setSaving] = useState(false)

  // Statement dialog state
  const [statementOpen, setStatementOpen] = useState(false)
  const [stmtDateFrom, setStmtDateFrom] = useState('')
  const [stmtDateTo, setStmtDateTo] = useState('')

  const fetchRegisters = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ registers: CashRegister[] }>('/finance/cash')
      setRegisters(data.registers || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement caisses')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMovements = useCallback(async (registerId: string) => {
    try {
      setMovementsLoading(true)
      const data = await api.get<{ movements: CashMovement[]; total: number; page: number; limit: number }>(
        `/finance/cash?view=movements&cashRegisterId=${registerId}`
      )
      setMovements(data.movements || [])
      setMovementTotal(data.total || 0)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement mouvements')
    } finally {
      setMovementsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegisters()
  }, [fetchRegisters])

  useEffect(() => {
    if (selectedRegisterId) {
      fetchMovements(selectedRegisterId)
    } else {
      setMovements([])
    }
  }, [selectedRegisterId, fetchMovements])

  const totalBalance = registers.reduce((acc, r) => acc + r.balance, 0)
  const totalMovements = registers.reduce((acc, r) => acc + r._count.cashMovements, 0)
  const selectedRegister = registers.find(r => r.id === selectedRegisterId)

  const openCreateRegister = () => {
    setEditingRegister(null)
    setRegisterForm(emptyRegister)
    setRegisterDialogOpen(true)
  }

  const openEditRegister = (reg: CashRegister) => {
    setEditingRegister(reg)
    setRegisterForm({
      name: reg.name,
      description: reg.description || '',
      minBalance: reg.minBalance?.toString() || ''
    })
    setRegisterDialogOpen(true)
  }

  const handleSaveRegister = async () => {
    if (!registerForm.name.trim()) return
    try {
      setSaving(true)
      if (editingRegister) {
        await api.put('/finance/cash', {
          id: editingRegister.id,
          name: registerForm.name.trim(),
          description: registerForm.description || null,
          minBalance: registerForm.minBalance ? parseFloat(registerForm.minBalance) : null
        })
        toast.success('Caisse modifiée')
      } else {
        await api.post('/finance/cash', {
          entityType: 'register',
          name: registerForm.name.trim(),
          description: registerForm.description || null,
          minBalance: registerForm.minBalance ? parseFloat(registerForm.minBalance) : null
        })
        toast.success('Caisse créée')
      }
      setRegisterDialogOpen(false)
      fetchRegisters()
    } catch (err: any) {
      toast.error(err.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRegister = async (id: string) => {
    try {
      await api.delete(`/finance/cash?id=${id}`)
      toast.success('Caisse supprimée')
      if (selectedRegisterId === id) {
        setSelectedRegisterId(null)
      }
      fetchRegisters()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  const openAddMovement = () => {
    if (!selectedRegisterId) return
    setMovementForm(emptyMovement)
    setMovementDialogOpen(true)
  }

  const handleSaveMovement = async () => {
    if (!selectedRegisterId || !movementForm.amount) return
    try {
      setSaving(true)
      await api.post('/finance/cash', {
        cashRegisterId: selectedRegisterId,
        type: movementForm.type,
        amount: parseFloat(movementForm.amount),
        paymentMethod: movementForm.paymentMethod || null,
        reference: movementForm.reference || null,
        notes: movementForm.notes || null
      })
      toast.success('Mouvement enregistré')
      setMovementDialogOpen(false)
      fetchMovements(selectedRegisterId)
      fetchRegisters()
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement')
    } finally {
      setSaving(false)
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
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Caisses</h2>
          <Badge variant="secondary">{registers.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="finance" sub="caisses" />
          <Button onClick={openCreateRegister} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle caisse
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              Caisses actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registers.filter(r => r.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total mouvements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMovements}</div>
          </CardContent>
        </Card>
      </div>

      {/* Register list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caisses disponibles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Mouvements</TableHead>
                  <TableHead className="hidden lg:table-cell">Statut</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune caisse enregistrée.
                    </TableCell>
                  </TableRow>
                ) : (
                  registers.map((reg) => (
                    <TableRow
                      key={reg.id}
                      className={`cursor-pointer ${selectedRegisterId === reg.id ? 'bg-muted' : ''}`}
                      onClick={() => setSelectedRegisterId(reg.id)}
                    >
                      <TableCell className="pl-4 font-medium">{reg.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {reg.description || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={reg.balance < 0 ? 'text-red-600' : reg.balance > 0 ? 'text-green-600' : ''}>
                          {formatCurrency(reg.balance)}
                        </span>
                        {reg.minBalance !== null && reg.balance < reg.minBalance && (
                          <Badge variant="destructive" className="ml-2 text-xs">Sous minimum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant="outline">{reg._count.cashMovements}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={reg.isActive ? 'default' : 'secondary'}>
                          {reg.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRegister(reg)}>
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
                                <AlertDialogTitle>Supprimer la caisse</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer la caisse <strong>{reg.name}</strong> ?
                                  Tous les mouvements associés seront perdus.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRegister(reg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Movements panel */}
      {selectedRegister && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Mouvements — {selectedRegister.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Solde actuel : <span className={selectedRegister.balance < 0 ? 'text-red-600 font-semibold' : 'font-semibold'}>{formatCurrency(selectedRegister.balance)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStatementOpen(true); setStmtDateFrom(''); setStmtDateTo('') }}>
                <Printer className="h-4 w-4 mr-1" />
                Relevé
              </Button>
              <Button onClick={openAddMovement} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nouveau mouvement
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {movementsLoading ? (
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
                      <TableHead className="pl-4">Type</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="hidden sm:table-cell">Mode</TableHead>
                      <TableHead className="hidden md:table-cell">Référence</TableHead>
                      <TableHead className="hidden lg:table-cell">Notes</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun mouvement enregistré.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((mv) => (
                        <TableRow key={mv.id}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2">
                              {mv.type === 'in' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <Badge variant={mv.type === 'in' ? 'default' : 'destructive'} className="bg-green-600 text-white hover:bg-green-600">
                                {mv.type === 'in' ? 'Entrée' : 'Sortie'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={mv.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                              {mv.type === 'in' ? '+' : '-'}{formatCurrency(mv.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground capitalize">
                            {mv.paymentMethod || '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {mv.reference || '—'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                            {mv.notes || '—'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                            {format(new Date(mv.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
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

      {/* Register Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRegister ? 'Modifier la caisse' : 'Nouvelle caisse'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Nom *</Label>
              <Input
                id="reg-name"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                placeholder="Nom de la caisse"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-desc">Description</Label>
              <Textarea
                id="reg-desc"
                value={registerForm.description}
                onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                placeholder="Description de la caisse"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-min">Solde minimum (€)</Label>
              <Input
                id="reg-min"
                type="number"
                step="0.01"
                value={registerForm.minBalance}
                onChange={(e) => setRegisterForm({ ...registerForm, minBalance: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveRegister} disabled={!registerForm.name.trim() || saving}>
              {saving ? 'Enregistrement...' : editingRegister ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau mouvement</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Caisse : {selectedRegister?.name}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={movementForm.type} onValueChange={(v) => setMovementForm({ ...movementForm, type: v as 'in' | 'out' })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">
                    <span className="flex items-center gap-2 text-green-600">
                      <ArrowUpCircle className="h-4 w-4" /> Entrée
                    </span>
                  </SelectItem>
                  <SelectItem value="out">
                    <span className="flex items-center gap-2 text-red-600">
                      <ArrowDownCircle className="h-4 w-4" /> Sortie
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mv-amount">Montant (€) *</Label>
              <Input
                id="mv-amount"
                type="number"
                step="0.01"
                min="0"
                value={movementForm.amount}
                onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={movementForm.paymentMethod} onValueChange={(v) => setMovementForm({ ...movementForm, paymentMethod: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                  <SelectItem value="card">Carte</SelectItem>
                  <SelectItem value="bank_transfer">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mv-ref">Référence</Label>
              <Input
                id="mv-ref"
                value={movementForm.reference}
                onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
                placeholder="Référence (facultatif)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mv-notes">Notes</Label>
              <Textarea
                id="mv-notes"
                value={movementForm.notes}
                onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                placeholder="Notes (facultatif)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveMovement} disabled={!movementForm.amount || saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Dialog */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Imprimer le relevé de caisse</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedRegister?.name}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stmt-from">Date début</Label>
              <Input
                id="stmt-from"
                type="date"
                value={stmtDateFrom}
                onChange={(e) => setStmtDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stmt-to">Date fin</Label>
              <Input
                id="stmt-to"
                type="date"
                value={stmtDateTo}
                onChange={(e) => setStmtDateTo(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Laissez les dates vides pour inclure tous les mouvements.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatementOpen(false)}>Annuler</Button>
            <Button onClick={() => { handlePrintStatement(); setStatementOpen(false) }}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  function handlePrintStatement() {
    if (!selectedRegister) return
    const filtered = movements.filter((mv) => {
      const d = new Date(mv.createdAt)
      if (stmtDateFrom && d < new Date(stmtDateFrom)) return false
      if (stmtDateTo) { const end = new Date(stmtDateTo); end.setHours(23, 59, 59, 999); if (d > end) return false }
      return true
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    let runningBalance = selectedRegister.balance
    // Subtract all movements to get balance before first
    // Actually we need to compute from filtered: start with 0, or better compute running from total
    // We'll compute the balance before the period by removing the filtered amounts from current balance
    const totalIn = filtered.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0)
    const totalOut = filtered.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0)
    const startBalance = selectedRegister.balance - totalIn + totalOut

    const rows: Array<Array<{ value: string | number; align?: string }>> = filtered.map((mv) => {
      runningBalance += mv.type === 'in' ? mv.amount : -mv.amount
      return [
        { value: format(new Date(mv.createdAt), 'dd/MM/yyyy', { locale: fr }), align: 'center' },
        { value: mv.type === 'in' ? 'Entrée' : 'Sortie' },
        { value: mv.paymentMethod || '—' },
        { value: mv.reference || '—' },
        { value: mv.notes || '' },
        { value: mv.type === 'in' ? fmtMoney(mv.amount) : `-${fmtMoney(mv.amount)}`, align: 'right' },
        { value: fmtMoney(runningBalance), align: 'right' },
      ]
    })

    printDocument({
      title: 'RELEVÉ DE CAISSE',
      docNumber: selectedRegister.name,
      infoGrid: [
        { label: 'Caisse', value: selectedRegister.name },
        { label: 'Période du', value: stmtDateFrom ? fmtDate(stmtDateFrom) : 'Début' },
        { label: 'Au', value: stmtDateTo ? fmtDate(stmtDateTo) : "Aujourd'hui" },
        { label: 'Solde initial', value: fmtMoney(startBalance), colspan: 2 },
      ],
      columns: [
        { label: 'Date', align: 'center' },
        { label: 'Type' },
        { label: 'Mode' },
        { label: 'Réf.' },
        { label: 'Notes' },
        { label: 'Montant', align: 'right' },
        { label: 'Solde', align: 'right' },
      ],
      rows,
      totals: [
        { label: 'Total entrées', value: fmtMoney(totalIn) },
        { label: 'Total sorties', value: `-${fmtMoney(totalOut)}` },
        { label: 'Solde final', value: fmtMoney(selectedRegister.balance), bold: true },
      ],
      amountInWords: `${selectedRegister.balance.toLocaleString('fr-FR')} dirhams`,
      amountInWordsLabel: 'Arrêté le présent relevé à la somme de',
    })
  }
}
