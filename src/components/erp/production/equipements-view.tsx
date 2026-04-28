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
import { Separator } from '@/components/ui/separator'
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
  Wrench, Plus, Eye, RefreshCw, Search, Pencil, Trash2, AlertTriangle,
  Settings, Factory, Clock, MapPin, Cpu, CheckCircle2, XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────

type EquipementType = 'extrudeuse' | 'moule' | 'compresseur' | 'four' | 'decoupeuse' | 'emballage' | 'pompe' | 'moteur' | 'climatisation' | 'convoyeur' | 'generateur' | 'autre'
type EquipementStatut = 'en_service' | 'en_panne' | 'en_maintenance' | 'hors_service' | 'en_reserve'
type EquipementCriticite = 'haute' | 'moyenne' | 'basse'

interface Equipement {
  id: string
  code: string
  designation: string
  type: EquipementType
  marque: string | null
  modele: string | null
  numeroSerie: string | null
  dateInstallation: string | null
  emplacement: string | null
  statut: EquipementStatut
  criticite: EquipementCriticite
  ficheTechnique: string | null
  imageBase64: string | null
  imageContentType: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  _count: { plans: number; ordres: number }
  prochaineMaintenance: string | null
  alerteMaintenance: boolean
}

interface PlanMaintenance {
  id: string
  type: string
  frequence: number
  description: string
  actif: boolean
  derniereExecution: string | null
  prochaineExecution: string | null
}

interface OrdreTravail {
  id: string
  numero: string
  typeMaintenance: string
  priorite: string
  statut: string
  datePlanifiee: string | null
  description: string
  dateDebut: string | null
  dateFin: string | null
  createdAt: string
}

// ─── Config Maps ──────────────────────────────────────────────────────────

const typeLabels: Record<EquipementType, string> = {
  extrudeuse: 'Extrudeuse',
  moule: 'Moule',
  compresseur: 'Compresseur',
  four: 'Four',
  decoupeuse: 'Découpeuse',
  emballage: 'Emballage',
  pompe: 'Pompe',
  moteur: 'Moteur',
  climatisation: 'Climatisation',
  convoyeur: 'Convoyeur',
  generateur: 'Générateur',
  autre: 'Autre',
}

const statutLabels: Record<EquipementStatut, string> = {
  en_service: 'En service',
  en_panne: 'En panne',
  en_maintenance: 'En maintenance',
  hors_service: 'Hors service',
  en_reserve: 'En réserve',
}

const statutColors: Record<EquipementStatut, string> = {
  en_service: 'bg-green-100 text-green-800 border-green-200',
  en_panne: 'bg-red-100 text-red-800 border-red-200',
  en_maintenance: 'bg-orange-100 text-orange-800 border-orange-200',
  hors_service: 'bg-gray-100 text-gray-700 border-gray-200',
  en_reserve: 'bg-slate-100 text-slate-700 border-slate-200',
}

const criticiteLabels: Record<EquipementCriticite, string> = {
  haute: 'Haute',
  moyenne: 'Moyenne',
  basse: 'Basse',
}

const criticiteColors: Record<EquipementCriticite, string> = {
  haute: 'bg-red-100 text-red-800 border-red-200',
  moyenne: 'bg-amber-100 text-amber-800 border-amber-200',
  basse: 'bg-green-100 text-green-800 border-green-200',
}

const typeIcons: Record<EquipementType, string> = {
  extrudeuse: '🏭',
  moule: '🔲',
  compresseur: '🔧',
  four: '🔥',
  decoupeuse: '✂️',
  emballage: '📦',
  pompe: '💧',
  moteur: '⚙️',
  climatisation: '❄️',
  convoyeur: '🔄',
  generateur: '⚡',
  autre: '🔧',
}

