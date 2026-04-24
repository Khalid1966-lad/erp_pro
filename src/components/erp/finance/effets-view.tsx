'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  FileText, Landmark, Search, Clock, CheckCircle2, XCircle, ArrowRight,
  AlertTriangle, Send
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

type EffetStatut = 'en_attente' | 'remis_banque' | 'valide' | 'rejete'

interface EffetCheque {
  id: string
  paymentId: string
  bankAccountId?: string | null
  type: string // 'cheque' | 'effet'
  numero: string
  statut: EffetStatut
  montant: number
  beneficiaire?: string | null
  banqueEmettrice?: string | null
  dateEmission: string
  dateEcheance?: string | null
  dateRemiseBanque?: string | null
  dateValidation?: string | null
  dateRejet?: string | null
  causeRejet?: string | null
  notes?: string | null
  createdAt: string
  payment?: {
    id: string
    type: string
    invoice?: {
      id: string
      number: string
      client: { id: string; name: string }
    }
  }
  bankAccount?: {
    id: string
    name: string
    iban: string
  } | null
}

interface BankAccount {
  id: string
  name: string
  isActive: boolean
}

const statutLabels: Record<EffetStatut, string> = {
  en_attente: 'En instance',
  remis_banque: 'Remis à la banque',
  valide: 'Validé',
  rejete: 'Rejeté'
}

const statutColors: Record<EffetStatut, string> = {
  en_attente: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  remis_banque: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  valide: 'bg-green-100 text-green-800 hover:bg-green-100',
  rejete: 'bg-red-100 text-red-800 hover:bg-red-100'
}

const causeRejetOptions = [
  'Provision insuffisante',
  'Signature irrégulière',
  "Barrement non respecté",
  "Endossement irrégulier",
  'Date post-datée',
  'Date périmée',
  'Opposition',
  'Compte clôturé',
  'Faux chèque',
  'Autre'
]

