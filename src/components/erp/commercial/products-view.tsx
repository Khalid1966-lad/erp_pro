'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import { Plus, Edit, Trash2, Search, Package, ArrowUpDown, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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
  productType: string
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
  productType: 'vente',
  minStock: '',
  maxStock: '',
  isActive: true
}

const productTypeLabels: Record<string, string> = {
  achat: 'Achat',
  vente: 'Vente',
  semi_fini: 'Semi-fini'
}

const productTypeColors: Record<string, string> = {
  achat: 'bg-orange-100 text-orange-800',
  vente: 'bg-green-100 text-green-800',
  semi_fini: 'bg-blue-100 text-blue-800'
}

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [familleFilter, setFamilleFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('reference')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [saving, setSaving] = useState(false)

  // Fetch products from server with search and filters
  const fetchProducts = useCallback(async (searchTerm?: string) => {
    try {
      if (searchTerm !== undefined) {
        setSearching(true)
      } else {
        setLoading(true)
      }
      const params = new URLSearchParams({ limit: '10000', active: 'false' })
      const term = searchTerm !== undefined ? searchTerm : searchRef.current
      if (term) params.set('search', term)
      if (typeFilter) params.set('productType', typeFilter)
      if (familleFilter) params.set('famille', familleFilter)
      const res = await api.get<{ products: Product[], total: number }>(`/products?${params}`)
      setProducts(res.products || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Erreur chargement produits:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des produits.' })
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [typeFilter, familleFilter])

  // Debounced search — only by designation
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProducts(value)
    }, 400)
  }, [fetchProducts])

  // Initial load + re-fetch when type/famille filters change
  useEffect(() => {
    fetchProducts()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchProducts])

  // Client-side sorting only (filtering done server-side)
  const sortedProducts = useMemo(() => {
    const result = [...products]
    result.sort((a, b) => {
      const aVal = String(a[sortField as keyof Product] ?? '')
      const bVal = String(b[sortField as keyof Product] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal, 'fr') : bVal.localeCompare(aVal, 'fr')
    })
    return result
  }, [products, sortField, sortDir])

  // Unique familles from current results
  const familles = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { if (p.famille) set.add(p.famille) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [products])

  // Type counts from displayed products (multi-type support)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { achat: 0, vente: 0, semi_fini: 0 }
    products.forEach(p => {
      p.productType.split(',').forEach(t => {
        const type = t.trim()
        if (counts[type] !== undefined) counts[type]++
      })
    })
    return counts
  }, [products])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
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
      productType: product.productType,
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
        productType: form.productType,
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
      fetchProducts()
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
      fetchProducts()
    } catch (err) {
      console.error('Erreur suppression produit:', err)
      toast.error('Erreur de suppression', { description: 'Impossible de supprimer le produit.' })
    }
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

  if (loading) {
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
            {Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
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
          <Badge variant="secondary">
            {total}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchProducts()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Search — by designation only */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par désignation..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={typeFilter === null && familleFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTypeFilter(null); setFamilleFilter(null) }}
        >
          Tous
        </Button>
        <Button variant={typeFilter === 'achat' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(typeFilter === 'achat' ? null : 'achat')}>
          Achat ({typeCounts.achat})
        </Button>
        <Button variant={typeFilter === 'vente' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(typeFilter === 'vente' ? null : 'vente')}>
          Vente ({typeCounts.vente})
        </Button>
        <Button variant={typeFilter === 'semi_fini' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(typeFilter === 'semi_fini' ? null : 'semi_fini')}>
          Semi-fini ({typeCounts.semi_fini})
        </Button>
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        <Select value={familleFilter ?? '__all__'} onValueChange={(v) => setFamilleFilter(v === '__all__' ? null : v)}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue placeholder="Famille..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les familles</SelectItem>
            {familles.map(f => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table — scrollable with always-visible horizontal scrollbar and sticky header */}
      <Card>
        <CardContent className="p-0">
          <div
            className="overflow-auto scrollbar-visible"
            style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '300px' }}
          >
            <table className="w-full caption-bottom text-sm" style={{ minWidth: 900 }}>
              <thead className="[&_tr]:border-b">
                <tr className="hover:bg-muted/50 border-b transition-colors">
                  <th className="cursor-pointer select-none sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[100px]" onClick={() => toggleSort('reference')}>
                    <div className="flex items-center gap-1">Référence<ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="cursor-pointer select-none sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[200px]" onClick={() => toggleSort('designation')}>
                    <div className="flex items-center gap-1">Désignation<ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[110px]">Famille</th>
                  <th className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[100px]">Type</th>
                  <th className="text-center cursor-pointer select-none sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[90px]" onClick={() => toggleSort('currentStock')}>
                    <div className="flex items-center justify-center gap-1">Stock<ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-center sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap min-w-[60px]">Actif</th>
                  <th className="text-right sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {sortedProducts.length === 0 ? (
                  <tr className="hover:bg-muted/50 border-b transition-colors">
                    <td colSpan={7} className="p-2 align-middle text-center py-8 text-muted-foreground">
                      {search || typeFilter || familleFilter ? 'Aucun produit trouvé.' : 'Aucun produit enregistré.'}
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((product) => {
                    const lowStock = product.minStock !== null && product.minStock > 0 && product.currentStock <= product.minStock
                    return (
                      <tr key={product.id} className={`hover:bg-muted/50 border-b transition-colors cursor-pointer ${!product.isActive ? 'opacity-50' : ''}`} onDoubleClick={() => openEdit(product)}>
                        <td className="p-2 align-middle whitespace-nowrap font-mono text-xs">{product.reference}</td>
                        <td className="p-2 align-middle whitespace-nowrap"><span className="font-medium">{product.designation}</span></td>
                        <td className="p-2 align-middle whitespace-nowrap">
                          <Badge variant="outline" className="font-normal text-xs">{product.famille || '—'}</Badge>
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {product.productType.split(',').map((t) => {
                              const type = t.trim()
                      return type ? (
                        <Badge key={type} variant="secondary" className={productTypeColors[type] || ''}>{productTypeLabels[type] || type}</Badge>
                      ) : null
                    })}
                          </div>
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`font-mono font-medium ${lowStock ? 'text-red-600' : 'text-green-600'}`}>{product.currentStock}</span>
                            {lowStock && <span className="text-xs text-red-400">≤{product.minStock}</span>}
                          </div>
                        </td>
                        <td className="p-2 align-middle whitespace-nowrap text-center"><Switch checked={product.isActive} disabled /></td>
                        <td className="p-2 align-middle whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer le produit</AlertDialogTitle>
                                  <AlertDialogDescription>Êtes-vous sûr de vouloir supprimer <strong>{product.reference} - {product.designation}</strong> ? Cette action est irréversible.</AlertDialogDescription>
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
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent resizable className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto scrollbar-visible max-h-[calc(90vh-8rem)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Classification</h4></div>
            <div className="space-y-2">
              <Label htmlFor="famille">Famille</Label>
              <Input id="famille" list="familles-list" value={form.famille} onChange={(e) => setForm({ ...form, famille: e.target.value })} placeholder="Ex: Électronique, Mécanique..." />
              <datalist id="familles-list">{familles.map(f => <option key={f} value={f} />)}</datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sousFamille">Sous-famille</Label>
              <Input id="sousFamille" value={form.sousFamille} onChange={(e) => setForm({ ...form, sousFamille: e.target.value })} placeholder="Ex: Composants, Pièces..." />
            </div>
            <div className="space-y-2">
              <Label>Type de produit</Label>
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.productType.split(',').includes('vente')}
                    onCheckedChange={(checked) => {
                      const types = form.productType.split(',').filter(t => t.trim() && t.trim() !== 'vente')
                      if (checked) types.push('vente')
                      setForm({ ...form, productType: types.join(',') || 'vente' })
                    }}
                  />
                  <Badge variant="secondary" className={productTypeColors.vente}>Vente</Badge>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.productType.split(',').includes('achat')}
                    onCheckedChange={(checked) => {
                      const types = form.productType.split(',').filter(t => t.trim() && t.trim() !== 'achat')
                      if (checked) types.push('achat')
                      setForm({ ...form, productType: types.join(',') || 'vente' })
                    }}
                  />
                  <Badge variant="secondary" className={productTypeColors.achat}>Achat</Badge>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.productType.split(',').includes('semi_fini')}
                    onCheckedChange={(checked) => {
                      const types = form.productType.split(',').filter(t => t.trim() && t.trim() !== 'semi_fini')
                      if (checked) types.push('semi_fini')
                      setForm({ ...form, productType: types.join(',') || 'vente' })
                    }}
                  />
                  <Badge variant="secondary" className={productTypeColors.semi_fini}>Semi-fini</Badge>
                </label>
              </div>
            </div>
            <div className="md:col-span-2 mt-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Identification</h4></div>
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
            <div className="md:col-span-2 mt-2"><h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Tarification & Stock</h4></div>
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
            <div className="space-y-2">
              <Label htmlFor="minStock">Stock minimum</Label>
              <Input id="minStock" type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStock">Stock maximum</Label>
              <Input id="maxStock" type="number" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} placeholder="0" />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
              <Label>Produit actif</Label>
            </div>
            </div>
            </div>
            <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.reference.trim() || !form.designation.trim() || saving}>{saving ? 'Enregistrement...' : editingProduct ? 'Modifier' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
