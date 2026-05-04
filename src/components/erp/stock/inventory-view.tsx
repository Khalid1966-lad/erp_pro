'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
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
import {
  ClipboardList, Plus, Trash2, RefreshCw, Eye, CheckCircle2, Search, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

interface Product {
  id: string
  reference: string
  designation: string
  currentStock: number
  unit: string
  averageCost: number
}

interface InventoryLine {
  id: string
  productId: string
  systemQty: number
  physicalQty: number
  difference: number
  unitCost: number
  notes: string | null
  product: {
    id: string
    reference: string
    designation: string
  }
}

interface Inventory {
  id: string
  number: string
  type: 'tournant' | 'complet' | 'exceptionnel'
  status: 'en_cours' | 'termine'
  startedAt: string
  completedAt: string | null
  lines: InventoryLine[]
}

interface NewLine {
  productId: string
  systemQty: number
  physicalQty: string
  unitCost: string
  notes: string
  product?: Product
}

const inventoryTypeLabels: Record<string, string> = {
  tournant: 'Tournant',
  complet: 'Complet',
  exceptionnel: 'Exceptionnel',
}

const inventoryTypeColors: Record<string, string> = {
  tournant: 'bg-blue-100 text-blue-800',
  complet: 'bg-purple-100 text-purple-800',
  exceptionnel: 'bg-amber-100 text-amber-800',
}

const inventoryStatusLabels: Record<string, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
}

const inventoryStatusColors: Record<string, string> = {
  en_cours: 'bg-orange-100 text-orange-800',
  termine: 'bg-green-100 text-green-800',
}

const formatCurrency = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