export default function EffetsView() {
  const [effets, setEffets] = useState<EffetCheque[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  // Remise dialog
  const [remiseDialogOpen, setRemiseDialogOpen] = useState(false)
  const [remiseEffet, setRemiseEffet] = useState<EffetCheque | null>(null)
  const [remiseBankId, setRemiseBankId] = useState('')
  const [remiseDate, setRemiseDate] = useState(new Date().toISOString().split('T')[0])

  // Validation dialog
  const [validDialogOpen, setValidDialogOpen] = useState(false)
  const [validEffet, setValidEffet] = useState<EffetCheque | null>(null)
  const [validDate, setValidDate] = useState(new Date().toISOString().split('T')[0])

  // Rejet dialog
  const [rejetDialogOpen, setRejetDialogOpen] = useState(false)
  const [rejetEffet, setRejetEffet] = useState<EffetCheque | null>(null)
  const [rejetDate, setRejetDate] = useState(new Date().toISOString().split('T')[0])
  const [rejetCause, setRejetCause] = useState('')

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailEffet, setDetailEffet] = useState<EffetCheque | null>(null)

  const fetchEffets = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<{ effets: EffetCheque[] }>('/effets-cheques')
      setEffets(data.effets || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement effets')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBankAccounts = useCallback(async () => {
    try {
      const data = await api.get<{ accounts: BankAccount[] }>('/finance/bank')
      setBankAccounts((data.accounts || []).filter(b => b.isActive))
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchEffets()
    fetchBankAccounts()
  }, [fetchEffets, fetchBankAccounts])

  const filteredEffets = useMemo(() => {
    return effets.filter(e => {
      if (statutFilter !== 'all' && e.statut !== statutFilter) return false
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          e.numero.toLowerCase().includes(s) ||
          e.beneficiaire?.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [effets, search, statutFilter, typeFilter])

  const stats = useMemo(() => {
    const enAttente = effets.filter(e => e.statut === 'en_attente')
    const remis = effets.filter(e => e.statut === 'remis_banque')
    const valides = effets.filter(e => e.statut === 'valide')
    const rejetes = effets.filter(e => e.statut === 'rejete')
    return {
      enAttente: { count: enAttente.length, montant: enAttente.reduce((a, e) => a + e.montant, 0) },
      remis: { count: remis.length, montant: remis.reduce((a, e) => a + e.montant, 0) },
      valides: { count: valides.length, montant: valides.reduce((a, e) => a + e.montant, 0) },
      rejetes: { count: rejetes.length, montant: rejetes.reduce((a, e) => a + e.montant, 0) },
    }
  }, [effets])

  const handleRemettre = async () => {
    if (!remiseEffet || !remiseBankId) return
    try {
      await api.put('/effets-cheques', {
        id: remiseEffet.id,
        action: 'remettre_banque',
        bankAccountId: remiseBankId,
        dateRemiseBanque: new Date(remiseDate).toISOString()
      })
      toast.success('Effet remis à la banque')
      setRemiseDialogOpen(false)
      fetchEffets()
    } catch (err: any) {
      toast.error(err.message || 'Erreur remise')
    }
  }

  const handleValider = async () => {
    if (!validEffet) return
    try {
      await api.put('/effets-cheques', {
        id: validEffet.id,
        action: 'valider',
        dateValidation: new Date(validDate).toISOString()
      })
      toast.success('Effet validé')
      setValidDialogOpen(false)
      fetchEffets()
    } catch (err: any) {
      toast.error(err.message || 'Erreur validation')
    }
  }

  const handleRejeter = async () => {
    if (!rejetEffet || !rejetCause) return
    try {
      await api.put('/effets-cheques', {
        id: rejetEffet.id,
        action: 'rejeter',
        dateRejet: new Date(rejetDate).toISOString(),
        causeRejet: rejetCause
      })
      toast.success('Effet rejeté')
      setRejetDialogOpen(false)
      fetchEffets()
    } catch (err: any) {
      toast.error(err.message || 'Erreur rejet')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Effets de Commerce</h2>
          <Badge variant="secondary">{filteredEffets.length}</Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              En instance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.enAttente.count}</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(stats.enAttente.montant)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Send className="h-4 w-4 text-blue-600" />
              Remis à la banque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.remis.count}</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(stats.remis.montant)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Validés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.valides.count}</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(stats.valides.montant)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-600" />
              Rejetés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejetes.count}</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(stats.rejetes.montant)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par n°, bénéficiaire..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="en_attente">En instance</SelectItem>
            <SelectItem value="remis_banque">Remis à la banque</SelectItem>
            <SelectItem value="valide">Validé</SelectItem>
            <SelectItem value="rejete">Rejeté</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="cheque">Chèque</SelectItem>
            <SelectItem value="effet">Effet</SelectItem>
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
                  <TableHead className="pl-4">Date émission</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>N°</TableHead>
                  <TableHead className="hidden md:table-cell">Bénéficiaire</TableHead>
                  <TableHead className="hidden lg:table-cell">Banque émettrice</TableHead>
                  <TableHead className="hidden lg:table-cell">Banque remise</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Échéance</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEffets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {search || statutFilter !== 'all' || typeFilter !== 'all'
                        ? 'Aucun effet trouvé.'
                        : 'Aucun effet de commerce enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEffets.map((effet) => (
                    <TableRow key={effet.id}>
                      <TableCell className="pl-4 text-muted-foreground text-sm">
                        {format(new Date(effet.dateEmission), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">
                            {effet.type === 'cheque' ? 'Chèque' : 'Effet'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{effet.numero}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {effet.beneficiaire || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {effet.banqueEmettrice || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {effet.bankAccount?.name || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(effet.montant)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statutColors[effet.statut]}>
                          {statutLabels[effet.statut]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {effet.dateEcheance
                          ? format(new Date(effet.dateEcheance), 'dd/MM/yyyy', { locale: fr })
                          : '—'
                        }
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setDetailEffet(effet); setDetailDialogOpen(true) }}
                          >
                            Détails
                          </Button>
                          {effet.statut === 'en_attente' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                              onClick={() => {
                                setRemiseEffet(effet)
                                setRemiseBankId(effet.bankAccountId || '')
                                setRemiseDate(new Date().toISOString().split('T')[0])
                                setRemiseDialogOpen(true)
                              }}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Remettre
                            </Button>
                          )}
                          {effet.statut === 'remis_banque' && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setValidEffet(effet)
                                  setValidDate(new Date().toISOString().split('T')[0])
                                  setValidDialogOpen(true)
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setRejetEffet(effet)
                                  setRejetDate(new Date().toISOString().split('T')[0])
                                  setRejetCause('')
                                  setRejetDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejeter
                              </Button>
                            </>
                          )}
                          {effet.statut === 'rejete' && effet.causeRejet && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => { setDetailEffet(effet); setDetailDialogOpen(true) }}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Cause
                            </Button>
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Détails — {detailEffet?.type === 'cheque' ? 'Chèque' : 'Effet'} n°{detailEffet?.numero}
            </DialogTitle>
          </DialogHeader>
          {detailEffet && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">{detailEffet.type === 'cheque' ? 'Chèque' : 'Effet de commerce'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p><Badge variant="secondary" className={statutColors[detailEffet.statut]}>{statutLabels[detailEffet.statut]}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant</span>
                  <p className="font-medium">{formatCurrency(detailEffet.montant)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">N°</span>
                  <p className="font-medium">{detailEffet.numero}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bénéficiaire</span>
                  <p>{detailEffet.beneficiaire || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Banque émettrice</span>
                  <p>{detailEffet.banqueEmettrice || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Banque de remise</span>
                  <p>{detailEffet.bankAccount?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date d'émission</span>
                  <p>{format(new Date(detailEffet.dateEmission), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
                {detailEffet.dateEcheance && (
                  <div>
                    <span className="text-muted-foreground">Date d'échéance</span>
                    <p>{format(new Date(detailEffet.dateEcheance), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
                {detailEffet.dateRemiseBanque && (
                  <div>
                    <span className="text-muted-foreground">Remise le</span>
                    <p>{format(new Date(detailEffet.dateRemiseBanque), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
                {detailEffet.dateValidation && (
                  <div>
                    <span className="text-muted-foreground">Validation le</span>
                    <p>{format(new Date(detailEffet.dateValidation), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
                {detailEffet.dateRejet && (
                  <div>
                    <span className="text-muted-foreground">Rejet le</span>
                    <p>{format(new Date(detailEffet.dateRejet), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
              </div>
              {detailEffet.causeRejet && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Cause du rejet
                  </div>
                  <p className="mt-1 text-red-600 dark:text-red-300">{detailEffet.causeRejet}</p>
                </div>
              )}
              {detailEffet.payment?.invoice && (
                <div className="mt-2">
                  <span className="text-muted-foreground">Facture liée</span>
                  <p className="font-medium">
                    {detailEffet.payment.invoice.number} — {detailEffet.payment.invoice.client.name}
                  </p>
                </div>
              )}
              {detailEffet.notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p>{detailEffet.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remise Dialog */}
      <Dialog open={remiseDialogOpen} onOpenChange={setRemiseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Remettre à la banque
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {remiseEffet?.type === 'cheque' ? 'Chèque' : 'Effet'} n°{remiseEffet?.numero} — {formatCurrency(remiseEffet?.montant || 0)}
            </div>
            <div className="space-y-2">
              <Label>Compte bancaire *</Label>
              <Select value={remiseBankId} onValueChange={setRemiseBankId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un compte bancaire" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>{ba.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de remise</Label>
              <Input
                type="date"
                value={remiseDate}
                onChange={(e) => setRemiseDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemiseDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleRemettre}
              disabled={!remiseBankId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-1" />
              Remettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Dialog */}
      <Dialog open={validDialogOpen} onOpenChange={setValidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Valider l'effet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {validEffet?.type === 'cheque' ? 'Chèque' : 'Effet'} n°{validEffet?.numero} — {formatCurrency(validEffet?.montant || 0)}
            </div>
            <div className="space-y-2">
              <Label>Date de validation</Label>
              <Input
                type="date"
                value={validDate}
                onChange={(e) => setValidDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleValider}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejet Dialog */}
      <Dialog open={rejetDialogOpen} onOpenChange={setRejetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rejeter l'effet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {rejetEffet?.type === 'cheque' ? 'Chèque' : 'Effet'} n°{rejetEffet?.numero} — {formatCurrency(rejetEffet?.montant || 0)}
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Le rejet inversera le paiement et mettra à jour la facture associée.
            </div>
            <div className="space-y-2">
              <Label>Cause du rejet *</Label>
              <Select value={rejetCause} onValueChange={setRejetCause}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner la cause" />
                </SelectTrigger>
                <SelectContent>
                  {causeRejetOptions.map((cause) => (
                    <SelectItem key={cause} value={cause}>{cause}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de rejet</Label>
              <Input
                type="date"
                value={rejetDate}
                onChange={(e) => setRejetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejetDialogOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleRejeter}
              disabled={!rejetCause}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
