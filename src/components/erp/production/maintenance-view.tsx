'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  Wrench, Plus, Eye, RefreshCw, Search, Play, CheckCircle, XCircle, Clock,
  AlertTriangle, Package, FileText, Loader2, Pause, RotateCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────

type OTMType = 'preventive' | 'corrective' | 'conditionnelle' | 'ameliorative'
type OTMPriorite = 'urgente' | 'haute' | 'normale' | 'basse'
type OTMStatut = 'planifiee' | 'en_cours' | 'terminee' | 'validee' | 'annulee' | 'en_attente_pieces'

interface Equipement {
  id: string
  code: string
  designation: string
  statut: string
  criticite: string
}

interface OTMPiece {
  id: string
  otmId: string
  productId: string
  quantiteNecessaire: number
  quantiteUtilisee: number
  coutUnitaire: number
  product: {
    id: string
    reference: string
    designation: string
    unit: string
  }
}

interface OTM {
  id: string
  numero: string
  equipementId: string
  equipement: Equipement
  planMaintenanceId: string | null
  planMaintenance: unknown | null
  typeMaintenance: OTMType
  priorite: OTMPriorite
  statut: OTMStatut
  datePlanifiee: string | null
  dateDebut: string | null
  dateFin: string | null
  description: string | null
  rapport: string | null
  responsableId: string | null
  coutPieces: number
  coutMainOeuvre: number
  machineArretee: boolean
  arretDebut: string | null
  arretFin: string | null
  productionPerdue: number
  notes: string | null
  createdAt: string
  pieces: OTMPiece[]
}

// ─── Config Maps ──────────────────────────────────────────────────────────

const typeLabels: Record<OTMType, string> = {
  preventive: 'Préventive',
  corrective: 'Corrective',
  conditionnelle: 'Conditionnelle',
  ameliorative: 'Améliorative',
}

const typeColors: Record<OTMType, string> = {
  preventive: 'bg-green-100 text-green-800 border-green-200',
  corrective: 'bg-red-100 text-red-800 border-red-200',
  conditionnelle: 'bg-amber-100 text-amber-800 border-amber-200',
  ameliorative: 'bg-purple-100 text-purple-800 border-purple-200',
}

const prioriteLabels: Record<OTMPriorite, string> = {
  urgente: 'Urgente',
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
}

const prioriteColors: Record<OTMPriorite, string> = {
  urgente: 'bg-red-100 text-red-800 border-red-200',
  haute: 'bg-orange-100 text-orange-800 border-orange-200',
  normale: 'bg-blue-100 text-blue-800 border-blue-200',
  basse: 'bg-gray-100 text-gray-600 border-gray-200',
}

const statutLabels: Record<OTMStatut, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  validee: 'Validée',
  annulee: 'Annulée',
  en_attente_pieces: 'Attente pièces',
}

const statutColors: Record<OTMStatut, string> = {
  planifiee: 'bg-slate-100 text-slate-800 border-slate-200',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
  terminee: 'bg-amber-100 text-amber-800 border-amber-200',
  validee: 'bg-green-100 text-green-800 border-green-200',
  annulee: 'bg-gray-100 text-gray-500 border-gray-200',
  en_attente_pieces: 'bg-orange-100 text-orange-800 border-orange-200',
}

const allStatuts: OTMStatut[] = ['planifiee', 'en_cours', 'terminee', 'validee', 'annulee', 'en_attente_pieces']
const allTypes: OTMType[] = ['preventive', 'corrective', 'conditionnelle', 'ameliorative']
const allPriorites: OTMPriorite[] = ['urgente', 'haute', 'normale', 'basse']

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

// ─── Component ────────────────────────────────────────────────────────────

