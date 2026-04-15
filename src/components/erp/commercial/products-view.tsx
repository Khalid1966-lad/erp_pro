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
import { Separator } from '@/components/ui/separator'
import { Plus, Edit, Trash2, Search, Package, Filter, ArrowUpDown, RefreshCw } from 'lucide-react'
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
  productType: 'achat' | 'vente' | 'semi_fini'
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
  productType: 'vente' as const,
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
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
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

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProductsBySearch(value)
    }, 300)
  }, [])

  const fetchProductsBySearch = useCallback(async (searchTerm: string) => {
    try {
      const params = new URLSearchParams({ limit: '10000', active: 'false' })
      if (searchTerm) params.set('search', searchTerm)
      const res = await api.get<{ products: Product[], total: number }>(`/products?${params}`)
      setAllProducts(res.products || [])
    } catch (err) {
      console.error('Erreur recherche produits:', err)
    }
  }, [])

  // Fetch ALL products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '10000', active: 'false' })
      if (searchRef.current) params.set('search', searchRef.current)
      const res = await api.get<{ products: Product[], total: number }>(`/products?${params}`)
      setAllProducts(res.products || [])
    } catch (err) {
      console.error('Erreur chargement produits:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des produits.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchProducts])

  // Client-side filters + sorting
  const filteredProducts = useMemo(() => {
    let result = [...allProducts]
    if (typeFilter) result = result.filter(p => p.productType === typeFilter)
    if (familleFilter) result = result.filter(p => p.famille === familleFilter)
    result.sort((a, b) => {
      const aVal = String(a[sortField as keyof Product] ?? '')
      const bVal = String(b[sortField as keyof Product] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal, 'fr') : bVal.localeCompare(aVal, 'fr')
    })
    return result
  }, [allProducts, typeFilter, familleFilter, sortField, sortDir])

  // Unique familles
  const familles = useMemo(() => {
    const set = new Set<string>()
    allProducts.forEach(p => { if (p.famille) set.add(p.famille) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allProducts])

  // Counts by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { achat: 0, vente: 0, semi_fini: 0 }
    allProducts.forEach(p => { if (counts[p.productType] !== undefined) counts[p.productType]++ })
    return counts
  }, [allProducts])

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
            {filteredProducts.length}
            {filteredProducts.length !== allProducts.length ? `/${allProducts.length}` : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            <RefreshCw className="h-4 w-4" />
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
          placeholder="Rechercher par référence, désignation, famille..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
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

      {/* Table — scrollable with native scrollbar (like clients) */}
      <Card>
        <CardContent className="p-0">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '300px' }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('reference')}
                  >
                    <div className="flex items-center gap-1">
                      Référence
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort('designation')}
                  >
                    <div className="flex items-center gap-1">
                      Désignation
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Famille</TableHead>
                  <TableHead className="hidden xl:table-cell">Sous-famille</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort('priceHT')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Prix HT
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="hidden sm:table-cell text-center cursor-pointer select-none"
                    onClick={() => toggleSort('currentStock')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Stock
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">TVA</TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Actif</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {search || typeFilter || familleFilter ? 'Aucun produit trouvé.' : 'Aucun produit enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const lowStock = product.minStock !== null && product.minStock > 0 && product.currentStock <= product.minStock
                    return (
                      <TableRow key={product.id} className={!product.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-mono text-xs">{product.reference}</TableCell>
                        <TableCell>
                          <span className="font-medium">{product.designation}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {product.famille ? (
                            <Badge variant="outline" className="font-normal text-xs">{product.famille}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">
                          {product.sousFamille || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className={productTypeColors[product.productType]}>
                            {productTypeLabels[product.productType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt(product.priceHT)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`font-mono font-medium ${lowStock ? 'text-red-600' : 'text-green-600'}`}>
                              {product.currentStock}
                            </span>
                            {lowStock && (
                              <span className="text-xs text-red-400">≤{product.minStock}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{product.tvaRate}%</TableCell>
                        <TableCell className="hidden lg:table-cell text-center">
                          <Switch checked={product.isActive} disabled />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                                    Êtes-vous sûr de vouloir supprimer <strong>{product.reference} - {product.designation}</strong> ?
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Classification */}
            <div className="md:col-span-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Classification</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="famille">Famille</Label>
              <Input id="famille" list="familles-list" value={form.famille} onChange={(e) => setForm({ ...form, famille: e.target.value })} placeholder="Ex: Électronique, Mécanique..." />
              <datalist id="familles-list">
                {familles.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sousFamille">Sous-famille</Label>
              <Input id="sousFamille" value={form.sousFamille} onChange={(e) => setForm({ ...form, sousFamille: e.target.value })} placeholder="Ex: Composants, Pièces..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productType">Type de produit</Label>
              <Select value={form.productType} onValueChange={(v) => setForm({ ...form, productType: v as Product['productType'] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vente">Vente (produit en vente)</SelectItem>
                  <SelectItem value="achat">Achat (produit acheté)</SelectItem>
                  <SelectItem value="semi_fini">Semi-fini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Identification */}
            <div className="md:col-span-2 mt-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Identification</h4>
            </div>
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
            {/* Tarification & Stock */}
            <div className="md:col-span-2 mt-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Tarification & Stock</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceHT">Prix HT (MAD) *</Label>
              <Input id="priceHT" type="number" step="0.01" value={form.priceHT} onChange={(e) => setForm({ ...form, priceHT: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tvaRate">Taux TVA (%)</Label>
              <Select value={form.tvaRate} onValueChange={(v) => setForm({ ...form, tvaRate: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="7">7%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="14">14%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unité</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unité">Unité</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="litre">Litre</SelectItem>
                  <SelectItem value="mètre">Mètre</SelectItem>
                  <SelectItem value="m²">M²</SelectItem>
                  <SelectItem value="m³">M³</SelectItem>
                  <SelectItem value="palette">Palette</SelectItem>
                  <SelectItem value="lot">Lot</SelectItem>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.reference.trim() || !form.designation.trim() || saving}>
              {saving ? 'Enregistrement...' : editingProduct ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
