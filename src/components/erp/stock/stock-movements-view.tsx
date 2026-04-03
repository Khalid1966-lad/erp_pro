'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ArrowDownLeft, ArrowUpRight, RefreshCw, SlidersHorizontal, Search, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

interface StockMovement {
  id: string
  type: 'in' | 'out' | 'adjustment'
  origin: string
  quantity: number
  unitCost: number
  documentRef: string | null
  notes: string | null
  createdAt: string
  product: {
    id: string
    reference: string
    designation: string
  }
}

interface Product {
  id: string
  reference: string
  designation: string
  currentStock: number
}

const movementTypeLabels: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
}

const movementTypeColors: Record<string, string> = {
  in: 'bg-green-100 text-green-800 border-green-200',
  out: 'bg-red-100 text-red-800 border-red-200',
  adjustment: 'bg-orange-100 text-orange-800 border-orange-200',
}

const originLabels: Record<string, string> = {
  purchase_reception: 'Réception achat',
  production_input: 'Entrée production',
  production_output: 'Sortie production',
  sale: 'Vente',
  return: 'Retour',
  inventory_adjustment: 'Ajustement inventaire',
  manual: 'Manuel',
}

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export default function StockMovementsView() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [originFilter, setOriginFilter] = useState<string>('all')
  const [productIdFilter, setProductIdFilter] = useState<string>('all')

  // Adjustment dialog
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [newQuantity, setNewQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (originFilter !== 'all') params.set('origin', originFilter)
      if (productIdFilter !== 'all') params.set('productId', productIdFilter)

      const data = await api.get<{ movements: StockMovement[]; total: number; page: number; limit: number }>(
        `/stock?${params.toString()}`
      )
      setMovements(data.movements || [])
      setTotal(data.total)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des mouvements')
    } finally {
      setLoading(false)
    }
  }, [page, limit, typeFilter, originFilter, productIdFilter])

  const fetchProducts = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>('/products?limit=500')
      setProducts(data.products || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  const totalPages = Math.ceil(total / limit)

  const handleAdjust = async () => {
    if (!adjustProduct || !newQuantity) return
    try {
      setAdjusting(true)
      await api.put('/stock', {
        productId: adjustProduct.id,
        newQuantity: parseFloat(newQuantity),
        reason: adjustReason || undefined,
      })
      toast.success(`Stock ajusté pour ${adjustProduct.designation}`)
      setAdjustDialogOpen(false)
      setAdjustProduct(null)
      setNewQuantity('')
      setAdjustReason('')
      fetchMovements()
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajustement")
    } finally {
      setAdjusting(false)
    }
  }

  const openAdjustDialog = (product: Product) => {
    setAdjustProduct(product)
    setNewQuantity(product.currentStock.toString())
    setAdjustReason('')
    setAdjustDialogOpen(true)
  }

  if (loading && movements.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Mouvements de stock</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMovements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setAdjustDialogOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            Ajustement manuel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="in">Entrée</SelectItem>
                  <SelectItem value="out">Sortie</SelectItem>
                  <SelectItem value="adjustment">Ajustement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={originFilter} onValueChange={(v) => { setOriginFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Origine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les origines</SelectItem>
                <SelectItem value="purchase_reception">Réception achat</SelectItem>
                <SelectItem value="production_input">Entrée production</SelectItem>
                <SelectItem value="production_output">Sortie production</SelectItem>
                <SelectItem value="sale">Vente</SelectItem>
                <SelectItem value="return">Retour</SelectItem>
                <SelectItem value="inventory_adjustment">Ajustement inventaire</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productIdFilter} onValueChange={(v) => { setProductIdFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[220px]">
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

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Type</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="hidden md:table-cell">Origine</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Coût unit.</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Valeur totale</TableHead>
                    <TableHead className="hidden xl:table-cell">Réf. doc.</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Aucun mouvement de stock trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="outline" className={movementTypeColors[m.type]}>
                            {m.type === 'in' && <ArrowDownLeft className="h-3 w-3 mr-1 inline" />}
                            {m.type === 'out' && <ArrowUpRight className="h-3 w-3 mr-1 inline" />}
                            {movementTypeLabels[m.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-mono text-sm">{m.product.reference}</span>
                            <span className="ml-2">{m.product.designation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {originLabels[m.origin] || m.origin}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={m.type === 'in' ? 'text-green-700' : m.type === 'out' ? 'text-red-700' : 'text-orange-700'}>
                            {m.type === 'out' ? '-' : '+'}{m.quantity.toLocaleString('fr-FR')}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-muted-foreground">
                          {formatCurrency(m.unitCost)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-medium">
                          {formatCurrency(m.quantity * m.unitCost)}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell font-mono text-xs">
                          {m.documentRef || '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-32 truncate">
                          {m.notes || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
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
            {(page - 1) * limit + 1} - {Math.min(page * limit, total)} sur {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Manual Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              Ajustement manuel de stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produit *</Label>
              <Select
                value={adjustProduct?.id || ''}
                onValueChange={(v) => {
                  const p = products.find((pr) => pr.id === v)
                  if (p) openAdjustDialog(p)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.reference} - {p.designation} (stock: {p.currentStock.toLocaleString('fr-FR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {adjustProduct && (
              <>
                <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{adjustProduct.designation}</p>
                    <p className="text-sm text-muted-foreground">
                      Stock actuel : <span className="font-mono font-bold">{adjustProduct.currentStock.toLocaleString('fr-FR')}</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nouvelle quantité *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="Nouvelle quantité..."
                  />
                  {newQuantity && adjustProduct && (
                    <p className="text-sm text-muted-foreground">
                      Différence :{' '}
                      <span className={`font-mono font-medium ${parseFloat(newQuantity) > adjustProduct.currentStock ? 'text-green-600' : parseFloat(newQuantity) < adjustProduct.currentStock ? 'text-red-600' : ''}`}>
                        {(parseFloat(newQuantity) - adjustProduct.currentStock) >= 0 ? '+' : ''}
                        {(parseFloat(newQuantity) - adjustProduct.currentStock).toLocaleString('fr-FR')}
                      </span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Raison de l&apos;ajustement</Label>
                  <Input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Raison (optionnelle)..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdjustDialogOpen(false); setAdjustProduct(null) }}>
              Annuler
            </Button>
            <Button onClick={handleAdjust} disabled={!adjustProduct || !newQuantity || adjusting}>
              {adjusting ? 'Ajustement...' : 'Appliquer l\'ajustement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
