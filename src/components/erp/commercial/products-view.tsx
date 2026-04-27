'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Separator } from '@/components/ui/separator'
import {
  Plus, Edit, Trash2, Search, Package, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers, Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Product {
  id: string
  reference: string
  designation: string
  description: string | null
  famille: string | null
  sousFamille: string | null
  priceHT: number
  tvaRate: number
  unit: string | null
  productNature: string
  productUsage: string
  isStockable: boolean
  minStock: number | null
  maxStock: number | null
  currentStock: number
  isActive: boolean
  createdAt: string
}

const emptyProduct = {
  reference: '',
  designation: '',
  description: '',
  famille: '',
  sousFamille: '',
  priceHT: '',
  tvaRate: '20',
  unit: 'unité',
  productNature: 'produit_fini',
  productUsage: 'vente',
  isStockable: true,
  minStock: '',
  maxStock: '',
  isActive: true
}

const natureLabels: Record<string, string> = {
  matiere_premiere: 'Matière première',
  semi_fini: 'Semi-fini',
  produit_fini: 'Produit fini',
  service: 'Service'
}

const natureColors: Record<string, string> = {
  matiere_premiere: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  semi_fini: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  produit_fini: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  service: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
}

const usageLabels: Record<string, string> = {
  achat: 'Achat',
  vente: 'Vente'
}

const usageColors: Record<string, string> = {
  achat: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  vente: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export default function ProductsView() {
  // ── Data state ──
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [allFamilles, setAllFamilles] = useState<string[]>([])

  // ── UI state ──
  const [searchInput, setSearchInput] = useState('')           // immediate input value
  const [debouncedSearch, setDebouncedSearch] = useState('')   // debounced value for API
  const [searching, setSearching] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [familleFilter, setFamilleFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState('reference')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [saving, setSaving] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Lots dialog state ──
  const [lotsDialogOpen, setLotsDialogOpen] = useState(false)
  const [lotsProduct, setLotsProduct] = useState<Product | null>(null)
  const [lotsData, setLotsData] = useState<any[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)

  // ── Fetch distinct familles (lightweight, once) ──
  useEffect(() => {
    api.get('/products/familles')
      .then(res => setAllFamilles((res as unknown as { familles: string[] }).familles || []))
      .catch(() => {
        api.get('/products?limit=10000&active=false')
          .then(res => {
            const s = new Set<string>()
            ;((res as { products?: { famille: string | null }[] }).products || []).forEach(p => { if (p.famille) s.add(p.famille) })
            setAllFamilles(Array.from(s).sort((a, b) => a.localeCompare(b, 'fr')))
          })
          .catch(() => {})
      })
  }, [])

  // ── Debounce search input ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchInput) {
      setDebouncedSearch('')
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setSearching(false)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  // ── Main fetch: triggers on any query param change ──
  useEffect(() => {
    const controller = new AbortController()
    const doFetch = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          active: 'false',
          sortField,
          sortDir,
        })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (typeFilter) params.set('productNature', typeFilter)
        if (familleFilter) params.set('famille', familleFilter)
        const res = await api.get<{ products: Product[]; total: number; page: number; totalPages: number }>(
          `/products?${params}`,
          { signal: controller.signal }
        )
        if (!controller.signal.aborted) {
          setProducts(res.products || [])
          setTotal(res.total || 0)
          setTotalPages(res.totalPages || 1)
          setPage(res.page || page)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Erreur chargement produits:', err)
        toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des produits.' })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    doFetch()
    return () => controller.abort()
  }, [debouncedSearch, typeFilter, familleFilter, sortField, sortDir, page, pageSize, fetchKey])

  // ── Handlers ──
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const changeTypeFilter = (val: string | null) => {
    setTypeFilter(val)
    setFamilleFilter(null)
    setPage(1)
  }

  const changeFamilleFilter = (val: string | null) => {
    setFamilleFilter(val)
    setPage(1)
  }

  const changePageSize = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages))
    if (clamped !== page) setPage(clamped)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
  }

  const openCreate = () => {
    setEditingProduct(null)
    setForm(emptyProduct)
    setDialogOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      reference: product.reference,
      designation: product.designation,
      description: product.description || '',
      famille: product.famille || '',
      sousFamille: product.sousFamille || '',
      priceHT: product.priceHT.toString(),
      tvaRate: product.tvaRate.toString(),
      unit: product.unit || 'unité',
      productNature: product.productNature,
      productUsage: product.productUsage,
      isStockable: product.isStockable,
      minStock: product.minStock?.toString() || '',
      maxStock: product.maxStock?.toString() || '',
      isActive: product.isActive
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.reference.trim() || !form.designation.trim()) return
    try {
      setSaving(true)
      const body = {
        reference: form.reference.trim(),
        designation: form.designation.trim(),
        description: form.description || null,
        famille: form.famille.trim() || null,
        sousFamille: form.sousFamille.trim() || null,
        priceHT: parseFloat(form.priceHT),
        tvaRate: parseFloat(form.tvaRate),
        unit: form.unit || null,
        productNature: form.productNature,
        productUsage: form.productUsage,
        isStockable: form.isStockable,
        minStock: form.minStock ? parseInt(form.minStock) : null,
        maxStock: form.maxStock ? parseInt(form.maxStock) : null,
        isActive: form.isActive
      }
      if (editingProduct) {
        await api.put('/products', { id: editingProduct.id, ...body })
        toast.success('Produit modifié', { description: `${body.designation} a été mis à jour.` })
      } else {
        await api.post('/products', body)
        toast.success('Produit créé', { description: `${body.designation} a été ajouté.` })
      }
      setDialogOpen(false)
      // Trigger re-fetch
      setPage(1)
      setFetchKey(k => k + 1)
      // Fetch familles in case new ones were added
      api.get('/products/familles')
        .then(res => setAllFamilles((res as unknown as { familles: string[] }).familles || []))
        .catch(() => {})
    } catch (err) {
      console.error('Erreur sauvegarde produit:', err)
      toast.error('Erreur de sauvegarde', { description: 'Impossible de sauvegarder le produit.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/products?id=${id}`)
      toast.success('Produit supprimé', { description: 'Le produit a été supprimé avec succès.' })
      setPage(1)
      setFetchKey(k => k + 1)
    } catch (err) {
      console.error('Erreur suppression produit:', err)
      toast.error('Erreur de suppression', { description: 'Impossible de supprimer le produit.' })
    }
  }

  const fetchProductLots = useCallback(async (productId: string) => {
    try {
      setLotsLoading(true)
      const data = await api.get<{ lots: any[] }>(`/lots?productId=${productId}&limit=100`)
      setLotsData(data.lots || [])
    } catch {
      setLotsData([])
    } finally {
      setLotsLoading(false)
    }
  }, [])

  const openLotsDialog = (product: Product) => {
    setLotsProduct(product)
    setLotsDialogOpen(true)
    fetchProductLots(product.id)
  }

  // ── Computed ──
  const fromItem = total > 0 ? (page - 1) * pageSize + 1 : 0
  const toItem = Math.min(page * pageSize, total)

  // ── Loading skeleton ──
  if (loading && products.length === 0) {
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-24" />)}
        </div>
        <Card className="overflow-hidden">
          <div className="space-y-3 p-4">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Produits</h2>
          <Badge variant="secondary">{total.toLocaleString('fr-FR')}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setPage(1); setFetchKey(k => k + 1) }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par référence ou désignation..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={!typeFilter ? 'default' : 'outline'} size="sm" onClick={() => changeTypeFilter(null)}>
          Tous
        </Button>
        {(['matiere_premiere', 'semi_fini', 'produit_fini', 'service'] as const).map(nature => (
          <Button key={nature} variant={typeFilter === nature ? 'default' : 'outline'} size="sm"
            onClick={() => changeTypeFilter(typeFilter === nature ? null : nature)}>
            {natureLabels[nature]}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        <Select value={familleFilter ?? '__all__'} onValueChange={(v) => changeFamilleFilter(v === '__all__' ? null : v)}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue placeholder="Famille..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les familles</SelectItem>
            {allFamilles.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto scrollbar-visible" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: '300px' }}>
            <table className="w-full caption-bottom text-sm" style={{ minWidth: 900 }}>
              <thead className="[&_tr]:border-b">
                <tr className="hover:bg-muted/50 border-b transition-colors">
                  {[
                    { key: 'reference', label: 'Référence' },
                    { key: 'designation', label: 'Désignation' },
                    { key: 'famille', label: 'Famille' },
                  ].map(col => (
                    <th key={col.key} className="cursor-pointer select-none sticky top-0 bg-muted/80 dark:bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[100px]"
                      onClick={() => toggleSort(col.key)}>
                      <div className="flex items-center gap-1">{col.label} <SortIcon field={col.key} /></div>
                    </th>
                  ))}
                  <th className="sticky top-0 bg-muted/80 dark:bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[100px]">Type</th>
                  <th className="text-center cursor-pointer select-none sticky top-0 bg-muted/80 dark:bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[90px]"
                    onClick={() => toggleSort('currentStock')}>
                    <div className="flex items-center justify-center gap-1">Stock <SortIcon field="currentStock" /></div>
                  </th>
                  <th className="text-center sticky top-0 bg-muted/80 dark:bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[60px]">Actif</th>
                  <th className="text-right sticky top-0 bg-muted/80 dark:bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {products.length === 0 ? (
                  <tr className="hover:bg-muted/50 border-b transition-colors">
                    <td colSpan={7} className="p-2 align-middle text-center py-8 text-muted-foreground">
                      {debouncedSearch || typeFilter || familleFilter ? 'Aucun produit trouvé.' : 'Aucun produit enregistré.'}
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const lowStock = product.minStock !== null && product.minStock > 0 && product.currentStock <= product.minStock
                    return (
                      <tr key={product.id}
                        className={`hover:bg-muted/50 border-b transition-colors cursor-pointer table-row-hover ${!product.isActive ? 'opacity-50' : ''}`}
                        onDoubleClick={() => openEdit(product)}>
                        <td className="p-2 align-middle whitespace-nowrap font-mono text-xs">{product.reference}</td>
                        <td className="p-2 align-middle whitespace-nowrap"><span className="font-medium">{product.designation}</span></td>
                        <td className="p-2 align-middle whitespace-nowrap">
                          <Badge variant="outline" className="font-normal text-xs">{product.famille || '—'}</Badge>
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className={natureColors[product.productNature] || ''}>
                              {natureLabels[product.productNature] || product.productNature}
                            </Badge>
                            {product.productUsage.split(',').map((u) => {
                              const usage = u.trim()
                              return usage ? (
                                <Badge key={usage} variant="outline" className={usageColors[usage] || ''}>{usageLabels[usage] || usage}</Badge>
                              ) : null
                            })}
                          </div>
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap text-center">
                          {product.isStockable ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className={`font-mono font-medium ${lowStock ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{product.currentStock}</span>
                              {lowStock && <span className="text-xs text-red-400">≤{product.minStock}</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap text-center">
                          <Switch checked={product.isActive} disabled />
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {product.isStockable && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700" onClick={() => openLotsDialog(product)} title="Voir les lots">
                                <Layers className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
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
                                  <AlertDialogTitle>Supprimer le produit</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer <strong>{product.reference} - {product.designation}</strong> ? Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {loading && products.length > 0 && (
              <div className="flex items-center justify-center py-3 border-t">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Chargement...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{fromItem.toLocaleString('fr-FR')}–{toItem.toLocaleString('fr-FR')} sur {total.toLocaleString('fr-FR')}</span>
            <Select value={String(pageSize)} onValueChange={(v) => changePageSize(parseInt(v))}>
              <SelectTrigger className="w-[70px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => (
                  <SelectItem key={s} value={String(s)}>{s}/p</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => goToPage(1)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {generatePageButtons(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
              ) : (
                <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs"
                  onClick={() => goToPage(p as number)}>{p}</Button>
              )
            )}
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => goToPage(totalPages)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent resizable className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto scrollbar-visible max-h-[calc(90vh-8rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b border-border pb-2">Classification</h4></div>
              <div className="space-y-2">
                <Label htmlFor="famille">Famille</Label>
                <Input id="famille" list="familles-list" value={form.famille} onChange={(e) => setForm({ ...form, famille: e.target.value })} placeholder="Ex: Électronique, Mécanique..." />
                <datalist id="familles-list">{allFamilles.map(f => <option key={f} value={f} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sousFamille">Sous-famille</Label>
                <Input id="sousFamille" value={form.sousFamille} onChange={(e) => setForm({ ...form, sousFamille: e.target.value })} placeholder="Ex: Composants, Pièces..." />
              </div>
              <div className="space-y-2">
                <Label>Nature du produit</Label>
                <Select value={form.productNature} onValueChange={(v) => setForm({ ...form, productNature: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produit_fini">Produit fini (vendable)</SelectItem>
                    <SelectItem value="matiere_premiere">Matière première</SelectItem>
                    <SelectItem value="semi_fini">Semi-fini (intermédiaire)</SelectItem>
                    <SelectItem value="service">Service / Prestation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Usage commercial</Label>
                <div className="flex items-center gap-4 mt-1">
                  {(['vente', 'achat'] as const).map(u => (
                    <label key={u} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={form.productUsage.split(',').includes(u)}
                        onCheckedChange={(checked) => {
                          const usages = form.productUsage.split(',').filter(x => x.trim() && x.trim() !== u)
                          if (checked) usages.push(u)
                          setForm({ ...form, productUsage: usages.join(',') || 'vente' })
                        }}
                      />
                      <Badge variant="outline" className={usageColors[u]}>{usageLabels[u]}</Badge>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Gestion de stock</Label>
                <div className="flex items-center gap-3">
                  <Switch checked={form.isStockable} onCheckedChange={(checked) => setForm({ ...form, isStockable: checked })} />
                  <span className="text-sm">{form.isStockable ? 'Produit stockable' : 'Non stockable (service)'}</span>
                </div>
              </div>
              <div className="md:col-span-2 mt-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b border-border pb-2">Identification</h4></div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence *</Label>
                <Input id="reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="REF-001" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Désignation *</Label>
                <Input id="designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Nom du produit" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description du produit" />
              </div>
              <div className="md:col-span-2 mt-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b border-border pb-2">Tarification & Stock</h4></div>
              <div className="space-y-2">
                <Label htmlFor="priceHT">Prix HT (MAD) *</Label>
                <Input id="priceHT" type="number" step="0.01" value={form.priceHT} onChange={(e) => setForm({ ...form, priceHT: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tvaRate">Taux TVA (%)</Label>
                <Select value={form.tvaRate} onValueChange={(v) => setForm({ ...form, tvaRate: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem><SelectItem value="7">7%</SelectItem><SelectItem value="10">10%</SelectItem><SelectItem value="14">14%</SelectItem><SelectItem value="20">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unité</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unité">Unité</SelectItem><SelectItem value="kg">Kg</SelectItem><SelectItem value="litre">Litre</SelectItem><SelectItem value="mètre">Mètre</SelectItem><SelectItem value="m²">M²</SelectItem><SelectItem value="m³">M³</SelectItem><SelectItem value="palette">Palette</SelectItem><SelectItem value="lot">Lot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.isStockable && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Stock minimum</Label>
                    <Input id="minStock" type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStock">Stock maximum</Label>
                    <Input id="maxStock" type="number" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} placeholder="0" />
                  </div>
                </>
              )}
              <div className="flex items-center gap-3 md:col-span-2">
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                <Label>Produit actif</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.reference.trim() || !form.designation.trim() || saving}>
              {saving ? 'Enregistrement...' : editingProduct ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Lots Dialog */}
      <Dialog open={lotsDialogOpen} onOpenChange={setLotsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              Lots de stock — {lotsProduct?.reference} - {lotsProduct?.designation}
            </DialogTitle>
          </DialogHeader>
          {lotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Chargement des lots...</span>
            </div>
          ) : lotsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Aucun lot de stock pour ce produit.</p>
              <p className="text-xs mt-1">Les lots sont créés automatiquement lors de la clôture des ordres de fabrication.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Total lots</p>
                  <p className="text-lg font-bold">{lotsData.length}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="text-lg font-bold text-green-600">{lotsData.reduce((s, l) => s + (l.qtyDisponible || 0), 0)}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Réservé</p>
                  <p className="text-lg font-bold text-orange-600">{lotsData.reduce((s, l) => s + (l.qtyReservee || 0), 0)}</p>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Physique</p>
                  <p className="text-lg font-bold">{lotsData.reduce((s, l) => s + (l.qtyPhysique || 0), 0)}</p>
                </div>
              </div>

              {/* Lots table */}
              <div className="rounded border overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="[&_tr]:border-b bg-muted/50">
                    <tr>
                      <th className="p-2 text-left text-xs font-medium">N° Lot</th>
                      <th className="p-2 text-right text-xs font-medium">Qté initiale</th>
                      <th className="p-2 text-right text-xs font-medium">Disponible</th>
                      <th className="p-2 text-right text-xs font-medium">Réservé</th>
                      <th className="p-2 text-right text-xs font-medium">Physique</th>
                      <th className="p-2 text-center text-xs font-medium">Statut</th>
                      <th className="p-2 text-left text-xs font-medium">OF source</th>
                      <th className="p-2 text-left text-xs font-medium">Date fabr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotsData.map((lot: any) => (
                      <tr key={lot.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{lot.numeroLot}</td>
                        <td className="p-2 text-right text-xs">{lot.quantiteInitiale}</td>
                        <td className={`p-2 text-right text-xs font-medium ${(lot.qtyDisponible || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{lot.qtyDisponible || 0}</td>
                        <td className={`p-2 text-right text-xs ${(lot.qtyReservee || 0) > 0 ? 'text-orange-600 font-medium' : ''}`}>{lot.qtyReservee || 0}</td>
                        <td className="p-2 text-right text-xs">{lot.qtyPhysique || 0}</td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={
                            lot.statut === 'actif' ? 'bg-green-100 text-green-800 border-green-200' :
                            lot.statut === 'epuise' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                            lot.statut === 'bloque' ? 'bg-red-100 text-red-800 border-red-200' :
                            'bg-amber-100 text-amber-800 border-amber-200'
                          }>
                            {lot.statut === 'actif' ? 'Actif' : lot.statut === 'epuise' ? 'Épuisé' : lot.statut === 'bloque' ? 'Bloqué' : 'Expiré'}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{lot.workOrder?.number || '-'}</td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {lot.dateFabrication ? format(new Date(lot.dateFabrication), 'dd/MM/yyyy', { locale: fr }) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function generatePageButtons(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