export default function InventoryView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newType, setNewType] = useState<string>('tournant')
  const [newNotes, setNewNotes] = useState('')
  const [newLines, setNewLines] = useState<NewLine[]>([])
  const [creating, setCreating] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null)
  const [validating, setValidating] = useState(false)

  const fetchInventories = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', page.toString())
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const data = await api.get<{ inventories: Inventory[]; total: number; page: number; limit: number }>(
        `/stock/inventory?${params.toString()}`
      )
      setInventories(data.inventories || [])
      setTotal(data.total)
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des inventaires')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

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
    fetchInventories()
  }, [fetchInventories])

  const totalPages = Math.ceil(total / 50)

  const handleAddLine = () => {
    const product = products.find((p) => p.id === selectedProductId)
    if (!product) return
    if (newLines.some((l) => l.productId === product.id)) {
      toast.error('Ce produit est déjà dans la liste')
      return
    }
    setNewLines([
      ...newLines,
      {
        productId: product.id,
        systemQty: product.currentStock,
        physicalQty: product.currentStock.toString(),
        unitCost: product.averageCost.toString(),
        notes: '',
        product,
      },
    ])
    setAddLineOpen(false)
    setSelectedProductId('')
    setSearchProduct('')
  }

  const handleRemoveLine = (idx: number) => {
    setNewLines(newLines.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (newLines.length === 0) {
      toast.error('Ajoutez au moins une ligne')
      return
    }
    try {
      setCreating(true)
      await api.post('/stock/inventory', {
        type: newType,
        notes: newNotes || undefined,
        lines: newLines.map((l) => ({
          productId: l.productId,
          systemQty: l.systemQty,
          physicalQty: parseFloat(l.physicalQty) || 0,
          unitCost: parseFloat(l.unitCost) || 0,
          notes: l.notes || undefined,
        })),
      })
      toast.success('Inventaire créé avec succès')
      setCreateOpen(false)
      setNewLines([])
      setNewNotes('')
      setNewType('tournant')
      fetchInventories()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création")
    } finally {
      setCreating(false)
    }
  }

  const handleValidate = async () => {
    if (!selectedInventory) return
    try {
      setValidating(true)
      await api.put('/stock/inventory', {
        id: selectedInventory.id,
        action: 'validate',
      })
      toast.success('Inventaire validé — ajustements de stock appliqués')
      setDetailOpen(false)
      fetchInventories()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation')
    } finally {
      setValidating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/stock/inventory?id=${id}`)
      toast.success('Inventaire supprimé')
      fetchInventories()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const openDetail = (inv: Inventory) => {
    setSelectedInventory(inv)
    setDetailOpen(true)
  }

  const filteredProducts = products.filter(
    (p) =>
      !newLines.some((l) => l.productId === p.id) &&
      (p.reference.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.designation.toLowerCase().includes(searchProduct.toLowerCase()))
  )

  const totalValue = newLines.reduce((sum, l) => {
    const diff = (parseFloat(l.physicalQty) || 0) - l.systemQty
    return sum + Math.abs(diff) * (parseFloat(l.unitCost) || 0)
  }, 0)

  if (loading && inventories.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Inventaires</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="stock" sub="inventaires" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="termine">Terminé</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nouvel inventaire
          </Button>
        </div>
      </div>

      {/* Inventory List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden md:table-cell">Lignes</TableHead>
                    <TableHead className="hidden lg:table-cell">Date début</TableHead>
                    <TableHead className="hidden lg:table-cell">Date fin</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun inventaire trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventories.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium">{inv.number}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={inventoryTypeColors[inv.type]}>
                            {inventoryTypeLabels[inv.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={inventoryStatusColors[inv.status]}>
                            {inventoryStatusLabels[inv.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {inv.lines.length} ligne{inv.lines.length > 1 ? 's' : ''}
                          {inv.lines.some((l) => Math.abs(l.difference) > 0.001) && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Écarts
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {format(new Date(inv.startedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {inv.completedAt
                            ? format(new Date(inv.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(inv)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.status === 'en_cours' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700"
                                  onClick={() => openDetail(inv)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                {isSuperAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer l&apos;inventaire</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Supprimer l&apos;inventaire <strong>{inv.number}</strong> ? Cette action est irréversible.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                              </>
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
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Inventory Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Nouvel inventaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type d&apos;inventaire *</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tournant">Tournant</SelectItem>
                    <SelectItem value="complet">Complet</SelectItem>
                    <SelectItem value="exceptionnel">Exceptionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notes optionnelles..."
                />
              </div>
            </div>

            {/* Add line section */}
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Lignes d&apos;inventaire ({newLines.length})</Label>
                <Button variant="outline" size="sm" onClick={() => setAddLineOpen(!addLineOpen)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter produit
                </Button>
              </div>

              {addLineOpen && (
                <div className="flex flex-col sm:flex-row gap-2 p-3 bg-muted rounded-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.reference} - {p.designation} ({p.currentStock.toLocaleString('fr-FR')} {p.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddLine} disabled={!selectedProductId}>
                    Ajouter
                  </Button>
                </div>
              )}

              {newLines.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Aucun produit ajouté. Cliquez sur &quot;Ajouter produit&quot; pour commencer.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="w-[100px] text-right">Qté système</TableHead>
                        <TableHead className="w-[110px] text-right">Qté physique</TableHead>
                        <TableHead className="w-[90px] text-right">Écart</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newLines.map((line, idx) => {
                        const physicalQty = parseFloat(line.physicalQty) || 0
                        const diff = physicalQty - line.systemQty
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">
                              <span className="font-mono">{line.product?.reference}</span>
                              <span className="ml-1">{line.product?.designation}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {line.systemQty.toLocaleString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.001"
                                className="w-[90px] ml-auto text-right font-mono h-8 text-sm"
                                value={line.physicalQty}
                                onChange={(e) =>
                                  setNewLines(newLines.map((l, i) => i === idx ? { ...l, physicalQty: e.target.value } : l))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-mono text-sm font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {diff > 0 ? '+' : ''}{diff.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveLine(idx)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {newLines.length > 0 && (
                <div className="text-sm text-muted-foreground text-right">
                  Valeur totale des écarts : <span className="font-medium">{formatCurrency(totalValue)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setNewLines([]) }}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={newLines.length === 0 || creating}>
              {creating ? 'Création...' : 'Créer l\'inventaire'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Validate Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {selectedInventory?.number}
              </span>
              <Badge variant="outline" className={selectedInventory ? inventoryStatusColors[selectedInventory.status] : ''}>
                {selectedInventory ? inventoryStatusLabels[selectedInventory.status] : ''}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedInventory && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="secondary" className={inventoryTypeColors[selectedInventory.type]}>
                    {inventoryTypeLabels[selectedInventory.type]}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date début</p>
                  <p className="text-sm">{format(new Date(selectedInventory.startedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Date fin</p>
                  <p className="text-sm">{selectedInventory.completedAt ? format(new Date(selectedInventory.completedAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Lignes</p>
                  <p className="text-sm">{selectedInventory.lines.length}</p>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="w-[100px] text-right">Qté système</TableHead>
                      <TableHead className="w-[100px] text-right">Qté physique</TableHead>
                      <TableHead className="w-[100px] text-right">Écart</TableHead>
                      <TableHead className="w-[110px] text-right hidden md:table-cell">Valeur écart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInventory.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">
                          <span className="font-mono">{line.product.reference}</span>
                          <span className="ml-1">{line.product.designation}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {line.systemQty.toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {line.physicalQty.toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono text-sm font-medium ${
                            line.difference > 0.001 ? 'text-green-600' : line.difference < -0.001 ? 'text-red-600' : 'text-muted-foreground'
                          }`}>
                            {line.difference > 0 ? '+' : ''}{line.difference.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell text-sm">
                          {Math.abs(line.difference) > 0.001
                            ? formatCurrency(Math.abs(line.difference) * line.unitCost)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedInventory.status === 'en_cours' && (
                <div className="flex justify-end pt-2 border-t">
                  <Button onClick={handleValidate} disabled={validating} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {validating ? 'Validation...' : 'Valider et appliquer les ajustements'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
