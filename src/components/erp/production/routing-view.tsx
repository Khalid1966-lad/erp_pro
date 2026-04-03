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
  GitBranch, Plus, Trash2, Edit, ArrowUp, ArrowDown, RefreshCw, GripVertical, Clock, Search, Package
} from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  id: string
  reference: string
  designation: string
  productType: string
}

interface WorkStation {
  id: string
  name: string
  efficiency: number
}

interface RoutingStep {
  id: string
  productId: string
  workStationId: string
  stepOrder: number
  duration: number
  description: string | null
  product: {
    reference: string
    designation: string
  }
  workStation: {
    id: string
    name: string
    efficiency: number
  }
}

export default function RoutingView() {
  const [products, setProducts] = useState<Product[]>([])
  const [workstations, setWorkstations] = useState<WorkStation[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [steps, setSteps] = useState<RoutingStep[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSteps, setLoadingSteps] = useState(false)

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    workStationId: '',
    stepOrder: '1',
    duration: '',
    description: '',
  })
  const [adding, setAdding] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<RoutingStep | null>(null)
  const [editForm, setEditForm] = useState({
    workStationId: '',
    stepOrder: '',
    duration: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{ products: Product[] }>('/products?productType=finished&limit=100')
      setProducts(res.products || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des produits')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWorkstations = useCallback(async () => {
    try {
      const res = await api.get<{ workstations: WorkStation[] }>('/production/workstations')
      setWorkstations(res.workstations || [])
    } catch {
      // silent
    }
  }, [])

  const fetchSteps = useCallback(async (productId: string) => {
    if (!productId) {
      setSteps([])
      return
    }
    try {
      setLoadingSteps(true)
      const res = await api.get<{ steps: RoutingStep[] }>(`/production/routing?productId=${productId}`)
      setSteps(res.steps || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des étapes')
    } finally {
      setLoadingSteps(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchWorkstations()
  }, [fetchProducts, fetchWorkstations])

  useEffect(() => {
    fetchSteps(selectedProductId)
  }, [selectedProductId, fetchSteps])

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0)

  const openAdd = () => {
    const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.stepOrder)) + 1 : 1
    setAddForm({
      workStationId: workstations[0]?.id || '',
      stepOrder: nextOrder.toString(),
      duration: '',
      description: '',
    })
    setAddDialogOpen(true)
  }

  const handleAdd = async () => {
    if (!selectedProductId || !addForm.workStationId || !addForm.stepOrder) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    try {
      setAdding(true)
      await api.post('/production/routing', {
        productId: selectedProductId,
        workStationId: addForm.workStationId,
        stepOrder: parseInt(addForm.stepOrder),
        duration: parseInt(addForm.duration) || 0,
        description: addForm.description || undefined,
      })
      toast.success('Étape ajoutée avec succès')
      setAddDialogOpen(false)
      fetchSteps(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout")
    } finally {
      setAdding(false)
    }
  }

  const openEdit = (step: RoutingStep) => {
    setEditingStep(step)
    setEditForm({
      workStationId: step.workStationId,
      stepOrder: step.stepOrder.toString(),
      duration: step.duration.toString(),
      description: step.description || '',
    })
    setEditDialogOpen(true)
  }

  const handleEdit = async () => {
    if (!editingStep) return
    try {
      setSaving(true)
      await api.put('/production/routing', {
        id: editingStep.id,
        workStationId: editForm.workStationId,
        stepOrder: parseInt(editForm.stepOrder),
        duration: parseInt(editForm.duration) || 0,
        description: editForm.description || undefined,
      })
      toast.success('Étape modifiée')
      setEditDialogOpen(false)
      fetchSteps(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/production/routing?id=${id}`)
      toast.success('Étape supprimée')
      fetchSteps(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const handleMove = async (step: RoutingStep, direction: 'up' | 'down') => {
    const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)
    const currentIdx = sortedSteps.findIndex((s) => s.id === step.id)
    const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1
    if (swapIdx < 0 || swapIdx >= sortedSteps.length) return

    const swapStep = sortedSteps[swapIdx]
    try {
      await Promise.all([
        api.put('/production/routing', { id: step.id, stepOrder: swapStep.stepOrder }),
        api.put('/production/routing', { id: swapStep.id, stepOrder: step.stepOrder }),
      ])
      fetchSteps(selectedProductId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du réordonnancement')
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '-'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m} min`
    if (m === 0) return `${h}h`
    return `${h}h ${m}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Product Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-5 w-5" />
            Gamme opératoire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label>Produit fini</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un produit fini..." />
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
            <div className="flex items-end gap-2">
              <Button variant="outline" size="icon" onClick={() => { fetchProducts(); fetchSteps(selectedProductId) }} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      {selectedProduct && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Étapes : {selectedProduct.reference} - {selectedProduct.designation}
            </CardTitle>
            <div className="flex items-center gap-2">
              {steps.length > 0 && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Durée totale : {formatDuration(totalDuration)}
                </Badge>
              )}
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une étape
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSteps ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Aucune étape dans la gamme</p>
                <p className="text-sm">Définissez les étapes de fabrication pour ce produit</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step, idx) => {
                  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMove(step, 'up')}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMove(step, 'down')}
                          disabled={idx === sorted.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Step order badge */}
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{step.stepOrder}</span>
                      </div>

                      {/* Step content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{step.workStation.name}</Badge>
                          {step.workStation.efficiency !== 100 && (
                            <span className="text-xs text-muted-foreground">
                              Rend. {step.workStation.efficiency}%
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(step.duration)}
                          </span>
                        </div>
                        {step.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{step.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(step)}>
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
                              <AlertDialogTitle>Supprimer l&apos;étape</AlertDialogTitle>
                              <AlertDialogDescription>
                                Supprimer l&apos;étape {step.stepOrder} ({step.workStation.name}) de la gamme ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(step.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Step Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une étape</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Poste de travail *</Label>
              <Select value={addForm.workStationId} onValueChange={(v) => setAddForm({ ...addForm, workStationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {workstations.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name} {ws.efficiency !== 100 ? `(Rend. ${ws.efficiency}%)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordre d&apos;étape *</Label>
                <Input
                  type="number"
                  min="1"
                  value={addForm.stepOrder}
                  onChange={(e) => setAddForm({ ...addForm, stepOrder: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={addForm.duration}
                  onChange={(e) => setAddForm({ ...addForm, duration: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="Description de l'étape..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Step Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;étape {editingStep?.stepOrder}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Poste de travail *</Label>
              <Select value={editForm.workStationId} onValueChange={(v) => setEditForm({ ...editForm, workStationId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workstations.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name} {ws.efficiency !== 100 ? `(Rend. ${ws.efficiency}%)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordre d&apos;étape *</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.stepOrder}
                  onChange={(e) => setEditForm({ ...editForm, stepOrder: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
