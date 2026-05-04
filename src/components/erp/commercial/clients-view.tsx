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
  FileSpreadsheet, Download, Upload, CheckCircle2, XCircle, Loader2,
  Truck, RotateCcw, Wallet, Printer, CalendarDays,
  CreditCard, Scale, BarChart3, HardHat, MapPinned
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores'
import { printDocument } from '@/lib/print-utils'
import { DocDetailDialog } from './doc-detail-dialog'
import { HelpButton } from '@/components/erp/shared/help-button'
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
  code?: string
  name: string
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  creditLimit: number | null
  seuilCredit: number
  paymentTerms: string | null
  conditionsPaiement: string | null
  notes: string | null
  balance: number
  typeSociete: string
  statut: string
  categorie: string
  ice: string
  gsm: string | null
  caTotalHT: number
  nbCommandes: number
  alerteImpaye: boolean
  nbImpayes: number
  createdAt: string
  updatedAt: string
}

interface Chantier {
  id: string
  nomProjet: string
  adresse: string
  ville: string
  codePostal: string | null
  provincePrefecture: string | null
  responsableNom: string
  responsableFonction: string | null
  telephone: string | null
  gsm: string | null
  notes: string | null
  actif: boolean
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

const typeSocieteColorMap: Record<string, string> = {
  SOCIETE: 'bg-blue-100 text-blue-800 border-blue-200',
  REVENDEUR: 'bg-amber-100 text-amber-800 border-amber-200',
  PARTICULIER: 'bg-purple-100 text-purple-800 border-purple-200',
  AUTRES: 'bg-gray-100 text-gray-700 border-gray-200',
}


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
      <Card className="overflow-hidden">
        <div className="space-y-3 p-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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
  const [allClients, setAllClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categorieFilter, setCategorieFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtor' | 'creditor' | 'creditLimit'>('all')
  const [sortField, setSortField] = useState<string>('raisonSociale')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [saving, setSaving] = useState(false)

  // Debounced search handler
  const handleSearch = useCallback((value: string) => {
    setSearch(value)          // Update input immediately (keeps focus)
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchClientsBySearch(value)
    }, 300)
  }, [])

  const fetchClientsBySearch = useCallback(async (searchTerm: string) => {
    try {
      const params = new URLSearchParams({ limit: '1000' })
      if (searchTerm) params.set('search', searchTerm)
      const res = await api.get<{ clients: Client[]; total: number }>(`/clients?${params}`)
      setAllClients(res.clients || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Erreur chargement clients:', err)
    }
  }, [])

  // ─── Fetch ALL Clients (no pagination, scrollable) ───
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '1000' })
      if (searchRef.current) params.set('search', searchRef.current)
      const res = await api.get<{ clients: Client[]; total: number }>(`/clients?${params}`)
      setAllClients(res.clients || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Erreur chargement clients:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des clients.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (subView === 'list') {
      fetchClients()
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [subView, fetchClients])

  // ─── Filtered + sorted (client-side for status/categorie filters) ───
  const filteredClients = useMemo(() => {
    let result = [...allClients]
    if (statusFilter) result = result.filter(c => c.statut === statusFilter)
    if (categorieFilter) result = result.filter(c => c.categorie === categorieFilter)
    if (typeFilter) result = result.filter(c => c.typeSociete === typeFilter)
    if (balanceFilter === 'debtor') result = result.filter(c => c.balance > 0)
    if (balanceFilter === 'creditor') result = result.filter(c => c.balance < 0)
    if (balanceFilter === 'creditLimit') result = result.filter(c => c.seuilCredit > 0 && c.balance >= c.seuilCredit)
    result.sort((a, b) => {
      const aVal = String(a[sortField as keyof Client] ?? '')
      const bVal = String(b[sortField as keyof Client] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    return result
  }, [allClients, statusFilter, categorieFilter, typeFilter, balanceFilter, sortField, sortDir])

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }



  // ─── Navigation helpers ───
  const goToCreate = () => {
    setSelectedClient(null)
    setSubView('create')
  }

  const goToEdit = async (client: Client) => {
    try {
      const fullClient = await api.get<Client>(`/clients/${client.id}`)
      if (fullClient) {
        setSelectedClient(fullClient)
      } else {
        setSelectedClient(client)
      }
    } catch {
      setSelectedClient(client)
    }
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
          filteredCount={filteredClients.length}
          loading={loading}
          search={search}
          statusFilter={statusFilter}
          categorieFilter={categorieFilter}
          typeFilter={typeFilter}
          balanceFilter={balanceFilter}
          sortField={sortField}
          sortDir={sortDir}
          onSearch={handleSearch}
          onStatusFilter={setStatusFilter}
          onCategorieFilter={setCategorieFilter}
          onTypeFilter={setTypeFilter}
          onBalanceFilter={setBalanceFilter}
          onSort={toggleSort}
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
  filteredCount: number
  loading: boolean
  search: string
  statusFilter: string | null
  categorieFilter: string | null
  typeFilter: string | null
  balanceFilter: 'all' | 'debtor' | 'creditor' | 'creditLimit'
  sortField: string
  sortDir: 'asc' | 'desc'
  onSearch: (v: string) => void
  onStatusFilter: (v: string | null) => void
  onCategorieFilter: (v: string | null) => void
  onTypeFilter: (v: string | null) => void
  onBalanceFilter: (v: 'all' | 'debtor' | 'creditor' | 'creditLimit') => void
  onSort: (field: string) => void
  onCreate: () => void
  onEdit: (c: Client) => void
  onDetail: (c: Client) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

function ClientListView({
  clients, total, filteredCount, loading, search,
  statusFilter, categorieFilter, typeFilter, balanceFilter, sortField, sortDir,
  onSearch, onStatusFilter, onCategorieFilter, onTypeFilter, onBalanceFilter, onSort,
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
          <Badge variant="secondary">{filteredCount}{filteredCount !== total ? `/${total}` : ''}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <HelpButton section="ventes" sub="clients" />
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
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === null && typeFilter === null && categorieFilter === null && balanceFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { onStatusFilter(null); onTypeFilter(null); onCategorieFilter(null); onBalanceFilter('all') }}
        >
          Tous
        </Button>
        {/* Type filters */}
        <Button variant={typeFilter === "SOCIETE" ? "default" : "outline"} size="sm" onClick={() => onTypeFilter(typeFilter === "SOCIETE" ? null : "SOCIETE")}>Société</Button>
        <Button variant={typeFilter === "REVENDEUR" ? "default" : "outline"} size="sm" onClick={() => onTypeFilter(typeFilter === "REVENDEUR" ? null : "REVENDEUR")}>Revendeur</Button>
        <Button variant={typeFilter === "PARTICULIER" ? "default" : "outline"} size="sm" onClick={() => onTypeFilter(typeFilter === "PARTICULIER" ? null : "PARTICULIER")}>Particulier</Button>
        <Button variant={typeFilter === "AUTRES" ? "default" : "outline"} size="sm" onClick={() => onTypeFilter(typeFilter === "AUTRES" ? null : "AUTRES")}>Autres</Button>
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        {/* Balance filters */}
        <Button variant={balanceFilter === 'debtor' ? 'default' : 'outline'} size="sm" className={balanceFilter === 'debtor' ? 'bg-red-600 hover:bg-red-700 text-white' : ''} onClick={() => onBalanceFilter(balanceFilter === 'debtor' ? 'all' : 'debtor')}>Débiteurs</Button>
        <Button variant={balanceFilter === 'creditor' ? 'default' : 'outline'} size="sm" className={balanceFilter === 'creditor' ? 'bg-green-600 hover:bg-green-700 text-white' : ''} onClick={() => onBalanceFilter(balanceFilter === 'creditor' ? 'all' : 'creditor')}>Créditeurs</Button>
        <Button variant={balanceFilter === 'creditLimit' ? 'default' : 'outline'} size="sm" className={balanceFilter === 'creditLimit' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''} onClick={() => onBalanceFilter(balanceFilter === 'creditLimit' ? 'all' : 'creditLimit')}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Plafond atteint
        </Button>
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        <Select value={categorieFilter ?? ''} onValueChange={(v) => onCategorieFilter(v === '__all__' ? null : v)}>
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
      {/* Table — scrollable with native scrollbar */}
      <Card>
        <CardContent className="p-0">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => onSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Raison sociale
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
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
                      Solde
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Plafond</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="font-mono text-xs">{client.code || '—'}</TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={typeSocieteColorMap[client.typeSociete] || ''}>
                          {client.typeSociete || '—'}
                        </Badge>
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
                        <StatusBadge status={client.statut || 'prospect'} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {client.seuilCredit > 0 && (
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(100, (Math.abs(client.balance) / client.seuilCredit) * 100)} className="h-1.5 flex-1 min-w-[40px]" />
                            <span className={`text-[10px] font-medium ${client.balance >= client.seuilCredit ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {Math.round((Math.abs(client.balance) / client.seuilCredit) * 100)}%
                            </span>
                          </div>
                        )}
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
  const [commerciaux, setCommerciaux] = useState<{ id: string; firstName: string; lastName: string; fonction?: { name: string } }[]>([])
  const [autoCode, setAutoCode] = useState('')

  // Fetch commercial employees & next code on create
  useEffect(() => {
    api.get('/employees?commercial=true').then((res: any) => {
      setCommerciaux(res.employees || res.data || [])
    }).catch(() => {})
    if (mode === 'create') {
      api.get('/clients?nextCode=true').then((res: any) => {
        if (res.nextCode) setAutoCode(res.nextCode)
      }).catch(() => {})
    }
    if (mode === 'edit' && client?.code) {
      setAutoCode(client.code)
    }
  }, [mode, client])

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: mode === 'edit' && client
      ? {
          ...defaultClientFormValues,
          raisonSociale: client.name || '',
          nomCommercial: '',
          ice: client.siret || client.ice || '',
          patente: '',
          cnss: '',
          identifiantFiscal: '',
          registreCommerce: '',
          villeRC: '',
          formeJuridique: '',
          adresse: client.address || '',
          ville: client.city || '',
          codePostal: client.postalCode || '',
          telephone: client.phone || '',
          gsm: client.gsm || '',
          email: client.email || '',
          emailSecondaire: '',
          siteWeb: '',
          seuilCredit: client.creditLimit || client.seuilCredit || 0,
          conditionsPaiement: client.paymentTerms || client.conditionsPaiement || '30',
          modeReglementPrefere: '',
          escompte: 0,
          remisePermanente: 0,
          delaiLivraison: null,
          commentairesInternes: client.notes || '',
          commercialId: (client as any).commercialId || '',
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
        commercialId: data.commercialId || null,
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
                  <div className="space-y-2">
                    <Label>Code client</Label>
                    <Input value={autoCode} disabled placeholder="Auto-généré" className="font-mono bg-muted" />
                    <p className="text-xs text-muted-foreground">Code attribué automatiquement par le système</p>
                  </div>
                  <div /> {/* spacer */}
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
                  {/* Commercial assigné */}
                  <FormField control={form.control} name="commercialId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commercial responsable <span className="text-muted-foreground text-xs">(optionnel)</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un commercial..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">— Aucun —</SelectItem>
                          {commerciaux.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.firstName} {c.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
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
                      <FormLabel>Plafond de crédit (MAD)</FormLabel>
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
// ───────────────────── Historique Document Types ─────────────────────
// ── Document types for tab tables ──
interface DocRow {
  id: string
  number: string
  date: string
  status: string
  totalTTC: number
}

// ── Status configs per document type (commercial) ──
const quoteStatusCfg: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent:      { label: 'Envoyé',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  accepted:  { label: 'Accepté',   className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  rejected:  { label: 'Refusé',    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  expired:   { label: 'Expiré',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  cancelled: { label: 'Annulé',    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const orderStatusCfg: Record<string, { label: string; className: string }> = {
  pending:             { label: 'En attente',         className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  confirmed:           { label: 'Confirmée',          className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  in_preparation:      { label: 'En préparation',     className: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  prepared:            { label: 'Préparée',           className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  partially_delivered: { label: 'Partiellement livrée', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  delivered:           { label: 'Livrée',             className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  cancelled:           { label: 'Annulée',            className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const blStatusCfg: Record<string, { label: string; className: string }> = {
  draft:      { label: 'Brouillon',  className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  confirmed:  { label: 'Confirmé',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  delivered:  { label: 'Livré',      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled:  { label: 'Annulé',     className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const invoiceStatusCfg: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  validated: { label: 'Validée',   className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  sent:      { label: 'Envoyée',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  paid:      { label: 'Payée',     className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  overdue:   { label: 'En retard', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled: { label: 'Annulée',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

const creditNoteStatusCfg: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  validated: { label: 'Validé',    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  applied:   { label: 'Appliqué',  className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled: { label: 'Annulé',    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

function DocStatusBadge({ status, config }: { status: string; config: Record<string, { label: string; className: string }> }) {
  const cfg = config[status]
  if (!cfg) return <Badge variant="outline">{status}</Badge>
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

// ── Empty State ──
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Tab Skeleton ──
function TabSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-28" />
          <div className="flex-1" />
        </div>
      ))}
    </div>
  )
}

// ── Tab Card Wrapper ──
function TabCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Custom hook for fetching tab data ──
function useTabData<T>(endpoint: string, field: string, clientId: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      try {
        setLoading(true)
        const res = await api.get<Record<string, unknown>>(`${endpoint}?clientId=${clientId}`)
        if (!cancelled) {
          setData((res[field] as T[]) || [])
        }
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [endpoint, field, clientId])

  return { data, loading }
}

// ── Format helpers ──
function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

// ═══════════════════════════════════════════════════════════════
//  FINANCIAL STATEMENT TAB (Relevé de Compte)
// ═══════════════════════════════════════════════════════════════

interface StatementTransaction {
  date: string
  type: 'invoice' | 'payment' | 'credit_note'
  reference: string
  label: string
  debit: number
  credit: number
  balance: number
  paymentCode?: string | null
}

interface StatementSummary {
  /** Montant des factures impayées */
  unpaidInvoices: number
  /** Montant des livraisons non encore facturées */
  uninvoicedDeliveries: number
  /** Montant des règlements de la période */
  periodPayments: number
  /** Montant des chèques/effets non remis à la banque */
  portfolioAmount: number
  /** Montant des avoirs non consolidés */
  unconsolidatedCreditNotes: number
  /** Solde de la période */
  periodBalance: number
}

interface StatementData {
  client: { id: string; name: string; ice: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; postalCode: string | null }
  from: string | null
  to: string | null
  previousBalance: number
  transactions: StatementTransaction[]
  totalDebit: number
  totalCredit: number
  finalBalance: number
  summary: StatementSummary
}

function FinancialStatementTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const res = await api.get<StatementData>(`/clients/${clientId}/statement?${params}`)
      setData(res)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement relevé')
    } finally {
      setLoading(false)
    }
  }, [clientId, fromDate, toDate])

  useEffect(() => {
    fetchStatement()
  }, [fetchStatement])

  const handlePrint = async () => {
    if (!data || data.transactions.length === 0) {
      toast.error('Aucune transaction à imprimer')
      return
    }

    const fmtDateStr = (d: string) => {
      try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
      catch { return d }
    }
    const fmtM = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD'

    // Info grid
    const periodStr = data.from || data.to
      ? `Période : ${data.from ? fmtDateStr(data.from + 'T00:00:00') : '...'} au ${data.to ? fmtDateStr(data.to + 'T00:00:00') : '...'}`
      : 'Période : Depuis le début'

    const infoGrid = [
      { label: 'Client', value: data.client.name || '—' },
      { label: 'ICE', value: data.client.ice || '—' },
      { label: 'Téléphone', value: data.client.phone || '—' },
      { label: 'Période', value: periodStr },
    ]

    // Previous balance row
    const rows: Array<Array<{ value: string | number; align?: string }>> = []
    if (data.previousBalance !== 0) {
      rows.push([
        { value: '', align: 'center' },
        { value: '' },
        { value: 'Solde précédent' },
        { value: fmtM(data.previousBalance), align: 'right' },
        { value: '', align: 'right' },
        { value: fmtM(data.previousBalance), align: 'right' },
        { value: '', align: 'center' },
      ])
    }

    // Transaction rows
    for (const tx of data.transactions) {
      const typeLabel = tx.type === 'invoice' ? 'Facture' : tx.type === 'credit_note' ? 'Avoir' : 'Paiement'
      rows.push([
        { value: fmtDateStr(tx.date), align: 'center' },
        { value: typeLabel, align: 'center' },
        { value: tx.label },
        { value: tx.debit > 0 ? fmtM(tx.debit) : '', align: 'right' },
        { value: tx.credit > 0 ? fmtM(tx.credit) : '', align: 'right' },
        { value: fmtM(tx.balance), align: 'right' },
        { value: tx.paymentCode || '', align: 'center' },
      ])
    }

    // Totals
    const totals = [
      { label: 'Total Débit', value: fmtM(data.totalDebit) },
      { label: 'Total Crédit', value: fmtM(data.totalCredit) },
      { label: 'Solde', value: fmtM(data.finalBalance), bold: true, negative: data.finalBalance > 0 },
    ]

    // Build summary sub-section HTML for print
    let subSections = ''
    if (data.summary) {
      const s = data.summary
      const balanceLabel = s.periodBalance > 0 ? 'Solde Débiteur' : s.periodBalance < 0 ? 'Solde Créditeur' : 'Solde'
      const balanceColor = s.periodBalance > 0 ? '#dc2626' : s.periodBalance < 0 ? '#16a34a' : '#1a1a1a'
      subSections = `
        <div class="section-title">RÉCAPITULATIF FINANCIER</div>
        <table>
          <thead>
            <tr>
              <th style="width:18%">Facture (impayées)</th>
              <th style="width:18%">Livraison (non facturées)</th>
              <th style="width:18%">Règlement (période)</th>
              <th style="width:12%">Portefeuille</th>
              <th style="width:18%">Avoir (non consolidés)</th>
              <th style="width:16%" class="text-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-right" style="${s.unpaidInvoices > 0 ? 'color:#dc2626;font-weight:600;' : ''}">${fmtM(s.unpaidInvoices)}</td>
              <td class="text-right" style="${s.uninvoicedDeliveries > 0 ? 'color:#ea580c;font-weight:600;' : ''}">${fmtM(s.uninvoicedDeliveries)}</td>
              <td class="text-right" style="color:#16a34a;">${fmtM(s.periodPayments)}</td>
              <td class="text-right" style="${s.portfolioAmount > 0 ? 'color:#7c3aed;font-weight:600;' : ''}">${fmtM(s.portfolioAmount)}</td>
              <td class="text-right" style="${s.unconsolidatedCreditNotes > 0 ? 'color:#d97706;font-weight:600;' : ''}">${fmtM(s.unconsolidatedCreditNotes)}</td>
              <td class="text-right" style="color:${balanceColor};font-weight:700;">${fmtM(s.periodBalance)}</td>
            </tr>
          </tbody>
        </table>
      `
    }

    await printDocument({
      title: 'RELEVÉ DE COMPTE',
      docNumber: '',
      infoGrid,
      columns: [
        { label: 'Date', align: 'center' },
        { label: 'Type', align: 'center' },
        { label: 'Libellé' },
        { label: 'Débit', align: 'right' },
        { label: 'Crédit', align: 'right' },
        { label: 'Solde', align: 'right' },
        { label: 'Code', align: 'center' },
      ],
      rows,
      totals,
      notes: `Relevé généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Ce document est un récapitulatif informatif.`,
      subSections,
    })
  }

  const typeLabels: Record<string, string> = {
    invoice: 'Facture',
    payment: 'Paiement',
    credit_note: 'Avoir',
    rejet_effet: 'Rejet',
  }
  const typeColors: Record<string, string> = {
    invoice: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    payment: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    credit_note: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    rejet_effet: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }

  const summaryRows = data?.summary ? [
    { label: 'Facture', sublabel: 'Impayées', value: data.summary.unpaidInvoices, icon: FileText, color: data.summary.unpaidInvoices > 0 ? 'text-red-600' : '' },
    { label: 'Livraison', sublabel: 'Non facturées', value: data.summary.uninvoicedDeliveries, icon: Truck, color: data.summary.uninvoicedDeliveries > 0 ? 'text-orange-600' : '' },
    { label: 'Règlement', sublabel: 'Période', value: data.summary.periodPayments, icon: CreditCard, color: 'text-green-600' },
    { label: 'Portefeuille', sublabel: 'Effets/Chèques', value: data.summary.portfolioAmount, icon: Wallet, color: data.summary.portfolioAmount > 0 ? 'text-purple-600' : '' },
    { label: 'Avoir', sublabel: 'Non consolidés', value: data.summary.unconsolidatedCreditNotes, icon: Receipt, color: data.summary.unconsolidatedCreditNotes > 0 ? 'text-amber-600' : '' },
    { label: 'Solde', sublabel: data.summary.periodBalance > 0 ? 'Débiteur' : data.summary.periodBalance < 0 ? 'Créditeur' : '', value: Math.abs(data.summary.periodBalance), icon: Scale, color: data.summary.periodBalance > 0 ? 'text-red-700 font-bold' : data.summary.periodBalance < 0 ? 'text-green-700 font-bold' : '' },
  ] : []

  return (
    <div className="space-y-4">
      {/* Date filter + Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium whitespace-nowrap">Période :</Label>
              </div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-auto"
                placeholder="Du"
              />
              <span className="text-muted-foreground text-sm">au</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-auto"
                placeholder="Au"
              />
              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate('') }}>
                  Effacer
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || !data || data.transactions.length === 0} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer le relevé
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Ancien solde</p>
              <p className={`text-sm font-bold ${data.previousBalance > 0 ? 'text-red-600' : data.previousBalance < 0 ? 'text-green-600' : ''}`}>
                {fmtMoney(data.previousBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Débit</p>
              <p className="text-sm font-bold text-red-600">{fmtMoney(data.totalDebit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Crédit</p>
              <p className="text-sm font-bold text-green-600">{fmtMoney(data.totalCredit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Solde final</p>
              <p className={`text-sm font-bold ${data.finalBalance > 0 ? 'text-red-600' : data.finalBalance < 0 ? 'text-green-600' : ''}`}>
                {fmtMoney(data.finalBalance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TabSkeleton />
          ) : !data || data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Aucune transaction financière</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Les factures, paiements et avoirs apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-muted z-10">
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right w-[120px]">Débit</TableHead>
                    <TableHead className="text-right w-[120px]">Crédit</TableHead>
                    <TableHead className="text-right w-[120px]">Solde</TableHead>
                    <TableHead className="w-[80px] text-center">Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.previousBalance !== 0 && (
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell colSpan={3} className="text-sm">
                        Solde précédent au {data.from ? fmtDate(data.from + 'T00:00:00') : 'début'}
                      </TableCell>
                      <TableCell className="text-right" />
                      <TableCell className="text-right" />
                      <TableCell className={`text-right font-bold ${data.previousBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmtMoney(data.previousBalance)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                  {data.transactions.map((tx, idx) => (
                    <TableRow key={`${tx.type}-${tx.reference}-${idx}`}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[tx.type] || ''}`}>
                          {typeLabels[tx.type] || tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{tx.label}</TableCell>
                      <TableCell className={`text-right text-sm ${tx.debit > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {tx.debit > 0 ? fmtMoney(tx.debit) : '—'}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${tx.credit > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                        {tx.credit > 0 ? fmtMoney(tx.credit) : '—'}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${tx.balance > 0 ? 'text-red-600' : tx.balance < 0 ? 'text-green-600' : ''}`}>
                        {fmtMoney(tx.balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        {tx.paymentCode ? (
                          <Badge variant="outline" className="font-mono font-bold bg-emerald-50 text-emerald-700 border-emerald-300 px-2 py-0.5 text-xs">
                            {tx.paymentCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="sticky bottom-0 bg-muted font-bold border-t-2">
                    <TableCell colSpan={3} className="text-sm">Totaux</TableCell>
                    <TableCell className="text-right text-red-600">{fmtMoney(data.totalDebit)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmtMoney(data.totalCredit)}</TableCell>
                    <TableCell className={`text-right ${data.finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtMoney(data.finalBalance)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* ═══ Récapitulatif financier ═══ */}
      {data && summaryRows.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Récapitulatif financier
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border bg-card p-3 text-center space-y-1 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <row.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {row.label}
                    </span>
                  </div>
                  <p className={`text-xs text-muted-foreground/80`}>{row.sublabel}</p>
                  <p className={`text-sm ${row.color}`}>
                    {fmtMoney(row.value)}
                  </p>
                </div>
              ))}
            </div>
            {data.summary.periodBalance !== 0 && (
              <div className={`mt-3 pt-3 border-t text-center text-xs ${data.summary.periodBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Solde {data.summary.periodBalance > 0 ? 'débiteur' : 'créditeur'} : {fmtMoney(data.summary.periodBalance)}&nbsp;MAD
                {data.summary.periodBalance > 0
                  ? ' — Le client vous doit ce montant'
                  : ' — Vous devez ce montant au client'}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  CHANTIERS TAB + FORM DIALOG
// ═══════════════════════════════════════════════════════════════

function ChantiersTab({
  clientId,
  chantiers,
  setChantiers,
  loading,
  setLoading,
  onOpenDialog,
}: {
  clientId: string
  chantiers: Chantier[]
  setChantiers: React.Dispatch<React.SetStateAction<Chantier[]>>
  loading: boolean
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  onOpenDialog: (chantier: Chantier | null, mode: 'create' | 'edit') => void
}) {
  const fetchChantiers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{ chantiers: Chantier[] }>(`/clients/${clientId}/chantiers`)
      setChantiers(res.chantiers || [])
    } catch {
      toast.error('Erreur lors du chargement des chantiers')
      setChantiers([])
    } finally {
      setLoading(false)
    }
  }, [clientId, setChantiers, setLoading])

  useEffect(() => {
    fetchChantiers()
  }, [fetchChantiers])

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clients/${clientId}/chantiers?id=${id}`)
      toast.success('Chantier désactivé')
      fetchChantiers()
    } catch {
      toast.error('Erreur lors de la désactivation')
    }
  }

  if (loading) return <TabSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {chantiers.length} chantier{chantiers.length !== 1 ? 's' : ''} actif{chantiers.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => onOpenDialog(null, 'create')}>
          <Plus className="h-4 w-4 mr-1" />
          Nouveau chantier
        </Button>
      </div>

      {chantiers.length === 0 ? (
        <EmptyState
          icon={HardHat}
          message="Aucun chantier enregistré. Cliquez sur « Nouveau chantier » pour en ajouter un."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chantiers.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-medium truncate">{c.nomProjet}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPinned className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {c.adresse}{c.ville ? `, ${c.ville}` : ''}
                      </span>
                    </div>
                    {c.responsableNom && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {c.responsableNom}
                          {c.responsableFonction ? ` – ${c.responsableFonction}` : ''}
                        </span>
                      </div>
                    )}
                    {(c.telephone || c.gsm) && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {[c.telephone, c.gsm].filter(Boolean).join(' / ')}
                        </span>
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onOpenDialog(c, 'edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Désactiver ce chantier ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le chantier «&nbsp;{c.nomProjet}&nbsp;» sera marqué comme inactif.
                            Vous pourrez le réactiver ultérieurement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)}>
                            Désactiver
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ChantierFormDialog({
  clientId,
  chantier,
  mode,
  open,
  onOpenChange,
  onSuccess,
}: {
  clientId: string
  chantier: Chantier | null
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nomProjet: '',
    adresse: '',
    ville: '',
    codePostal: '',
    provincePrefecture: '',
    responsableNom: '',
    responsableFonction: '',
    telephone: '',
    gsm: '',
    notes: '',
    actif: true,
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && chantier) {
        setForm({
          nomProjet: chantier.nomProjet,
          adresse: chantier.adresse,
          ville: chantier.ville,
          codePostal: chantier.codePostal || '',
          provincePrefecture: chantier.provincePrefecture || '',
          responsableNom: chantier.responsableNom,
          responsableFonction: chantier.responsableFonction || '',
          telephone: chantier.telephone || '',
          gsm: chantier.gsm || '',
          notes: chantier.notes || '',
          actif: chantier.actif,
        })
      } else {
        setForm({
          nomProjet: '',
          adresse: '',
          ville: '',
          codePostal: '',
          provincePrefecture: '',
          responsableNom: '',
          responsableFonction: '',
          telephone: '',
          gsm: '',
          notes: '',
          actif: true,
        })
      }
    }
  }, [open, mode, chantier])

  const update = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.nomProjet.trim() || !form.adresse.trim() || !form.ville.trim() || !form.responsableNom.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    try {
      setSaving(true)
      if (mode === 'create') {
        await api.post(`/clients/${clientId}/chantiers`, form)
        toast.success('Chantier créé avec succès')
      } else {
        await api.put(`/clients/${clientId}/chantiers`, { id: chantier!.id, ...form })
        toast.success('Chantier mis à jour')
      }
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error(mode === 'create' ? 'Erreur lors de la création' : 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5" />
            {mode === 'create' ? 'Nouveau chantier' : 'Modifier le chantier'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Ajoutez un site de livraison pour ce client.'
              : 'Modifiez les informations du chantier.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nom du projet */}
          <div className="space-y-2">
            <Label>
              Nom du projet <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Résidence Al Firdaous, Lotissement Yasmine..."
              value={form.nomProjet}
              onChange={(e) => update('nomProjet', e.target.value)}
            />
          </div>

          {/* Adresse du chantier */}
          <div className="space-y-2">
            <Label>
              Adresse <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Adresse complète du chantier"
              value={form.adresse}
              onChange={(e) => update('adresse', e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>
                Ville <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ville"
                value={form.ville}
                onChange={(e) => update('ville', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Code postal</Label>
              <Input
                placeholder="Code postal"
                value={form.codePostal}
                onChange={(e) => update('codePostal', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Province / Préfecture</Label>
              <Input
                placeholder="Province"
                value={form.provincePrefecture}
                onChange={(e) => update('provincePrefecture', e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Nom du responsable <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nom et prénom"
                value={form.responsableNom}
                onChange={(e) => update('responsableNom', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fonction</Label>
              <Input
                placeholder="Ex: Magasinier, Chef de chantier..."
                value={form.responsableFonction}
                onChange={(e) => update('responsableFonction', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                placeholder="Téléphone fixe"
                value={form.telephone}
                onChange={(e) => update('telephone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>GSM</Label>
              <Input
                placeholder="Numéro GSM"
                value={form.gsm}
                onChange={(e) => update('gsm', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes / Consignes d&apos;accès</Label>
            <Textarea
              placeholder="Consignes d&apos;accès, horaires, remarques..."
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
            />
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.actif}
                onCheckedChange={(checked) => update('actif', checked)}
              />
              <Label>Chantier actif</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {mode === 'create' ? 'Créer le chantier' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════

interface ClientDetailViewProps {
  client: Client
  onBack: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}

function ClientDetailView({ client, onBack, onEdit, onDelete }: ClientDetailViewProps) {
  // Tab data
  const quotes = useTabData<DocRow>('/quotes', 'quotes', client.id)
  const orders = useTabData<DocRow>('/sales-orders', 'orders', client.id)
  const deliveryNotes = useTabData<DocRow>('/delivery-notes', 'deliveryNotes', client.id)
  const invoices = useTabData<DocRow>('/invoices', 'invoices', client.id)
  const creditNotes = useTabData<DocRow>('/credit-notes', 'creditNotes', client.id)

  // Chantiers state
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [chantiersLoading, setChantiersLoading] = useState(true)
  const [chantierDialog, setChantierDialog] = useState<Chantier | null>(null)
  const [chantierFormMode, setChantierFormMode] = useState<'create' | 'edit'>('create')
  const [showChantierDialog, setShowChantierDialog] = useState(false)

  // Document detail dialog state
  const [docDialog, setDocDialog] = useState<{ type: 'quote' | 'order' | 'deliveryNote' | 'invoice' | 'creditNote'; id: string } | null>(null)

  const fullAddress = [client.address, client.postalCode, client.city, client.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{client.name}</h2>
              <StatusBadge status={client.statut || 'prospect'} />
              {client.typeSociete && (
                <Badge variant="outline" className={typeSocieteColorMap[client.typeSociete] || ''}>
                  {client.typeSociete}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {client.siret && <span className="font-mono text-xs">ICE: {client.siret}</span>}
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
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm font-medium truncate">{client.phone || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{client.email || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50 text-orange-600 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Adresse</p>
              <p className="text-sm font-medium truncate">{fullAddress || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${client.balance > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} shrink-0`}>
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Solde</p>
              <p className={`text-sm font-bold truncate ${client.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(client.balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* ── Tabs ── */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
            Informations
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
            Devis
            {quotes.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{quotes.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 mr-1 hidden sm:inline" />
            Commandes
            {orders.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{orders.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delivery-notes" className="text-xs sm:text-sm">
            <Truck className="h-4 w-4 mr-1 hidden sm:inline" />
            Bons de Livraison
            {deliveryNotes.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{deliveryNotes.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs sm:text-sm">
            <Receipt className="h-4 w-4 mr-1 hidden sm:inline" />
            Factures
            {invoices.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{invoices.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="credit-notes" className="text-xs sm:text-sm">
            <RotateCcw className="h-4 w-4 mr-1 hidden sm:inline" />
            Avoirs
            {creditNotes.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{creditNotes.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chantiers" className="text-xs sm:text-sm">
            <HardHat className="h-4 w-4 mr-1 hidden sm:inline" />
            Chantiers
            {chantiers.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{chantiers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs sm:text-sm">
            <Wallet className="h-4 w-4 mr-1 hidden sm:inline" />
            Relevé de compte
          </TabsTrigger>
        </TabsList>
        {/* ── Tab: Informations ── */}
        <TabsContent value="info">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Raison sociale" value={client.name} />
                  <InfoRow label="ICE" value={client.siret} />
                  <InfoRow label="Email" value={client.email} />
                  <InfoRow label="Téléphone" value={client.phone} />
                  <InfoRow label="Adresse" value={client.address} />
                </div>
                <div>
                  <InfoRow label="Ville" value={client.city} />
                  <InfoRow label="Code postal" value={client.postalCode} />
                  <InfoRow label="Pays" value={client.country} />
                  <InfoRow label="Type société" value={client.typeSociete || null} />
                  <InfoRow label="Statut" value={statusLabelMap[client.statut] || client.statut} />
                  <InfoRow label="Catégorie" value={client.categorie || null} />
                  <InfoRow label="Solde" value={fmt(client.balance)} />
                  <InfoRow label="Plafond de crédit" value={client.seuilCredit > 0 ? fmt(client.seuilCredit) : null} />
                  {client.seuilCredit > 0 && client.balance >= client.seuilCredit && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b">
                      <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">État plafond</span>
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Plafond atteint
                      </Badge>
                    </div>
                  )}
                  <InfoRow label="Conditions de paiement" value={client.paymentTerms} />
                  <InfoRow label="Notes" value={client.notes} />
                  <InfoRow label="Date de création" value={
                    client.createdAt ? format(new Date(client.createdAt), 'dd MMMM yyyy', { locale: fr }) : null
                  } />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Tab: Devis ── */}
        <TabsContent value="quotes">
          {quotes.loading ? (
            <TabSkeleton />
          ) : quotes.data.length === 0 ? (
            <EmptyState icon={FileText} message="Aucun devis pour ce client" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.data.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDocDialog({ type: 'quote', id: q.id })}>
                      <TableCell className="font-medium font-mono text-sm">{q.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(q.date)}</TableCell>
                      <TableCell><DocStatusBadge status={q.status} config={quoteStatusCfg} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(q.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
        {/* ── Tab: Commandes ── */}
        <TabsContent value="orders">
          {orders.loading ? (
            <TabSkeleton />
          ) : orders.data.length === 0 ? (
            <EmptyState icon={ShoppingCart} message="Aucune commande pour ce client" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.data.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDocDialog({ type: 'order', id: o.id })}>
                      <TableCell className="font-medium font-mono text-sm">{o.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(o.date)}</TableCell>
                      <TableCell><DocStatusBadge status={o.status} config={orderStatusCfg} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(o.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
        {/* ── Tab: Bons de Livraison ── */}
        <TabsContent value="delivery-notes">
          {deliveryNotes.loading ? (
            <TabSkeleton />
          ) : deliveryNotes.data.length === 0 ? (
            <EmptyState icon={Truck} message="Aucun bon de livraison pour ce client" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryNotes.data.map((bl) => (
                    <TableRow key={bl.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDocDialog({ type: 'deliveryNote', id: bl.id })}>
                      <TableCell className="font-medium font-mono text-sm">{bl.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(bl.date)}</TableCell>
                      <TableCell><DocStatusBadge status={bl.status} config={blStatusCfg} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(bl.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
        {/* ── Tab: Factures ── */}
        <TabsContent value="invoices">
          {invoices.loading ? (
            <TabSkeleton />
          ) : invoices.data.length === 0 ? (
            <EmptyState icon={Receipt} message="Aucune facture pour ce client" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDocDialog({ type: 'invoice', id: inv.id })}>
                      <TableCell className="font-medium font-mono text-sm">{inv.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(inv.date)}</TableCell>
                      <TableCell><DocStatusBadge status={inv.status} config={invoiceStatusCfg} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(inv.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
        {/* ── Tab: Avoirs ── */}
        <TabsContent value="credit-notes">
          {creditNotes.loading ? (
            <TabSkeleton />
          ) : creditNotes.data.length === 0 ? (
            <EmptyState icon={RotateCcw} message="Aucun avoir pour ce client" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.data.map((cn) => (
                    <TableRow key={cn.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setDocDialog({ type: 'creditNote', id: cn.id })}>
                      <TableCell className="font-medium font-mono text-sm">{cn.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(cn.date)}</TableCell>
                      <TableCell><DocStatusBadge status={cn.status} config={creditNoteStatusCfg} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(cn.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
        {/* ── Tab: Chantiers ── */}
        <TabsContent value="chantiers">
          <ChantiersTab
            clientId={client.id}
            chantiers={chantiers}
            setChantiers={setChantiers}
            loading={chantiersLoading}
            setLoading={setChantiersLoading}
            onOpenDialog={(chantier, mode) => {
              setChantierDialog(chantier)
              setChantierFormMode(mode)
              setShowChantierDialog(true)
            }}
          />
        </TabsContent>
        {/* ── Tab: Relevé de Compte ── */}
        <TabsContent value="financial">
          <FinancialStatementTab clientId={client.id} />
        </TabsContent>
      </Tabs>
      {/* ── Document Detail Dialog ── */}
      <DocDetailDialog
        docType={docDialog?.type || 'invoice'}
        docId={docDialog?.id || null}
        open={!!docDialog}
        onOpenChange={(open) => { if (!open) setDocDialog(null) }}
      />

      {/* ── Chantier Form Dialog ── */}
      <ChantierFormDialog
        clientId={client.id}
        chantier={chantierDialog}
        mode={chantierFormMode}
        open={showChantierDialog}
        onOpenChange={(open) => {
          if (!open) {
            setChantierDialog(null)
            setShowChantierDialog(false)
            // Re-fetch chantiers after dialog closes
            setChantiersLoading(true)
            api.get<{ chantiers: Chantier[] }>(`/clients/${client.id}/chantiers`)
              .then((res) => setChantiers(res.chantiers || []))
              .catch(() => setChantiers([]))
              .finally(() => setChantiersLoading(false))
          }
        }}
        onSuccess={() => {
          // Re-fetch chantiers
          setChantiersLoading(true)
          api.get<{ chantiers: Chantier[] }>(`/clients/${client.id}/chantiers`)
            .then((res) => setChantiers(res.chantiers || []))
            .catch(() => setChantiers([]))
            .finally(() => setChantiersLoading(false))
        }}
      />
    </div>
  )
}
