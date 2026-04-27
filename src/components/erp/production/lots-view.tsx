'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ProductCombobox } from '@/components/erp/shared/product-combobox'
import {
  Layers, Plus, Eye, RefreshCw, Search, Lock, Unlock, Package, Trash2,
  ArrowRight, ArrowDown, ArrowUp, RotateCcw, MinusCircle, AlertTriangle, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────

type LotStatut = 'actif' | 'epuise' | 'bloque' | 'expire'
type MouvementType = 'entree' | 'sortie' | 'reservation' | 'annulation_resa' | 'retour' | 'ajustement'

interface StockLot {
  id: string
  numeroLot: string
  productId: string
  workOrderId: string | null
  quantiteInitiale: number
  statut: LotStatut
  dateFabrication: string | null
  dateExpiration: string | null
  notes: string | null
  createdAt: string
  product: { id: string; reference: string; designation: string; unit: string }
  workOrder?: { id: string; number: string }
  qtySortie: number
  qtyReservee: number
  qtyRetour: number
  qtyDisponible: number
  qtyPhysique: number
  mouvements?: LotMouvement[]
}

interface LotMouvement {
  id: string
  lotId: string
  type: MouvementType
  quantite: number
  documentRef: string | null
  documentId: string | null
  notes: string | null
  createdAt: string
}

interface ProductOption {
  id: string
  reference: string
  designation: string
}

// ── Constants ──────────────────────────────────────────────────

const lotStatutLabels: Record<LotStatut, string> = {
  actif: 'Actif',
  epuise: 'Épuisé',
  bloque: 'Bloqué',
  expire: 'Expiré',
}

const lotStatutColors: Record<LotStatut, string> = {
  actif: 'bg-green-100 text-green-800 border-green-200',
  epuise: 'bg-gray-100 text-gray-800 border-gray-200',
  bloque: 'bg-red-100 text-red-800 border-red-200',
  expire: 'bg-amber-100 text-amber-800 border-amber-200',
}

const mouvementLabels: Record<MouvementType, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
  reservation: 'Réservation',
  annulation_resa: 'Annulation résa',
  retour: 'Retour',
  ajustement: 'Ajustement',
}

const mouvementColors: Record<MouvementType, string> = {
  entree: 'bg-green-100 text-green-800',
  sortie: 'bg-red-100 text-red-800',
  reservation: 'bg-orange-100 text-orange-800',
  annulation_resa: 'bg-yellow-100 text-yellow-800',
  retour: 'bg-teal-100 text-teal-800',
  ajustement: 'bg-slate-100 text-slate-800',
}

const mouvementIcons: Record<MouvementType, typeof ArrowDown> = {
  entree: ArrowDown,
  sortie: ArrowRight,
  reservation: MinusCircle,
  annulation_resa: RotateCcw,
  retour: RotateCcw,
  ajustement: AlertTriangle,
}

// ── Component ──────────────────────────────────────────────────

interface LotsViewProps {
  embedded?: boolean
}