const emptyForm = {
  code: '',
  designation: '',
  type: 'autre' as EquipementType,
  marque: '',
  modele: '',
  numeroSerie: '',
  dateInstallation: '',
  emplacement: '',
  statut: 'en_service' as EquipementStatut,
  criticite: 'moyenne' as EquipementCriticite,
  notes: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtDate = (date: string | null) => {
  if (!date) return '-'
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

const daysUntil = (date: string | null): number | null => {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Component ────────────────────────────────────────────────────────────

export default function EquipementsView() {
  const [equipements, setEquipements] = useState<Equipement[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [criticiteFilter, setCriticiteFilter] = useState<string>('all')

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Equipement | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Equipement | null>(null)
  const [detailPlans, setDetailPlans] = useState<PlanMaintenance[]>([])
  const [detailOrdres, setDetailOrdres] = useState<OrdreTravail[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ─── Fetch ──────────────────────────────────────────────────────────

  const fetchEquipements = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statutFilter !== 'all') params.set('statut', statutFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (criticiteFilter !== 'all') params.set('criticite', criticiteFilter)
      params.set('limit', '50')

      const data = await api.get<{ equipements: Equipement[]; total: number }>(
        `/equipements?${params.toString()}`
      )
      setEquipements(data.equipements || [])
      setTotal(data.total)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement des équipements'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [search, statutFilter, typeFilter, criticiteFilter])

  useEffect(() => {
    fetchEquipements()
  }, [fetchEquipements])

  // ─── Summary counts ─────────────────────────────────────────────────

  const summaryCounts = useMemo(() => {
    const enService = equipements.filter((e) => e.statut === 'en_service').length
    const enPanne = equipements.filter((e) => e.statut === 'en_panne').length
    const maintenanceProche = equipements.filter(
      (e) => e.alerteMaintenance && e.prochaineMaintenance
    ).length
    return { total: total, enService, enPanne, maintenanceProche }
  }, [equipements, total])

  // ─── Debounced search ───────────────────────────────────────────────

  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ─── Create / Edit ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (eq: Equipement) => {
    setEditing(eq)
    setForm({
      code: eq.code,
      designation: eq.designation,
      type: eq.type,
      marque: eq.marque || '',
      modele: eq.modele || '',
      numeroSerie: eq.numeroSerie || '',
      dateInstallation: eq.dateInstallation ? eq.dateInstallation.split('T')[0] : '',
      emplacement: eq.emplacement || '',
      statut: eq.statut,
      criticite: eq.criticite,
      notes: eq.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.designation.trim()) {
      toast.error('Le code et la désignation sont requis')
      return
    }
    try {
      setSaving(true)
      const body = {
        code: form.code.trim(),
        designation: form.designation.trim(),
        type: form.type,
        marque: form.marque || undefined,
        modele: form.modele || undefined,
        numeroSerie: form.numeroSerie || undefined,
        dateInstallation: form.dateInstallation ? new Date(form.dateInstallation).toISOString() : undefined,
        emplacement: form.emplacement || undefined,
        statut: form.statut,
        criticite: form.criticite,
        notes: form.notes || undefined,
      }

      if (editing) {
        await api.put('/equipements', { id: editing.id, ...body })
        toast.success('Équipement modifié avec succès')
      } else {
        await api.post('/equipements', body)
        toast.success('Équipement créé avec succès')
      }
      setDialogOpen(false)
      fetchEquipements()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/equipements?id=${id}`)
      toast.success('Équipement supprimé avec succès')
      fetchEquipements()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      toast.error(message)
    }
  }

  // ─── Detail ─────────────────────────────────────────────────────────

  const openDetail = async (eq: Equipement) => {
    setSelected(eq)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailPlans([])
    setDetailOrdres([])

    try {
      const [plansData, ordresData] = await Promise.all([
        api.get<{ plans: PlanMaintenance[] }>(`/maintenance?mode=plans&equipementId=${eq.id}`),
        api.get<{ ordres: OrdreTravail[] }>(`/maintenance?equipementId=${eq.id}&limit=10`),
      ])
      setDetailPlans(plansData.plans || [])
      setDetailOrdres(ordresData.ordres || [])
    } catch {
      // silently fail — detail panels will show empty
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── OTM statut labels/colors for detail ────────────────────────────

  const otmStatutLabels: Record<string, string> = {
    planifiee: 'Planifiée',
    en_cours: 'En cours',
    en_attente_pieces: 'Attente pièces',
    terminee: 'Terminée',
    validee: 'Validée',
    annulee: 'Annulée',
  }

  const otmStatutColors: Record<string, string> = {
    planifiee: 'bg-sky-100 text-sky-800 border-sky-200',
    en_cours: 'bg-blue-100 text-blue-800 border-blue-200',
    en_attente_pieces: 'bg-orange-100 text-orange-800 border-orange-200',
    terminee: 'bg-green-100 text-green-800 border-green-200',
    validee: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    annulee: 'bg-gray-100 text-gray-600 border-gray-200',
  }

  const otmPrioriteLabels: Record<string, string> = {
    urgente: 'Urgente',
    haute: 'Haute',
    normale: 'Normale',
    basse: 'Basse',
  }

  const otmPrioriteColors: Record<string, string> = {
    urgente: 'bg-red-100 text-red-800 border-red-200',
    haute: 'bg-orange-100 text-orange-800 border-orange-200',
    normale: 'bg-slate-100 text-slate-700 border-slate-200',
    basse: 'bg-green-100 text-green-800 border-green-200',
  }

  // ─── Loading skeleton ──────────────────────────────────────────────

  if (loading && equipements.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
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

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Équipements</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEquipements} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Actualiser
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvel équipement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Factory className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{summaryCounts.total}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs">
              Total équipements
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold text-green-700">{summaryCounts.enService}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-200">
              En service
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold text-red-700">{summaryCounts.enPanne}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-red-100 text-red-800 border-red-200">
              En panne
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-5 w-5 text-orange-600" />
              <p className="text-2xl font-bold text-orange-700">{summaryCounts.maintenanceProche}</p>
            </div>
            <Badge variant="outline" className="mt-1 text-xs bg-orange-100 text-orange-800 border-orange-200">
              Maint. ≤ 7j
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Code, désignation, marque..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statutFilter} onValueChange={(v) => setStatutFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(Object.keys(statutLabels) as EquipementStatut[]).map((s) => (
                  <SelectItem key={s} value={s}>{statutLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {(Object.keys(typeLabels) as EquipementType[]).map((t) => (
                  <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={criticiteFilter} onValueChange={(v) => setCriticiteFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Criticité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {(Object.keys(criticiteLabels) as EquipementCriticite[]).map((c) => (
                  <SelectItem key={c} value={c}>{criticiteLabels[c]}</SelectItem>
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
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Emplacement</TableHead>
                    <TableHead className="hidden sm:table-cell">Criticité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Proch. maint.</TableHead>
                    <TableHead className="text-right w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {search || statutFilter !== 'all' || typeFilter !== 'all' || criticiteFilter !== 'all'
                          ? 'Aucun équipement trouvé.'
                          : 'Aucun équipement enregistré.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    equipements.map((eq) => {
                      const days = daysUntil(eq.prochaineMaintenance)
                      return (
                        <TableRow key={eq.id}>
                          <TableCell>
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                              {typeIcons[eq.type] || '🔧'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-medium text-sm">{eq.code}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{eq.designation}</p>
                              {eq.marque && (
                                <p className="text-xs text-muted-foreground">{eq.marque}{eq.modele ? ` ${eq.modele}` : ''}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="secondary" className="text-xs">
                              {typeLabels[eq.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {eq.emplacement ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {eq.emplacement}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className={criticiteColors[eq.criticite]}>
                              {criticiteLabels[eq.criticite]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statutColors[eq.statut]}>
                              {statutLabels[eq.statut]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {eq.prochaineMaintenance ? (
                              <span className="flex items-center gap-1 text-sm">
                                {eq.alerteMaintenance && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                )}
                                <span className={cn(
                                  eq.alerteMaintenance && 'text-orange-700 font-medium'
                                )}>
                                  {fmtDate(eq.prochaineMaintenance)}
                                </span>
                                {days !== null && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({days <= 0 ? 'Aujourd\'hui' : `dans ${days}j`})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openDetail(eq)}
                                title="Détails"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(eq)}
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    disabled={(eq._count?.plans ?? 0) > 0 || (eq._count?.ordres ?? 0) > 0}
                                    title={(eq._count?.plans ?? 0) > 0 || (eq._count?.ordres ?? 0) > 0 ? 'Suppression impossible (liens actifs)' : 'Supprimer'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer l&apos;équipement {eq.code}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Supprimer <strong>{eq.designation}</strong> ({eq.code}) ?
                                      {(eq._count?.plans ?? 0) > 0 && (
                                        <span className="block mt-2 text-orange-600 font-medium">
                                          ⚠ Cet équipement a {eq._count.plans} plan(s) de maintenance.
                                        </span>
                                      )}
                                      {(eq._count?.ordres ?? 0) > 0 && (
                                        <span className="block mt-1 text-orange-600 font-medium">
                                          ⚠ Cet équipement a {eq._count.ordres} ordre(s) de travail.
                                        </span>
                                      )}
                                      <span className="block mt-2">Cette action est irréversible.</span>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(eq.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Create / Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editing ? 'Modifier l\'équipement' : 'Nouvel équipement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Row 1: Code + Désignation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="EQ-0001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Désignation *</Label>
                <Input
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="Extrudeuse PVC 160mm"
                />
              </div>
            </div>

            {/* Row 2: Type + Marque + Modèle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: EquipementType) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeLabels) as EquipementType[]).map((t) => (
                      <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marque</Label>
                <Input
                  value={form.marque}
                  onChange={(e) => setForm({ ...form, marque: e.target.value })}
                  placeholder="Reifenhauser"
                />
              </div>
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Input
                  value={form.modele}
                  onChange={(e) => setForm({ ...form, modele: e.target.value })}
                  placeholder="RX-160"
                />
              </div>
            </div>

            {/* Row 3: N° Série + Date installation + Emplacement */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>N° de série</Label>
                <Input
                  value={form.numeroSerie}
                  onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
                  placeholder="SN-12345"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;installation</Label>
                <Input
                  type="date"
                  value={form.dateInstallation}
                  onChange={(e) => setForm({ ...form, dateInstallation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Emplacement</Label>
                <Input
                  value={form.emplacement}
                  onChange={(e) => setForm({ ...form, emplacement: e.target.value })}
                  placeholder="Atelier A"
                />
              </div>
            </div>

            {/* Row 4: Statut + Criticité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(v: EquipementStatut) => setForm({ ...form, statut: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statutLabels) as EquipementStatut[]).map((s) => (
                      <SelectItem key={s} value={s}>{statutLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Criticité</Label>
                <Select
                  value={form.criticite}
                  onValueChange={(v: EquipementCriticite) => setForm({ ...form, criticite: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(criticiteLabels) as EquipementCriticite[]).map((c) => (
                      <SelectItem key={c} value={c}>{criticiteLabels[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes additionnelles..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.code.trim() || !form.designation.trim() || saving}>
              {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
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
                <Settings className="h-5 w-5" />
                {selected?.code} — {selected?.designation}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={selected ? statutColors[selected.statut] : ''}>
                  {selected ? statutLabels[selected.statut] : ''}
                </Badge>
                <Badge variant="outline" className={selected ? criticiteColors[selected.criticite] : ''}>
                  {selected ? criticiteLabels[selected.criticite] : ''}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-6">
              {/* Equipment info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> Type
                  </p>
                  <p className="text-sm font-medium mt-1">{typeLabels[selected.type]}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Marque</p>
                  <p className="text-sm font-medium mt-1">{selected.marque || '-'}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Modèle</p>
                  <p className="text-sm font-medium mt-1">{selected.modele || '-'}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">N° Série</p>
                  <p className="text-sm font-medium mt-1 font-mono">{selected.numeroSerie || '-'}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Emplacement
                  </p>
                  <p className="text-sm font-medium mt-1">{selected.emplacement || '-'}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">Date installation</p>
                  <p className="text-sm font-medium mt-1">{fmtDate(selected.dateInstallation)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Plans maintenance
                  </p>
                  <p className="text-sm font-medium mt-1">{selected._count?.plans ?? 0}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Factory className="h-3 w-3" /> Ordres de travail
                  </p>
                  <p className="text-sm font-medium mt-1">{selected._count?.ordres ?? 0}</p>
                </div>
              </div>

              {/* Next maintenance alert */}
              {selected.prochaineMaintenance && (
                <div className={cn(
                  'flex items-center gap-3 p-3 rounded-md border',
                  selected.alerteMaintenance
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-muted'
                )}>
                  <Clock className={cn('h-5 w-5 shrink-0', selected.alerteMaintenance ? 'text-orange-600' : 'text-muted-foreground')} />
                  <div>
                    <p className="text-sm font-medium">
                      Prochaine maintenance : {fmtDate(selected.prochaineMaintenance)}
                    </p>
                    {selected.alerteMaintenance && (
                      <p className="text-xs text-orange-700 mt-0.5">
                        ⚠ Maintenance prévue dans moins de 7 jours
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selected.notes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              <Separator />

              {/* Plans de maintenance */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Plans de maintenance ({detailPlans.length})
                </h3>
                {detailLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : detailPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Aucun plan de maintenance pour cet équipement.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Fréquence</TableHead>
                          <TableHead>Dernière exéc.</TableHead>
                          <TableHead>Prochaine exéc.</TableHead>
                          <TableHead>Actif</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPlans.map((plan) => (
                          <TableRow key={plan.id}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {plan.type === 'temporel' ? 'Temporel' : 'Usage'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-48 truncate">{plan.description}</TableCell>
                            <TableCell className="text-sm">
                              {plan.type === 'temporel'
                                ? `${plan.frequence}j`
                                : `${plan.frequence}h`}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{fmtDate(plan.derniereExecution)}</TableCell>
                            <TableCell className="text-sm">
                              {plan.prochaineExecution ? (
                                <span className={cn(
                                  daysUntil(plan.prochaineMaintenance ?? plan.prochaineExecution) !== null &&
                                  daysUntil(plan.prochaineMaintenance ?? plan.prochaineExecution)! <= 7 &&
                                  'text-orange-700 font-medium'
                                )}>
                                  {fmtDate(plan.prochaineExecution)}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {plan.actif ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <Separator />

              {/* Ordres de travail récents */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                  Ordres de travail récents ({detailOrdres.length})
                </h3>
                {detailLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : detailOrdres.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Aucun ordre de travail pour cet équipement.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>N°</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priorité</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="hidden sm:table-cell">Date planifiée</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailOrdres.map((ord) => (
                          <TableRow key={ord.id}>
                            <TableCell className="font-mono text-sm font-medium">{ord.numero}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {ord.typeMaintenance === 'preventive' ? 'Préventive'
                                  : ord.typeMaintenance === 'corrective' ? 'Corrective'
                                  : ord.typeMaintenance === 'conditionnelle' ? 'Conditionnelle'
                                  : 'Améliorative'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs', otmPrioriteColors[ord.priorite] || '')}>
                                {otmPrioriteLabels[ord.priorite] || ord.priorite}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs', otmStatutColors[ord.statut] || '')}>
                                {otmStatutLabels[ord.statut] || ord.statut}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {fmtDate(ord.datePlanifiee)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
