'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductCombobox } from '@/components/erp/shared/product-combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Network, Plus, Trash2, RefreshCw, Search } from 'lucide-react'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

interface Product {
  id: string
  reference: string
  designation: string
  currentStock: number
  unit: string
  productNature: string
}

interface BomComponent {
  id: string
  bomId: string
  componentId: string
  quantity: number
  notes: string | null
  bom: { id: string; reference: string; designation: string }
  component: {
    id: string
    reference: string
    designation: string
    currentStock: number
    unit: string
  }
}

export default function BomView() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [components, setComponents] = useState<BomComponent[]>([])
  const [materials, setMaterials] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  // Add component form
  const [newComponentId, setNewComponentId] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')
  const [newNotes, setNewNotes] = useState('')
  const [searchMaterial, setSearchMaterial] = useState('')

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{ products: Product[] }>('/products?productUsage=vente&dropdown=true')
      setProducts(res.products || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des produits')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchComponents = useCallback(async (productId: string) => {
    if (!productId) {
      setComponents([])
      return
    }
    try {
      setLoadingComponents(true)
      const res = await api.get<{ boms: BomComponent[] }>(`/production/bom?productId=${productId}`)
      setComponents(res.boms || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des composants')
    } finally {
      setLoadingComponents(false)
    }
  }, [])

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get<{ products: Product[] }>('/products?limit=500&active=false')
      const filtered = (res.products || []).filter(
        (p) => p.productNature === 'matiere_premiere' || p.productNature === 'semi_fini'
      )
      setMaterials(filtered)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des matières')
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchMaterials()
  }, [fetchProducts, fetchMaterials])

  useEffect(() => {
    fetchComponents(selectedProductId)
  }, [selectedProductId, fetchComponents])

  const handleAddComponent = async () => {
    if (!selectedProductId || !newComponentId || !newQuantity) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    try {
      setAdding(true)
      await api.post('/production/bom', {
        bomId: selectedProductId,
        componentId: newComponentId,
        quantity: parseFloat(newQuantity),
        notes: newNotes || undefined,
      })
      toast.success('Composant ajouté avec succès')
      setAddDialogOpen(false)
      setNewComponentId('')
      setNewQuantity('1')
      setNewNotes('')
      fetchComponents(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout du composant")
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveComponent = async (id: string) => {
    try {
      await api.delete(`/production/bom?id=${id}`)
      toast.success('Composant supprimé')
      fetchComponents(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase()
    if (!q.trim()) return products
    return products.filter(p =>
      p.reference.toLowerCase().includes(q) ||
      p.designation.toLowerCase().includes(q)
    )
  }, [products, productSearch])

  const filteredMaterials = materials.filter(
    (m) =>
      m.id !== selectedProductId &&
      (m.reference.toLowerCase().includes(searchMaterial.toLowerCase()) ||
        m.designation.toLowerCase().includes(searchMaterial.toLowerCase()))
  )

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  return (
    <div className="space-y-6">
      {/* Product selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5" />
            Sélection du produit fini
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label>Produit fini</Label>
              <div className="mt-1">
                <ProductCombobox
                  products={filteredProducts}
                  value={selectedProductId}
                  loading={loading}
                  searchValue={productSearch}
                  onSearchChange={setProductSearch}
                  onSelect={setSelectedProductId}
                  placeholder="Rechercher un produit fini..."
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="icon" onClick={fetchProducts} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components list */}
      {selectedProduct && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Nomenclature : {selectedProduct.reference} - {selectedProduct.designation}
            </CardTitle>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un composant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un composant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Recherche</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Référence ou désignation..."
                        value={searchMaterial}
                        onChange={(e) => setSearchMaterial(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Composant *</Label>
                    <Select value={newComponentId} onValueChange={setNewComponentId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner un composant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredMaterials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            [{m.productNature === 'matiere_premiere' ? 'Achat' : 'Semi-fini'}]{' '}
                            {m.reference} - {m.designation} (stock: {m.currentStock.toLocaleString('fr-FR')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantité *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Notes optionnelles..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleAddComponent} disabled={adding}>
                      {adding ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingComponents ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : components.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Aucun composant dans la nomenclature</p>
                <p className="text-sm">Ajoutez des matières premières ou semi-finis</p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Référence</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="w-[100px] text-right">Quantité</TableHead>
                        <TableHead className="w-[80px]">Unité</TableHead>
                        <TableHead className="w-[100px] text-right">Stock</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((comp) => (
                        <TableRow key={comp.id}>
                          <TableCell className="font-mono text-sm">
                            {comp.component.reference}
                          </TableCell>
                          <TableCell>{comp.component.designation}</TableCell>
                          <TableCell className="text-right font-medium">
                            {comp.quantity.toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell>{comp.component.unit}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={comp.component.currentStock > 0 ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {comp.component.currentStock.toLocaleString('fr-FR')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {comp.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer le composant</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir retirer{' '}
                                    <strong>{comp.component.designation}</strong> de la nomenclature ?
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveComponent(comp.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
