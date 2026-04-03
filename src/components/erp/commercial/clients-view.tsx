'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription
} from '@/components/ui/form'
import {
  Users, Plus, Search, Edit, Trash2, ArrowLeft, ArrowUpDown,
  Building2, Phone, Mail, MapPin, Calendar, TrendingUp,
  ChevronLeft, ChevronRight, RefreshCw, Eye, Minus, GripVertical,
  AlertTriangle, FileText, Receipt, ShoppingCart, UserPlus, UserMinus,
  FileSpreadsheet, Download, Upload, CheckCircle2, XCircle, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

import {
  clientFormSchema,
  defaultClientFormValues,
  clientStatusOptions,
  categorieOptions,
  formeJuridiqueOptions,
  langueOptions,
  contactTypeOptions,
  modeReglementOptions,
  conditionsPaiementOptions,
  incotermOptions,
  tauxTVAOptions,
  modeFacturationOptions,
  regimeFiscalOptions,
  relanceTypeOptions,
  frequenceReportingOptions,
  origineProspectOptions,
  type ClientFormData,
  type ContactFormData,
} from '@/lib/validations/client'

// ───────────────────── Types ─────────────────────
interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  creditLimit: number | null
  paymentTerms: string | null
  notes: string | null
  balance: number
  createdAt: string
  updatedAt: string
}

type SubView = 'list' | 'create' | 'edit' | 'detail'

// ───────────────────── Helpers ─────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n)

const statusColorMap: Record<string, string> = {
  actif: 'bg-green-100 text-green-800 border-green-200',
  inactif: 'bg-gray-100 text-gray-700 border-gray-200',
  prospect: 'bg-blue-100 text-blue-800 border-blue-200',
  client_risque: 'bg-red-100 text-red-800 border-red-200',
  client_privilegie: 'bg-purple-100 text-purple-800 border-purple-200',
}

const statusLabelMap: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  prospect: 'Prospect',
  client_risque: 'Client à risque',
  client_privilegie: 'Client privilégié',
}

const itemsPerPage = 10