export default function LotsView({ embedded = false }: LotsViewProps) {
  // List state
  const [lots, setLots] = useState<StockLot[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState<string>('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLot, setSelectedLot] = useState<StockLot | null>(null)

  // Create lot dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    productId: '',
    quantiteInitiale: '',
    dateFabrication: new Date().toISOString().split('T')[0],
    dateExpiration: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productSearch, setProductSearch] = useState('')

  // Create mouvement dialog
  const [mvtOpen, setMvtOpen] = useState(false)
  const [mvtForm, setMvtForm] = useState({
    type: 'sortie' as MouvementType,
    quantite: '',
    documentRef: '',
    notes: '',
  })
  const [mvtLotId, setMvtLotId] = useState<string | null>(null)
  const [submittingMvt, setSubmittingMvt] = useState(false)

  // ── Fetch lots ──
  const fetchLots = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (searchQuery) params.set('search', searchQuery)
      if (statutFilter !== 'all') params.set('statut', statutFilter)
      if (productFilter) params.set('productId', productFilter)

      const data = await api.get<{ lots: StockLot[]; total: number }>(
        `/lots?${params.toString()}`
      )
      setLots(data.lots || [])
      setTotal(data.total)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des lots')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statutFilter, productFilter])

  useEffect(() => {
    fetchLots()
  }, [fetchLots])

  // ── Fetch products for combobox ──
  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: ProductOption[] }>('/products?dropdown=true')
      setProducts(data.products || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    if (!q.trim()) return products
    return products.filter(p =>
      p.reference.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q)
    )
  }, [products, productSearch])

  // ── Summary calculations ──
  const summary = useMemo(() => {
    const actifs = lots.filter(l => l.statut === 'actif')
    const epuises = lots.filter(l => l.statut === 'epuise')
    return {
      totalActifs: actifs.length,
      totalEpuises: epuises.length,
      totalReserve: lots.reduce((s, l) => s + l.qtyReservee, 0),
      totalDisponible: lots.reduce((s, l) => s + l.qtyDisponible, 0),
    }
  }, [lots])

  // ── Open lot detail ──
  const openDetail = async (lot: StockLot) => {
    try {
      const data = await api.get<{ lots: StockLot[] }>(
        `/lots?id=${lot.id}&includeMouvements=true&limit=1`
      )
      const detailed = data.lots?.[0] || lot
      setSelectedLot(detailed)
      setDetailOpen(true)
    } catch {
      setSelectedLot(lot)
      setDetailOpen(true)
    }
  }

  // ── Create lot ──
  const handleCreateLot = async () => {
    if (!createForm.productId || !createForm.quantiteInitiale) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    try {
      setCreating(true)
      await api.post('/lots', {
        productId: createForm.productId,
        quantiteInitiale: parseFloat(createForm.quantiteInitiale),
        dateFabrication: createForm.dateFabrication
          ? new Date(createForm.dateFabrication).toISOString()
          : new Date().toISOString(),
        dateExpiration: createForm.dateExpiration
          ? new Date(createForm.dateExpiration).toISOString()
          : undefined,
        notes: createForm.notes || undefined,
      })
      toast.success('Lot de stock créé')
      setCreateOpen(false)
      setCreateForm({
        productId: '',
        quantiteInitiale: '',
        dateFabrication: new Date().toISOString().split('T')[0],
        dateExpiration: '',
        notes: '',
      })
      fetchLots()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du lot')
    } finally {
      setCreating(false)
    }
  }

  // ── Open create mouvement dialog ──
  const openMvtDialog = (lot: StockLot, defaultType: MouvementType) => {
    setMvtLotId(lot.id)
    setSelectedLot(lot)
    setMvtForm({ type: defaultType, quantite: '', documentRef: '', notes: '' })
    setMvtOpen(true)
  }

  // ── Create mouvement ──
  const handleCreateMvt = async () => {
    if (!mvtLotId || !mvtForm.quantite) {
      toast.error('Veuillez indiquer une quantité')
      return
    }
    try {
      setSubmittingMvt(true)
      await api.post('/lots', {
        lotId: mvtLotId,
        type: mvtForm.type,
        quantite: parseFloat(mvtForm.quantite),
        documentRef: mvtForm.documentRef || undefined,
        notes: mvtForm.notes || undefined,
      })
      toast.success(`${mouvementLabels[mvtForm.type]} enregistré(e)`)
      setMvtOpen(false)
      fetchLots()
      // Refresh detail if open
      if (detailOpen && selectedLot?.id === mvtLotId) {
        const data = await api.get<{ lots: StockLot[] }>(
          `/lots?id=${mvtLotId}&includeMouvements=true&limit=1`
        )
        if (data.lots?.[0]) setSelectedLot(data.lots[0])
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement du mouvement')
    } finally {
      setSubmittingMvt(false)
    }
  }

  // ── Toggle block/unblock ──
  const handleToggleBlock = async (lot: StockLot) => {
    try {
      const newStatut = lot.statut === 'bloque' ? 'actif' : 'bloque'
      await api.put('/lots', { id: lot.id, action: 'update_status', statut: newStatut })
      toast.success(newStatut === 'bloque' ? 'Lot bloqué' : 'Lot débloqué')
      fetchLots()
      if (detailOpen && selectedLot?.id === lot.id) {
        setSelectedLot({ ...selectedLot, statut: newStatut })
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    }
  }

  // ── Helpers ──
  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
  }

  const formatDateTime = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
  }

  // ── Embedded mode: fetch lots for specific workOrderId ──
  // When embedded, the parent passes workOrderId via a fetch
  const [embeddedWorkOrderId, setEmbeddedWorkOrderId] = useState<string | null>(null)

  // ── Render ──

  if (embedded) {
    // Minimal embedded view — the parent handles fetching and passing data
    return null
  }

  // Loading skeleton
  if (loading && lots.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Gestion des lots de stock</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLots} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau lot
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold">{summary.totalActifs}</p>
            <p className="text-xs text-muted-foreground">Lots actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-gray-500" />
            <p className="text-2xl font-bold">{summary.totalEpuises}</p>
            <p className="text-xs text-muted-foreground">Lots épuisés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MinusCircle className="h-5 w-5 mx-auto mb-1 text-orange-600" />
            <p className="text-2xl font-bold">{summary.totalReserve.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-muted-foreground">Total réservé</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ArrowDown className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-2xl font-bold">{summary.totalDisponible.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-muted-foreground">Total disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par N° lot, produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(['actif', 'epuise', 'bloque', 'expire'] as LotStatut[]).map((s) => (
                  <SelectItem key={s} value={s}>{lotStatutLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Produit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.reference} - {p.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lots Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Lot</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="hidden lg:table-cell">OF source</TableHead>
                    <TableHead className="text-right">Qté initiale</TableHead>
                    <TableHead className="text-right">Qté dispo.</TableHead>
                    <TableHead className="text-right">Qté réservée</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Qté physique</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden xl:table-cell">Date fabr.</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Aucun lot de stock trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-mono font-medium text-sm">{lot.numeroLot}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div>
                              <span className="font-mono text-sm">{lot.product.reference}</span>
                              <span className="ml-1 text-sm">{lot.product.designation}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-sm text-muted-foreground">
                          {lot.workOrder?.number || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {lot.quantiteInitiale.toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={lot.qtyDisponible > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {lot.qtyDisponible.toLocaleString('fr-FR')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className={lot.qtyReservee > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                            {lot.qtyReservee.toLocaleString('fr-FR')}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm">
                          {lot.qtyPhysique.toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={lotStatutColors[lot.statut]}>
                            {lotStatutLabels[lot.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {formatDate(lot.dateFabrication)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDetail(lot)}
                              title="Voir détails"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {lot.statut === 'actif' || lot.statut === 'bloque' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8',
                                  lot.statut === 'bloque'
                                    ? 'text-green-600 hover:text-green-700'
                                    : 'text-red-500 hover:text-red-600'
                                )}
                                onClick={() => handleToggleBlock(lot)}
                                title={lot.statut === 'bloque' ? 'Débloquer' : 'Bloquer'}
                              >
                                {lot.statut === 'bloque' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              </Button>
                            ) : null}
                            {lot.statut === 'actif' && lot.qtyDisponible === lot.quantiteInitiale ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title="Supprimer le lot">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le lot {lot.numeroLot} ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible. Le stock de {lot.quantiteInitiale} {lot.product.unit} sera décrémenté.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={async () => {
                                      try {
                                        await api.delete(`/lots?id=${lot.id}`)
                                        toast.success('Lot supprimé')
                                        fetchLots()
                                      } catch (err: any) {
                                        toast.error(err.message || 'Erreur lors de la suppression')
                                      }
                                    }} className="bg-red-600 hover:bg-red-700">
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Lot Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {selectedLot?.numeroLot}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={selectedLot ? lotStatutColors[selectedLot.statut] : ''}>
                  {selectedLot ? lotStatutLabels[selectedLot.statut] : ''}
                </Badge>
                {selectedLot && (
                  <span className="text-sm text-muted-foreground">
                    {selectedLot.product.reference} - {selectedLot.product.designation}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedLot && (
            <div className="space-y-6">
              {/* Lot info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Qté initiale</p>
                  <p className="text-sm font-bold">{selectedLot.quantiteInitiale.toLocaleString('fr-FR')} {selectedLot.product.unit}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700 mb-1">Qté disponible</p>
                  <p className="text-sm font-bold text-green-700">{selectedLot.qtyDisponible.toLocaleString('fr-FR')}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-700 mb-1">Qté réservée</p>
                  <p className="text-sm font-bold text-orange-700">{selectedLot.qtyReservee.toLocaleString('fr-FR')}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Qté physique</p>
                  <p className="text-sm font-bold">{selectedLot.qtyPhysique.toLocaleString('fr-FR')}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-700 mb-1">Qté sortie</p>
                  <p className="text-sm font-bold text-red-700">{selectedLot.qtySortie.toLocaleString('fr-FR')}</p>
                </div>
                <div className="p-3 bg-teal-50 rounded-lg">
                  <p className="text-xs text-teal-700 mb-1">Qté retour</p>
                  <p className="text-sm font-bold text-teal-700">{selectedLot.qtyRetour.toLocaleString('fr-FR')}</p>
                </div>
              </div>

              {/* Dates and metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Date de fabrication</p>
                  <p className="text-sm font-medium">{formatDate(selectedLot.dateFabrication)}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Date d&apos;expiration</p>
                  <p className="text-sm font-medium">
                    {selectedLot.dateExpiration ? (
                      <span className={
                        new Date(selectedLot.dateExpiration) < new Date()
                          ? 'text-red-600'
                          : ''
                      }>
                        {formatDate(selectedLot.dateExpiration)}
                      </span>
                    ) : '-'}
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">OF source</p>
                  <p className="text-sm font-mono font-medium">{selectedLot.workOrder?.number || '-'}</p>
                </div>
              </div>

              {selectedLot.notes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedLot.notes}</p>
                </div>
              )}

              {/* Action buttons */}
              {selectedLot.statut === 'actif' && selectedLot.qtyDisponible > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => openMvtDialog(selectedLot, 'sortie')}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Sortie
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    onClick={() => openMvtDialog(selectedLot, 'reservation')}
                  >
                    <MinusCircle className="h-4 w-4 mr-1" />
                    Réservation
                  </Button>
                  {selectedLot.qtyReservee > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      onClick={() => openMvtDialog(selectedLot, 'annulation_resa')}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Annuler réservation
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-teal-300 text-teal-700 hover:bg-teal-50"
                    onClick={() => openMvtDialog(selectedLot, 'retour')}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Retour
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={() => openMvtDialog(selectedLot, 'ajustement')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Ajustement
                  </Button>
                </div>
              )}

              {/* Mouvements table */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                  Historique des mouvements
                </h3>
                {selectedLot.mouvements && selectedLot.mouvements.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs text-right">Quantité</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs">Réf. document</TableHead>
                            <TableHead className="hidden md:table-cell text-xs">Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLot.mouvements.map((mvt) => {
                            const Icon = mouvementIcons[mvt.type] || ArrowRight
                            return (
                              <TableRow key={mvt.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateTime(mvt.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={cn('text-[10px]', mouvementColors[mvt.type])}>
                                    <Icon className="h-3 w-3 mr-1" />
                                    {mouvementLabels[mvt.type]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium">
                                  {mvt.quantite.toLocaleString('fr-FR')}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                  {mvt.documentRef || '-'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                                  {mvt.notes || '-'}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun mouvement enregistré.
                  </p>
                )}
              </div>

              {/* Block/Unblock button */}
              <div className="flex gap-2 pt-2 border-t">
                {(selectedLot.statut === 'actif' || selectedLot.statut === 'bloque') && (
                  <Button
                    variant="outline"
                    className={
                      selectedLot.statut === 'bloque'
                        ? 'border-green-300 text-green-700 hover:bg-green-50'
                        : 'border-red-300 text-red-700 hover:bg-red-50'
                    }
                    onClick={() => handleToggleBlock(selectedLot)}
                  >
                    {selectedLot.statut === 'bloque' ? (
                      <>
                        <Unlock className="h-4 w-4 mr-1" />
                        Débloquer le lot
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-1" />
                        Bloquer le lot
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Lot Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Nouveau lot de stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produit *</Label>
              <ProductCombobox
                products={filteredProducts}
                value={createForm.productId}
                searchValue={productSearch}
                onSearchChange={setProductSearch}
                onSelect={(v) => setCreateForm({ ...createForm, productId: v })}
                placeholder="Rechercher un produit..."
              />
            </div>
            <div className="space-y-2">
              <Label>Quantité initiale *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={createForm.quantiteInitiale}
                onChange={(e) => setCreateForm({ ...createForm, quantiteInitiale: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de fabrication</Label>
                <Input
                  type="date"
                  value={createForm.dateFabrication}
                  onChange={(e) => setCreateForm({ ...createForm, dateFabrication: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;expiration</Label>
                <Input
                  type="date"
                  value={createForm.dateExpiration}
                  onChange={(e) => setCreateForm({ ...createForm, dateExpiration: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateLot} disabled={!createForm.productId || !createForm.quantiteInitiale || creating}>
              {creating ? 'Création...' : 'Créer le lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Mouvement Dialog ── */}
      <Dialog open={mvtOpen} onOpenChange={setMvtOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mvtForm.type === 'sortie' && <ArrowRight className="h-5 w-5 text-red-600" />}
              {mvtForm.type === 'reservation' && <MinusCircle className="h-5 w-5 text-orange-600" />}
              {mvtForm.type === 'annulation_resa' && <RotateCcw className="h-5 w-5 text-yellow-600" />}
              {mvtForm.type === 'retour' && <RotateCcw className="h-5 w-5 text-teal-600" />}
              {mvtForm.type === 'ajustement' && <AlertTriangle className="h-5 w-5 text-slate-600" />}
              {mvtForm.type === 'annulation_resa' ? 'Annuler réservation' : 'Nouveau mouvement'}
            </DialogTitle>
          </DialogHeader>
          {selectedLot && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">Lot</p>
                <p className="font-mono text-sm font-medium">{selectedLot.numeroLot}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Disponible : <span className="text-green-600 font-medium">{selectedLot.qtyDisponible.toLocaleString('fr-FR')}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Type de mouvement *</Label>
                <Select value={mvtForm.type} onValueChange={(v) => setMvtForm({ ...mvtForm, type: v as MouvementType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sortie">{mouvementLabels.sortie}</SelectItem>
                    <SelectItem value="reservation">{mouvementLabels.reservation}</SelectItem>
                    <SelectItem value="annulation_resa">{mouvementLabels.annulation_resa}</SelectItem>
                    <SelectItem value="retour">{mouvementLabels.retour}</SelectItem>
                    <SelectItem value="ajustement">{mouvementLabels.ajustement}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantité *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={mvtForm.quantite}
                  onChange={(e) => setMvtForm({ ...mvtForm, quantite: e.target.value })}
                  placeholder="0"
                />
                {['sortie', 'reservation'].includes(mvtForm.type) && mvtForm.quantite && (
                  parseFloat(mvtForm.quantite) > selectedLot.qtyDisponible && (
                    <p className="text-xs text-red-600">
                      Quantité supérieure au disponible ({selectedLot.qtyDisponible.toLocaleString('fr-FR')})
                    </p>
                  )
                )}
                {mvtForm.type === 'annulation_resa' && mvtForm.quantite && (
                  parseFloat(mvtForm.quantite) > selectedLot.qtyReservee && (
                    <p className="text-xs text-red-600">
                      Quantité supérieure au réservé ({selectedLot.qtyReservee.toLocaleString('fr-FR')})
                    </p>
                  )
                )}
              </div>
              <div className="space-y-2">
                <Label>Référence document</Label>
                <Input
                  value={mvtForm.documentRef}
                  onChange={(e) => setMvtForm({ ...mvtForm, documentRef: e.target.value })}
                  placeholder="BC-2024-001, BL-..., ..."
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={mvtForm.notes}
                  onChange={(e) => setMvtForm({ ...mvtForm, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMvtOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreateMvt}
              disabled={!mvtForm.quantite || submittingMvt || (
                ['sortie', 'reservation'].includes(mvtForm.type) &&
                parseFloat(mvtForm.quantite || '0') > (selectedLot?.qtyDisponible || 0)
              ) || (
                mvtForm.type === 'annulation_resa' &&
                parseFloat(mvtForm.quantite || '0') > (selectedLot?.qtyReservee || 0)
              )}
            >
              {submittingMvt ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                `Enregistrer ${mouvementLabels[mvtForm.type].toLowerCase()}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Export constants for reuse in work-orders-view ──
export { lotStatutLabels, lotStatutColors }