export default function MaintenanceView() {
  // Data
  const [ordres, setOrdres] = useState<OTM[]>([])
  const [equipements, setEquipements] = useState<Equipement[]>([])
  const [products, setProducts] = useState<{ id: string; reference: string; designation: string; unit: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [prioriteFilter, setPrioriteFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    equipementId: '',
    typeMaintenance: 'corrective' as OTMType,
    priorite: 'normale' as OTMPriorite,
    datePlanifiee: '',
    description: '',
    responsableId: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<OTM | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Add piece dialog
  const [addPieceOpen, setAddPieceOpen] = useState(false)
  const [addPieceForm, setAddPieceForm] = useState({
    productId: '',
    quantiteNecessaire: '',
  })
  const [addPieceLoading, setAddPieceLoading] = useState(false)

  // Report editing
  const [reportForm, setReportForm] = useState({
    rapport: '',
    coutMainOeuvre: '',
    machineArretee: false,
    productionPerdue: '',
  })
  const [savingReport, setSavingReport] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // ─── Fetch ──────────────────────────────────────────────────────────

  const fetchOrdres = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('mode', 'ordres')
      params.set('page', page.toString())
      params.set('limit', '50')
      if (statutFilter !== 'all') params.set('statut', statutFilter)
      if (typeFilter !== 'all') params.set('typeMaintenance', typeFilter)
      if (prioriteFilter !== 'all') params.set('priorite', prioriteFilter)
      if (searchDebounced) params.set('search', searchDebounced)

      const data = await api.get<{ ordres: OTM[]; total: number; page: number; limit: number }>(
        `/maintenance?${params.toString()}`
      )
      setOrdres(data.ordres || [])
      setTotal(data.total)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement des OTM'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, statutFilter, typeFilter, prioriteFilter, searchDebounced])

  const fetchEquipements = useCallback(async () => {
    try {
      const data = await api.get<{ equipements: Equipement[] }>('/equipements?limit=200')
      setEquipements(data.equipements || [])
    } catch {
      // silent
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: { id: string; reference: string; designation: string; unit: string }[] }>('/products?limit=300')
      setProducts(data.products || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { fetchEquipements() }, [fetchEquipements])
  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchOrdres() }, [fetchOrdres])

  const totalPages = Math.ceil(total / 50)

  // ─── Computed ───────────────────────────────────────────────────────

  const now = useMemo(() => new Date(), [])

  const summaryCounts = useMemo(() => {
    const counts = {
      total: ordres.length,
      enCours: 0,
      planifies: 0,
      enRetard: 0,
    }
    ordres.forEach((o) => {
      if (o.statut === 'en_cours') counts.enCours++
      if (o.statut === 'planifiee') counts.planifies++
      if (o.statut === 'planifiee' && o.datePlanifiee && new Date(o.datePlanifiee) < now) {
        counts.enRetard++
      }
    })
    return counts
  }, [ordres, now])

  // ─── Helpers ───────────────────────────────────────────────────────

  const fmtDate = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
  }

  const fmtDateTime = (date: string | null) => {
    if (!date) return '-'
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
  }

  const isDeletable = (statut: OTMStatut) => statut === 'planifiee' || statut === 'annulee'

  // ─── Create OTM ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.equipementId || !createForm.description) {
      toast.error("Veuillez remplir l'équipement et la description")
      return
    }
    try {
      setCreating(true)
      await api.post('/maintenance', {
        mode: 'otm',
        equipementId: createForm.equipementId,
        typeMaintenance: createForm.typeMaintenance,
        priorite: createForm.priorite,
        datePlanifiee: createForm.datePlanifiee ? new Date(createForm.datePlanifiee).toISOString() : undefined,
        description: createForm.description,
        responsableId: createForm.responsableId || undefined,
        notes: createForm.notes || undefined,
      })
      toast.success('OTM créé avec succès')
      setCreateOpen(false)
      setCreateForm({
        equipementId: '',
        typeMaintenance: 'corrective',
        priorite: 'normale',
        datePlanifiee: '',
        description: '',
        responsableId: '',
        notes: '',
      })
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création"
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  // ─── Status Actions ────────────────────────────────────────────────

  const handleStatusTransition = async (otm: OTM, newStatut: OTMStatut) => {
    try {
      setActionLoading(true)
      await api.put('/maintenance', {
        mode: 'otm',
        id: otm.id,
        action: 'update_status',
        statut: newStatut,
      })
      const labels: Record<OTMStatut, string> = {
        planifiee: 'OTM planifiée',
        en_cours: 'OTM démarrée',
        terminee: 'OTM terminée',
        validee: 'OTM validée',
        annulee: 'OTM annulée',
        en_attente_pieces: 'OTM mise en attente de pièces',
      }
      toast.success(labels[newStatut])
      // Refresh detail
      const data = await api.get<{ ordres: OTM[]; total: number }>(
        `/maintenance?mode=ordres&limit=100&statut=${newStatut}`
      )
      const updated = data.ordres.find((o) => o.id === otm.id)
      if (updated) {
        setSelected(updated)
      } else if (selected?.id === otm.id) {
        setSelected({ ...selected, statut: newStatut })
      }
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du changement de statut'
      toast.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Pieces ────────────────────────────────────────────────────────

  const handleAddPiece = async () => {
    if (!selected || !addPieceForm.productId || !addPieceForm.quantiteNecessaire) {
      toast.error('Veuillez remplir la pièce et la quantité')
      return
    }
    try {
      setAddPieceLoading(true)
      await api.put('/maintenance', {
        mode: 'otm',
        id: selected.id,
        action: 'add_piece',
        productId: addPieceForm.productId,
        quantiteNecessaire: parseInt(addPieceForm.quantiteNecessaire, 10),
      })
      toast.success('Pièce ajoutée')
      setAddPieceOpen(false)
      setAddPieceForm({ productId: '', quantiteNecessaire: '' })
      // Refresh
      const data = await api.get<{ ordres: OTM[]; total: number }>(
        `/maintenance?mode=ordres&limit=100`
      )
      const updated = data.ordres.find((o) => o.id === selected.id)
      if (updated) setSelected(updated)
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'ajout de la pièce"
      toast.error(message)
    } finally {
      setAddPieceLoading(false)
    }
  }

  const handleMarkPieceUsed = async (piece: OTMPiece) => {
    if (!selected) return
    try {
      setActionLoading(true)
      await api.put('/maintenance', {
        mode: 'otm',
        id: selected.id,
        action: 'update_piece',
        pieceId: piece.id,
        quantiteUtilisee: piece.quantiteNecessaire,
      })
      toast.success('Pièce marquée comme utilisée')
      const data = await api.get<{ ordres: OTM[]; total: number }>(
        `/maintenance?mode=ordres&limit=100`
      )
      const updated = data.ordres.find((o) => o.id === selected.id)
      if (updated) setSelected(updated)
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Report ────────────────────────────────────────────────────────

  const openReportEdit = (otm: OTM) => {
    setReportForm({
      rapport: otm.rapport || '',
      coutMainOeuvre: otm.coutMainOeuvre ? String(otm.coutMainOeuvre) : '',
      machineArretee: otm.machineArretee,
      productionPerdue: otm.productionPerdue ? String(otm.productionPerdue) : '',
    })
  }

  const handleSaveReport = async () => {
    if (!selected) return
    try {
      setSavingReport(true)
      await api.put('/maintenance', {
        mode: 'otm',
        id: selected.id,
        action: 'update_report',
        rapport: reportForm.rapport || null,
        coutMainOeuvre: reportForm.coutMainOeuvre ? parseFloat(reportForm.coutMainOeuvre) : 0,
        machineArretee: reportForm.machineArretee,
        productionPerdue: reportForm.productionPerdue ? parseFloat(reportForm.productionPerdue) : 0,
      })
      toast.success('Rapport enregistré')
      const data = await api.get<{ ordres: OTM[]; total: number }>(
        `/maintenance?mode=ordres&limit=100`
      )
      const updated = data.ordres.find((o) => o.id === selected.id)
      if (updated) setSelected(updated)
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur'
      toast.error(message)
    } finally {
      setSavingReport(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/maintenance?id=${id}`)
      toast.success('OTM supprimé')
      if (detailOpen) setDetailOpen(false)
      fetchOrdres()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      toast.error(message)
    }
  }

  // ─── Open Detail ───────────────────────────────────────────────────

  const openDetail = (otm: OTM) => {
    setSelected(otm)
    setDetailOpen(true)
    openReportEdit(otm)
  }

  // ─── Action buttons per status ─────────────────────────────────────

  const getStatusActions = (otm: OTM) => {
    const actions: { label: string; icon: React.ReactNode; statut: OTMStatut; variant: string; color: string }[] = []

    switch (otm.statut) {
      case 'planifiee':
        actions.push(
          { label: 'Démarrer', icon: <Play className="h-4 w-4" />, statut: 'en_cours', variant: 'default', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
          { label: 'Annuler', icon: <XCircle className="h-4 w-4" />, statut: 'annulee', variant: 'destructive', color: 'bg-red-600 hover:bg-red-700 text-white' },
        )
        break
      case 'en_cours':
        actions.push(
          { label: 'Terminer', icon: <CheckCircle className="h-4 w-4" />, statut: 'terminee', variant: 'default', color: 'bg-amber-600 hover:bg-amber-700 text-white' },
          { label: 'Attente pièces', icon: <Pause className="h-4 w-4" />, statut: 'en_attente_pieces', variant: 'default', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
          { label: 'Annuler', icon: <XCircle className="h-4 w-4" />, statut: 'annulee', variant: 'destructive', color: 'bg-red-600 hover:bg-red-700 text-white' },
        )
        break
      case 'en_attente_pieces':
        actions.push(
          { label: 'Reprendre', icon: <RotateCcw className="h-4 w-4" />, statut: 'en_cours', variant: 'default', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
          { label: 'Annuler', icon: <XCircle className="h-4 w-4" />, statut: 'annulee', variant: 'destructive', color: 'bg-red-600 hover:bg-red-700 text-white' },
        )
        break
      case 'terminee':
        actions.push(
          { label: 'Valider', icon: <CheckCircle className="h-4 w-4" />, statut: 'validee', variant: 'default', color: 'bg-green-600 hover:bg-green-700 text-white' },
        )
        break
      default:
        break
    }
    return actions
  }

  // ─── Loading skeleton ──────────────────────────────────────────────

  if (loading && ordres.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
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
          <Wrench className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Maintenance (OTM)</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrdres} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle OTM
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{summaryCounts.total}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total OTM</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Play className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold text-blue-700">{summaryCounts.enCours}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-blue-100 text-blue-800 border-blue-200">
              En cours
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="h-5 w-5 text-slate-600" />
              <p className="text-2xl font-bold text-slate-700">{summaryCounts.planifies}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-slate-100 text-slate-800 border-slate-200">
              Planifiées
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold text-red-700">{summaryCounts.enRetard}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-red-100 text-red-800 border-red-200">
              En retard
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par N°, description, équipement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statutFilter} onValueChange={(v) => { setStatutFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {allStatuts.map((s) => (
                  <SelectItem key={s} value={s}>{statutLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {allTypes.map((t) => (
                  <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={prioriteFilter} onValueChange={(v) => { setPrioriteFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {allPriorites.map((p) => (
                  <SelectItem key={p} value={p}>{prioriteLabels[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° OTM</TableHead>
                    <TableHead>Équipement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Date planifiée</TableHead>
                    <TableHead className="hidden xl:table-cell">Date début</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordres.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucun ordre de travail de maintenance trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ordres.map((otm) => (
                      <TableRow key={otm.id}>
                        <TableCell className="font-mono font-medium">{otm.numero}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div>
                              <span className="font-mono text-sm">{otm.equipement?.code || '-'}</span>
                              <span className="ml-1 text-sm">{otm.equipement?.designation || '-'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeColors[otm.typeMaintenance]}>
                            {typeLabels[otm.typeMaintenance]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={prioriteColors[otm.priorite]}>
                            {prioriteLabels[otm.priorite]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statutColors[otm.statut]}>
                            {statutLabels[otm.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {otm.datePlanifiee && otm.statut === 'planifiee' && new Date(otm.datePlanifiee) < now ? (
                            <span className="text-red-600 font-medium">
                              {fmtDate(otm.datePlanifiee)}
                              <AlertTriangle className="inline h-3 w-3 ml-1" />
                            </span>
                          ) : (
                            fmtDate(otm.datePlanifiee)
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {fmtDateTime(otm.dateDebut)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(otm)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isDeletable(otm.statut) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer l&apos;OTM {otm.numero}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action est irréversible. Voulez-vous vraiment supprimer cet ordre de travail ?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(otm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {(page - 1) * 50 + 1} - {Math.min(page * 50, total)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Précédent
            </Button>
            <span className="text-sm font-medium">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Create OTM Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Nouvel ordre de travail maintenance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Équipement *</Label>
              <Select value={createForm.equipementId} onValueChange={(v) => setCreateForm({ ...createForm, equipementId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un équipement..." />
                </SelectTrigger>
                <SelectContent>
                  {equipements.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.code} - {eq.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de maintenance *</Label>
                <Select value={createForm.typeMaintenance} onValueChange={(v: OTMType) => setCreateForm({ ...createForm, typeMaintenance: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map((t) => (
                      <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité *</Label>
                <Select value={createForm.priorite} onValueChange={(v: OTMPriorite) => setCreateForm({ ...createForm, priorite: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allPriorites.map((p) => (
                      <SelectItem key={p} value={p}>{prioriteLabels[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date planifiée</Label>
              <Input
                type="date"
                value={createForm.datePlanifiee}
                onChange={(e) => setCreateForm({ ...createForm, datePlanifiee: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Décrire l'intervention de maintenance..."
                rows={3}
              />
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
            <Button onClick={handleCreate} disabled={!createForm.equipementId || !createForm.description || creating}>
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {creating ? 'Création...' : "Créer l'OTM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Detail Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                {selected?.numero}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={selected ? typeColors[selected.typeMaintenance] : ''}>
                  {selected ? typeLabels[selected.typeMaintenance] : ''}
                </Badge>
                <Badge variant="outline" className={selected ? prioriteColors[selected.priorite] : ''}>
                  {selected ? prioriteLabels[selected.priorite] : ''}
                </Badge>
                <Badge variant="outline" className={selected ? statutColors[selected.statut] : ''}>
                  {selected ? statutLabels[selected.statut] : ''}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-6">
              {/* Equipment & Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Équipement</p>
                  <p className="text-sm font-medium mt-1">
                    {selected.equipement?.code || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.equipement?.designation || '-'}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Date planifiée</p>
                  <p className={cn(
                    'text-sm font-medium mt-1',
                    selected.datePlanifiee && selected.statut === 'planifiee' && new Date(selected.datePlanifiee) < now
                      ? 'text-red-600'
                      : ''
                  )}>
                    {fmtDate(selected.datePlanifiee)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Date début</p>
                  <p className="text-sm font-medium mt-1">{fmtDateTime(selected.dateDebut)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Date fin</p>
                  <p className="text-sm font-medium mt-1">{fmtDateTime(selected.dateFin)}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">Description</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selected.description || '-'}</p>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">{selected.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {getStatusActions(selected).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground">Actions</Label>
                  <div className="flex flex-wrap gap-2">
                    {getStatusActions(selected).map((action) => (
                      <Button
                        key={action.statut}
                        size="sm"
                        className={cn(action.color)}
                        disabled={actionLoading}
                        onClick={() => handleStatusTransition(selected, action.statut)}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          action.icon
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Pieces Section ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Pièces détachées
                  </Label>
                  {['planifiee', 'en_cours', 'en_attente_pieces'].includes(selected.statut) && (
                    <Button variant="outline" size="sm" onClick={() => setAddPieceOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                {selected.pieces && selected.pieces.length > 0 ? (
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Réf.</TableHead>
                          <TableHead className="text-xs">Désignation</TableHead>
                          <TableHead className="text-xs text-right">Nécessaire</TableHead>
                          <TableHead className="text-xs text-right">Utilisée</TableHead>
                          <TableHead className="text-xs text-right">Coût unit.</TableHead>
                          <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.pieces.map((piece) => (
                          <TableRow key={piece.id}>
                            <TableCell className="font-mono text-xs">{piece.product?.reference || '-'}</TableCell>
                            <TableCell className="text-xs">{piece.product?.designation || '-'}</TableCell>
                            <TableCell className="text-xs text-right">{piece.quantiteNecessaire} {piece.product?.unit || ''}</TableCell>
                            <TableCell className="text-xs text-right">
                              <span className={piece.quantiteUtilisee > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                {piece.quantiteUtilisee}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-right">{formatCurrency(piece.coutUnitaire)}</TableCell>
                            <TableCell className="text-right">
                              {piece.quantiteUtilisee === 0 && ['en_cours', 'en_attente_pieces', 'terminee'].includes(selected.statut) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-green-600 hover:text-green-700"
                                  onClick={() => handleMarkPieceUsed(piece)}
                                  disabled={actionLoading}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Utilisée
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune pièce ajoutée.</p>
                )}

                {/* Totals */}
                {selected.pieces && selected.pieces.length > 0 && (
                  <div className="flex justify-end gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Coût pièces: <span className="font-medium text-foreground">{formatCurrency(selected.coutPieces)}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* ─── Report Section ─── */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Rapport d&apos;intervention
                </Label>

                {selected.statut === 'terminee' || selected.statut === 'validee' ? (
                  <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                    <div className="space-y-2">
                      <Label className="text-xs">Rapport</Label>
                      <Textarea
                        value={reportForm.rapport}
                        onChange={(e) => setReportForm({ ...reportForm, rapport: e.target.value })}
                        placeholder="Décrire les travaux effectués..."
                        rows={4}
                        disabled={selected.statut === 'validee'}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Coût main d&apos;œuvre (MAD)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={reportForm.coutMainOeuvre}
                          onChange={(e) => setReportForm({ ...reportForm, coutMainOeuvre: e.target.value })}
                          disabled={selected.statut === 'validee'}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Checkbox
                          checked={reportForm.machineArretee}
                          onCheckedChange={(checked) => setReportForm({ ...reportForm, machineArreete: !!checked })}
                          disabled={selected.statut === 'validee'}
                          id="machine-arretee"
                        />
                        <Label htmlFor="machine-arretee" className="text-sm">Machine arrêtée</Label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Production perdue (unités)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={reportForm.productionPerdue}
                          onChange={(e) => setReportForm({ ...reportForm, productionPerdue: e.target.value })}
                          disabled={selected.statut === 'validee'}
                        />
                      </div>
                    </div>

                    {selected.statut === 'terminee' && (
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveReport} disabled={savingReport}>
                          {savingReport && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                          <FileText className="h-4 w-4 mr-1" />
                          {savingReport ? 'Enregistrement...' : 'Enregistrer le rapport'}
                        </Button>
                      </div>
                    )}

                    {/* Cost summary */}
                    <div className="flex justify-end gap-6 text-sm pt-2 border-t">
                      <span className="text-muted-foreground">
                        Main d&apos;œuvre: <span className="font-medium text-foreground">{formatCurrency(selected.coutMainOeuvre)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Pièces: <span className="font-medium text-foreground">{formatCurrency(selected.coutPieces)}</span>
                      </span>
                      <span className="font-semibold">
                        Total: {formatCurrency(selected.coutMainOeuvre + selected.coutPieces)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border rounded-md bg-muted/20 text-center">
                    <p className="text-sm text-muted-foreground">
                      {selected.statut === 'planifiee'
                        ? "Le rapport sera disponible une fois l'OTM terminée."
                        : selected.statut === 'en_cours' || selected.statut === 'en_attente_pieces'
                          ? "Le rapport pourra être rempli une fois l'intervention terminée."
                          : "Aucun rapport disponible."
                      }
                    </p>
                  </div>
                )}

                {/* Machine downtime info */}
                {selected.machineArretee && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Machine arrêtée — {fmtDateTime(selected.arretDebut)}
                    {selected.arretFin ? ` → ${fmtDateTime(selected.arretFin)}` : ' (en cours)'}
                    {selected.productionPerdue > 0 && ` — ${selected.productionPerdue.toLocaleString('fr-FR')} unités perdues`}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Add Piece Dialog ═══ */}
      <Dialog open={addPieceOpen} onOpenChange={setAddPieceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Ajouter une pièce
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Pièce *</Label>
              <Select value={addPieceForm.productId} onValueChange={(v) => setAddPieceForm({ ...addPieceForm, productId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une pièce..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.reference} - {p.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantité nécessaire *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={addPieceForm.quantiteNecessaire}
                onChange={(e) => setAddPieceForm({ ...addPieceForm, quantiteNecessaire: e.target.value })}
                placeholder="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPieceOpen(false)}>Annuler</Button>
            <Button onClick={handleAddPiece} disabled={!addPieceForm.productId || !addPieceForm.quantiteNecessaire || addPieceLoading}>
              {addPieceLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {addPieceLoading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