// ───────────────────── Loading Skeleton ─────────────────────
function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-10" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4">
            {Array.from({ length: itemsPerPage }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-20 ml-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

// ───────────────────── Status Badge ─────────────────────
function StatusBadge({ status }: { status: string }) {
  const color = statusColorMap[status] || 'bg-gray-100 text-gray-700'
  const label = statusLabelMap[status] || status
  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

// ───────────────────── Info Row (read-only display) ─────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  CLIENTS VIEW (Main Component)
// ═══════════════════════════════════════════════════════════════
export default function ClientsView() {
  const [subView, setSubView] = useState<SubView>('list')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categorieFilter, setCategorieFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)

  // ─── Fetch Clients ───
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(itemsPerPage),
      })
      if (search) params.set('search', search)
      const res = await api.get<{ clients: Client[]; total: number }>(`/clients?${params}`)
      setClients(res.clients || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Erreur chargement clients:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des clients.' })
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    if (subView === 'list') {
      fetchClients()
    }
  }, [subView, fetchClients])

  // ─── Filtered + sorted (client-side for status/categorie filters) ───
  const filteredClients = useMemo(() => {
    let result = [...clients]
    if (statusFilter) {
      // Backend doesn't support status filter, but we keep UI ready
      // result = result.filter(c => c.statut === statusFilter)
    }
    if (categorieFilter) {
      // result = result.filter(c => c.categorie === categorieFilter)
    }
    result.sort((a, b) => {
      const aVal = String(a[sortField as keyof Client] ?? '')
      const bVal = String(b[sortField as keyof Client] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    return result
  }, [clients, statusFilter, categorieFilter, sortField, sortDir])

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  // ─── Navigation helpers ───
  const goToCreate = () => {
    setSelectedClient(null)
    setSubView('create')
  }

  const goToEdit = (client: Client) => {
    setSelectedClient(client)
    setSubView('edit')
  }

  const goToDetail = (client: Client) => {
    setSelectedClient(client)
    setSubView('detail')
  }

  const goBackToList = () => {
    setSubView('list')
    setSelectedClient(null)
  }

  // ─── Delete ───
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clients?id=${id}`)
      toast.success('Client supprimé', { description: 'Le client a été supprimé avec succès.' })
      fetchClients()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression'
      toast.error('Erreur de suppression', { description: msg })
    }
  }

  // ─── Render ───
  if (loading && subView === 'list') {
    return <ListSkeleton />
  }

  switch (subView) {
    case 'create':
      return <ClientFormView mode="create" onBack={goBackToList} onSaved={fetchClients} />
    case 'edit':
      return selectedClient ? (
        <ClientFormView mode="edit" client={selectedClient} onBack={goBackToList} onSaved={fetchClients} />
      ) : null
    case 'detail':
      return selectedClient ? (
        <ClientDetailView client={selectedClient} onBack={goBackToList} onEdit={() => goToEdit(selectedClient)} onDelete={handleDelete} />
      ) : null
    default:
      return (
        <ClientListView
          clients={filteredClients}
          total={total}
          page={page}
          totalPages={totalPages}
          loading={loading}
          search={search}
          statusFilter={statusFilter}
          categorieFilter={categorieFilter}
          sortField={sortField}
          sortDir={sortDir}
          onSearch={setSearch}
          onStatusFilter={setStatusFilter}
          onCategorieFilter={setCategorieFilter}
          onSort={toggleSort}
          onPage={setPage}
          onCreate={goToCreate}
          onEdit={goToEdit}
          onDetail={goToDetail}
          onDelete={handleDelete}
          onRefresh={fetchClients}
        />
      )
  }
}

// ═══════════════════════════════════════════════════════════════
//  LIST VIEW
// ═══════════════════════════════════════════════════════════════
interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; reason: string }>
}

interface ClientListViewProps {
  clients: Client[]
  total: number
  page: number
  totalPages: number
  loading: boolean
  search: string
  statusFilter: string | null
  categorieFilter: string | null
  sortField: string
  sortDir: 'asc' | 'desc'
  onSearch: (v: string) => void
  onStatusFilter: (v: string | null) => void
  onCategorieFilter: (v: string | null) => void
  onSort: (field: string) => void
  onPage: (p: number) => void
  onCreate: () => void
  onEdit: (c: Client) => void
  onDetail: (c: Client) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

function ClientListView({
  clients, total, page, totalPages, loading, search,
  statusFilter, categorieFilter, sortField, sortDir,
  onSearch, onStatusFilter, onCategorieFilter, onSort, onPage,
  onCreate, onEdit, onDetail, onDelete, onRefresh,
}: ClientListViewProps) {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // ─── Import state ───
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async () => {
    try {
      const { token } = useAuthStore.getState()
      const res = await fetch('/api/clients/import', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur de téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'clients-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Modèle téléchargé', { description: 'Le fichier clients-template.xlsx a été téléchargé.' })
    } catch (err) {
      toast.error('Erreur', { description: 'Impossible de télécharger le modèle.' })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportResult(null)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    try {
      setImporting(true)
      setImportProgress(10)
      setImportResult(null)

      const { token } = useAuthStore.getState()
      const formData = new FormData()
      formData.append('file', importFile)

      setImportProgress(30)

      const res = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      setImportProgress(80)

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur serveur' }))
        throw new Error(data.error || 'Erreur serveur')
      }

      const result: ImportResult = await res.json()
      setImportProgress(100)
      setImportResult(result)

      if (result.imported > 0) {
        toast.success(`${result.imported} client(s) importé(s)`, {
          description: result.skipped > 0 ? `${result.skipped} ligne(s) ignorée(s)` : undefined,
        })
      }

      // Refresh the list
      onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'import"
      toast.error("Erreur d'import", { description: msg })
    } finally {
      setImporting(false)
    }
  }

  const handleCloseImport = () => {
    setImportOpen(false)
    setImportFile(null)
    setImportResult(null)
    setImportProgress(0)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Clients</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Télécharger modèle
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Importer Excel
              </Button>
            </>
          )}
          <Button onClick={onCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau client
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) handleCloseImport(); else setImportOpen(true) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer des clients depuis Excel
            </DialogTitle>
            <DialogDescription>
              Importez un fichier Excel (.xlsx) avec les données clients. Les champs requis sont marqués d&apos;un astérisque dans le modèle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File selection area */}
            {!importFile && !importResult && (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Cliquez pour sélectionner un fichier Excel</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx uniquement</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* File info display */}
            {importFile && !importResult && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(importFile.size / 1024).toFixed(1)} Ko
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setImportFile(null); setImportResult(null) }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Import en cours...
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            {/* Import result summary */}
            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-lg font-semibold text-emerald-700">{importResult.imported}</p>
                      <p className="text-xs text-emerald-600">Importé(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <XCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-lg font-semibold text-amber-700">{importResult.skipped}</p>
                      <p className="text-xs text-amber-600">Ignoré(s)</p>
                    </div>
                  </div>
                </div>

                {/* Error details */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      Détails des erreurs ({importResult.errors.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="text-xs flex gap-2">
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                            L{err.row}
                          </Badge>
                          <span className="text-muted-foreground">{err.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!importResult ? (
              <>
                <Button variant="outline" onClick={handleCloseImport} disabled={importing}>
                  Annuler
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Importation...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Importer
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseImport}>
                Fermer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par raison sociale, ICE, ville, email ou téléphone..."
          value={search}
          onChange={(e) => { onSearch(e.target.value); onPage(1) }}
          className="pl-9"
        />
      </div>

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => { onStatusFilter(null); onPage(1) }}
        >
          Tous
        </Button>
        {clientStatusOptions.map((s) => (
          <Button
            key={s.value}
            variant={statusFilter === s.value ? 'default' : 'outline'}
            size="sm"
            className={statusFilter === s.value ? s.color : ''}
            onClick={() => {
              onStatusFilter(statusFilter === s.value ? null : s.value)
              onPage(1)
            }}
          >
            {s.label}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        <Select
          value={categorieFilter ?? ''}
          onValueChange={(v) => { onCategorieFilter(v || null); onPage(1) }}
        >
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue placeholder="Catégorie..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes catégories</SelectItem>
            {categorieOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Raison sociale
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">ICE</TableHead>
                  <TableHead className="hidden lg:table-cell" onClick={() => onSort('city')}>
                    <div className="flex items-center gap-1 cursor-pointer select-none">
                      Ville
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden xl:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right hidden lg:table-cell" onClick={() => onSort('balance')}>
                    <div className="flex items-center justify-end gap-1 cursor-pointer select-none">
                      CA Total
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search ? 'Aucun client trouvé.' : 'Aucun client enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onDetail(client)}
                    >
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                        {client.siret || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {client.city || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {client.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {client.email || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status="actif" />
                      </TableCell>
                      <TableCell className="text-right font-medium hidden lg:table-cell">
                        <span className={client.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                          {fmt(client.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDetail(client)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(client)}>
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
                                <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer <strong>{client.name}</strong> ?
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(client.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, total)} sur {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPage(pageNum)}
                  className="w-9"
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  FORM VIEW (Create / Edit)
// ═══════════════════════════════════════════════════════════════
interface ClientFormViewProps {
  mode: 'create' | 'edit'
  client?: Client | null
  onBack: () => void
  onSaved: () => void
}

function ClientFormView({ mode, client, onBack, onSaved }: ClientFormViewProps) {
  const [saving, setSaving] = useState(false)

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: mode === 'edit' && client
      ? {
          ...defaultClientFormValues,
          raisonSociale: client.name,
          nomCommercial: '',
          ice: client.siret || '',
          patente: '',
          cnss: '',
          identifiantFiscal: '',
          registreCommerce: '',
          villeRC: '',
          adresse: client.address || '',
          ville: client.city || '',
          codePostal: client.postalCode || '',
          telephone: client.phone || '',
          email: client.email || '',
          seuilCredit: client.creditLimit || 0,
          conditionsPaiement: client.paymentTerms || '30',
          commentairesInternes: client.notes || '',
        }
      : defaultClientFormValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'contacts',
  })

  const onSubmit = async (data: ClientFormData) => {
    try {
      setSaving(true)
      // Map to backend-compatible fields
      const body = {
        name: data.raisonSociale,
        email: data.email || null,
        phone: data.telephone || null,
        siret: data.ice || null,
        address: data.adresse || null,
        city: data.ville || null,
        postalCode: data.codePostal || null,
        country: 'Maroc',
        creditLimit: data.seuilCredit || 0,
        paymentTerms: conditionsPaiementOptions.find(o => o.value === data.conditionsPaiement)?.label || '30 jours',
        notes: data.commentairesInternes || null,
        // Extended fields (will be stored when backend schema is updated)
        ...(mode === 'create' ? {} : { id: client?.id }),
      }

      if (mode === 'edit' && client) {
        await api.put('/clients', body)
        toast.success('Client modifié', { description: `${data.raisonSociale} a été mis à jour.` })
      } else {
        await api.post('/clients', body)
        toast.success('Client créé', { description: `${data.raisonSociale} a été ajouté avec succès.` })
      }
      onSaved()
      onBack()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde'
      toast.error('Erreur de sauvegarde', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Nouveau client' : 'Modifier le client'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === 'create'
              ? 'Remplissez les informations pour créer un nouveau client.'
              : `Modification de ${client?.name}`}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="identite" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="identite" className="text-xs sm:text-sm">
                <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
                Identité
              </TabsTrigger>
              <TabsTrigger value="coordonnees" className="text-xs sm:text-sm">
                <MapPin className="h-4 w-4 mr-1 hidden sm:inline" />
                Coordonnées
              </TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 hidden sm:inline" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="commercial" className="text-xs sm:text-sm">
                <ShoppingCart className="h-4 w-4 mr-1 hidden sm:inline" />
                Commercial
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="text-xs sm:text-sm">
                <Receipt className="h-4 w-4 mr-1 hidden sm:inline" />
                Fiscal
              </TabsTrigger>
              <TabsTrigger value="suivi" className="text-xs sm:text-sm">
                <TrendingUp className="h-4 w-4 mr-1 hidden sm:inline" />
                Suivi
              </TabsTrigger>
              <TabsTrigger value="relances" className="text-xs sm:text-sm">
                <AlertTriangle className="h-4 w-4 mr-1 hidden sm:inline" />
                Relances
              </TabsTrigger>
              <TabsTrigger value="production" className="text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
                Production
              </TabsTrigger>
            </TabsList>

            {/* ─── Tab 1: Identité légale ─── */}
            <TabsContent value="identite">
              <Card>
                <CardHeader>
                  <CardTitle>Identité légale</CardTitle>
                  <CardDescription>Informations d&apos;enregistrement légal de l&apos;entreprise</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="raisonSociale" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raison sociale *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: GEMA Industries SARL" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nomCommercial" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom commercial</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: GEMA Pro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ice" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICE (Identifiant Commun de l&apos;Entreprise) *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="15 chiffres" maxLength={15} className="font-mono" />
                      </FormControl>
                      <FormDescription>Identifiant unique de 15 chiffres attribué par l&apos;ANAME</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="patente" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patente *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Numéro de patente" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cnss" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNSS *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Numéro CNSS" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="identifiantFiscal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identifiant fiscal (IF) *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Numéro IF" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="registreCommerce" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registre de commerce (RC) *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Numéro RC" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="villeRC" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville du RC *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Casablanca" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="formeJuridique" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forme juridique</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {formeJuridiqueOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dateCreation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de création</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 2: Coordonnées ─── */}
            <TabsContent value="coordonnees">
              <Card>
                <CardHeader>
                  <CardTitle>Coordonnées</CardTitle>
                  <CardDescription>Adresse de contact et informations de communication</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="adresse" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Adresse *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 45, Bd Mohamed V, Quartier des Affaires" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="codePostal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 20000" maxLength={5} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ville" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Casablanca, Rabat, Marrakech..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="provincePrefecture" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province / Préfecture</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Préfecture de Casablanca" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="telephone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+212 5 22 00 00 00" />
                      </FormControl>
                      <FormDescription>Format marocain : +212 suivi de 9 chiffres</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gsm" render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSM</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+212 6 61 23 45 67" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="contact@entreprise.ma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emailSecondaire" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email secondaire</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="comptabilite@entreprise.ma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="siteWeb" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site web</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.entreprise.ma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="langueCommunication" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Langue de communication</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {langueOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 3: Contacts ─── */}
            <TabsContent value="contacts">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Contacts</CardTitle>
                      <CardDescription>Personnes de contact associées à ce client</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          type: 'decisionnaire',
                          nom: '',
                          prenom: '',
                          fonction: '',
                          telephoneDirect: '',
                          email: '',
                          notes: '',
                        })
                      }
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {fields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucun contact ajouté.</p>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-1"
                        onClick={() =>
                          append({
                            type: 'decisionnaire',
                            nom: '',
                            prenom: '',
                            fonction: '',
                            telephoneDirect: '',
                            email: '',
                            notes: '',
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ajouter un contact
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fields.map((fieldItem, index) => (
                        <div key={fieldItem.id} className="relative border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Contact {index + 1}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <FormField control={form.control} name={`contacts.${index}.type`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {contactTypeOptions.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`contacts.${index}.nom`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nom *</FormLabel>
                                <FormControl><Input {...field} placeholder="Nom" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`contacts.${index}.prenom`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Prénom</FormLabel>
                                <FormControl><Input {...field} placeholder="Prénom" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`contacts.${index}.fonction`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fonction</FormLabel>
                                <FormControl><Input {...field} placeholder="Directeur, Gérant..." /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`contacts.${index}.telephoneDirect`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Téléphone direct</FormLabel>
                                <FormControl><Input {...field} placeholder="+212 6 XX XX XX XX" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name={`contacts.${index}.email`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input type="email" {...field} placeholder="prenom.nom@entreprise.ma" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name={`contacts.${index}.notes`} render={({ field }) => (
                            <FormItem className="mt-3">
                              <FormLabel>Notes</FormLabel>
                              <FormControl><Textarea {...field} placeholder="Notes sur ce contact..." rows={2} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 4: Paramètres commerciaux ─── */}
            <TabsContent value="commercial">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres commerciaux</CardTitle>
                  <CardDescription>Conditions de vente et préférences commerciales</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="conditionsPaiement" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conditions de paiement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {conditionsPaiementOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="modeReglementPrefere" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode de règlement préféré</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {modeReglementOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="escompte" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escompte (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="remisePermanente" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remise permanente (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="baremePrix" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barème de prix</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Grossiste, Détaillant..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="seuilCredit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seuil de crédit (MAD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={100}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="delaiLivraison" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Délai de livraison</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: 48h, 7 jours..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="transporteurPrefere" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transporteur préféré</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: CTM, Amana..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="incoterm" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incoterm</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {incotermOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 5: Paramètres fiscaux ─── */}
            <TabsContent value="fiscal">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres fiscaux</CardTitle>
                  <CardDescription>Informations fiscales et de facturation</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="tauxTVA" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de TVA par défaut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {tauxTVAOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="codeComptableClient" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code comptable client</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: 411XXX" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="modeFacturation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode de facturation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {modeFacturationOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emailFacturation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de facturation</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="facturation@entreprise.ma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="regimeFiscal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Régime fiscal</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {regimeFiscalOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 6: Suivi & Statistiques (read-only) ─── */}
            <TabsContent value="suivi">
              <Card>
                <CardHeader>
                  <CardTitle>Suivi & Statistiques</CardTitle>
                  <CardDescription>Données calculées automatiquement (lecture seule)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Date du premier achat" value={form.getValues('datePremierAchat') || '—'} />
                    <InfoRow label="Date du dernier achat" value={form.getValues('dateDernierAchat') || '—'} />
                    <InfoRow label="CA Total HT" value={form.getValues('caTotalHT') ? fmt(form.getValues('caTotalHT')) : '0,00 MAD'} />
                    <InfoRow label="Nombre de commandes" value={form.getValues('nbCommandes')} />
                    <InfoRow label="Panier moyen" value={form.getValues('panierMoyen') ? fmt(form.getValues('panierMoyen')) : '0,00 MAD'} />
                    <InfoRow label="Taux de retour" value={form.getValues('tauxRetour') ? `${form.getValues('tauxRetour')}%` : '0%'} />
                  </div>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-semibold mb-2">Dernier devis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoRow label="Date" value={form.getValues('dernierDevisDate') || '—'} />
                    <InfoRow label="Montant" value={form.getValues('dernierDevisMontant') ? fmt(form.getValues('dernierDevisMontant')) : '—'} />
                    <InfoRow label="Statut" value={form.getValues('dernierDevisStatut') || '—'} />
                  </div>
                  <Separator className="my-4" />
                  <h4 className="text-sm font-semibold mb-2">Dernière facture</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Date" value={form.getValues('derniereFactureDate') || '—'} />
                    <InfoRow label="Montant" value={form.getValues('derniereFactureMontant') ? fmt(form.getValues('derniereFactureMontant')) : '—'} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 7: Relances & Litiges ─── */}
            <TabsContent value="relances">
              <Card>
                <CardHeader>
                  <CardTitle>Relances & Litiges</CardTitle>
                  <CardDescription>Suivi des impayés et contentieux</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="nbImpayes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre d&apos;impayés</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="delaiMoyenPaiement" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Délai moyen de paiement (jours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="alerteImpaye" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Alerte impayé</FormLabel>
                        <FormDescription>Activer les alertes pour les retards de paiement</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Separator className="md:col-span-2" />
                  <h4 className="text-sm font-semibold md:col-span-2">Contentieux</h4>
                  <FormField control={form.control} name="contentieuxNom" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du contact contentieux</FormLabel>
                      <FormControl><Input {...field} placeholder="Nom de l'avocat / contact" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contentieuxEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email contentieux</FormLabel>
                      <FormControl><Input type="email" {...field} placeholder="avocat@lawfirm.ma" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contentieuxTelephone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone contentieux</FormLabel>
                      <FormControl><Input {...field} placeholder="+212 5 XX XX XX XX" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="derniereRelanceDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de la dernière relance</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="derniereRelanceType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de la dernière relance</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {relanceTypeOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab 8: Production & Divers ─── */}
            <TabsContent value="production">
              <Card>
                <CardHeader>
                  <CardTitle>Production & Divers</CardTitle>
                  <CardDescription>Spécifications techniques, catégorisation et notes internes</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="certificationsRequises" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certifications requises</FormLabel>
                      <FormControl><Input {...field} placeholder="ISO 9001, HACCP..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="specsTechniquesUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL des specs techniques</FormLabel>
                      <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="packagingInstructions" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions de packaging</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Palette 120x80, film étirable..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="planningLivraisonRecurrent" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planning de livraison récurrent</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Tous les lundis, 1er du mois..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="seuilLotMinimal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seuil lot minimal</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="frequenceReporting" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fréquence de reporting</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {frequenceReportingOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="statut" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {clientStatusOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="categorie" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categorieOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="origineProspect" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origine du prospect</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {origineProspectOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priorite" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Priorité : {field.value} / 5</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          value={[field.value]}
                          onValueChange={(v) => field.onChange(v[0])}
                        />
                      </FormControl>
                      <FormDescription>1 = Faible, 5 = Critique</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="commentairesInternes" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Commentaires internes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Notes internes sur le client, historique des interactions, remarques..."
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Enregistrement...
                </>
              ) : mode === 'edit' ? (
                <>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer le client
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
interface ClientDetailViewProps {
  client: Client
  onBack: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}

function ClientDetailView({ client, onBack, onEdit, onDelete }: ClientDetailViewProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading for related data
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  if (loading) return <DetailSkeleton />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{client.name}</h2>
              <StatusBadge status="actif" />
            </div>
            <p className="text-sm text-muted-foreground">
              {client.siret && <span className="font-mono">ICE: {client.siret}</span>}
              {client.city && <span className="ml-2">• {client.city}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer <strong>{client.name}</strong> ?
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(client.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              Téléphone
            </div>
            <p className="font-medium">{client.phone || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="font-medium truncate">{client.email || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              Adresse
            </div>
            <p className="font-medium truncate">
              {[client.address, client.postalCode, client.city].filter(Boolean).join(', ') || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue="identite">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="identite" className="text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
            Identité
          </TabsTrigger>
          <TabsTrigger value="commercial" className="text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 mr-1 hidden sm:inline" />
            Commercial
          </TabsTrigger>
          <TabsTrigger value="historique" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 hidden sm:inline" />
            Contacts
          </TabsTrigger>
        </TabsList>

        {/* Tab: Identité */}
        <TabsContent value="identite">
          <Card>
            <CardHeader>
              <CardTitle>Informations légales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <InfoRow label="Raison sociale" value={client.name} />
                <InfoRow label="SIRET / ICE" value={client.siret} />
                <InfoRow label="Adresse" value={client.address} />
                <InfoRow label="Code postal" value={client.postalCode} />
                <InfoRow label="Ville" value={client.city} />
                <InfoRow label="Pays" value={client.country} />
                <InfoRow label="Téléphone" value={client.phone} />
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Limite de crédit" value={client.creditLimit ? fmt(client.creditLimit) : null} />
                <InfoRow label="Conditions de paiement" value={client.paymentTerms} />
                <InfoRow label="Solde" value={fmt(client.balance)} />
                <InfoRow label="Notes" value={client.notes} />
                <InfoRow label="Date de création" value={
                  client.createdAt ? format(new Date(client.createdAt), 'dd MMMM yyyy', { locale: fr }) : null
                } />
                <InfoRow label="Dernière modification" value={
                  client.updatedAt ? format(new Date(client.updatedAt), 'dd MMMM yyyy', { locale: fr }) : null
                } />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Commercial */}
        <TabsContent value="commercial">
          <Card>
            <CardHeader>
              <CardTitle>Données commerciales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Solde actuel</p>
                    <p className={`text-2xl font-bold ${client.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(client.balance)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Limite de crédit</p>
                    <p className="text-2xl font-bold">{client.creditLimit ? fmt(client.creditLimit) : '—'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Conditions de paiement</p>
                    <p className="text-2xl font-bold">{client.paymentTerms || '—'}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <InfoRow label="Solde" value={fmt(client.balance)} />
                <InfoRow label="Limite de crédit" value={client.creditLimit ? fmt(client.creditLimit) : null} />
                <InfoRow label="Conditions de paiement" value={client.paymentTerms} />
                <InfoRow label="Notes" value={client.notes} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Historique (related documents) */}
        <TabsContent value="historique">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents récents</CardTitle>
                <CardDescription>Devis, commandes et factures associées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Les documents associés seront affichés ici.</p>
                  <p className="text-xs mt-1">Connectez le module historique pour voir les devis, commandes et factures.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Contacts */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>Personnes de contact associées</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-1" />
                  Gérer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aucun contact enregistré pour ce client.</p>
                <Button variant="link" size="sm" className="mt-1" onClick={onEdit}>
                  Ajouter un contact
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
