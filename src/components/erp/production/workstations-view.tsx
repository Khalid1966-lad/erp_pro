'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
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
  Factory, Plus, Edit, Trash2, Search, RefreshCw, Cpu, Gauge
} from 'lucide-react'
import { toast } from 'sonner'

interface WorkStation {
  id: string
  name: string
  description: string | null
  efficiency: number
  createdAt: string
  _count: {
    routingSteps: number
  }
}

const emptyForm = {
  name: '',
  description: '',
  efficiency: '100',
}

const getEfficiencyColor = (eff: number) => {
  if (eff >= 100) return 'text-green-600'
  if (eff >= 75) return 'text-orange-600'
  return 'text-red-600'
}

const getEfficiencyBg = (eff: number) => {
  if (eff >= 100) return 'bg-green-100 text-green-800'
  if (eff >= 75) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export default function WorkstationsView() {
  const [workstations, setWorkstations] = useState<WorkStation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkStation | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchWorkstations = useCallback(async () => {
    try {
      setLoading(true)
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await api.get<{ workstations: WorkStation[] }>(`/production/workstations${params}`)
      setWorkstations(data.workstations || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement des postes de travail')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchWorkstations()
  }, [fetchWorkstations])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (ws: WorkStation) => {
    setEditing(ws)
    setForm({
      name: ws.name,
      description: ws.description || '',
      efficiency: ws.efficiency.toString(),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    try {
      setSaving(true)
      const body = {
        name: form.name.trim(),
        description: form.description || undefined,
        efficiency: parseFloat(form.efficiency) || 100,
      }
      if (editing) {
        await api.put('/production/workstations', { id: editing.id, ...body })
        toast.success('Poste de travail modifié')
      } else {
        await api.post('/production/workstations', body)
        toast.success('Poste de travail créé')
      }
      setDialogOpen(false)
      fetchWorkstations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/production/workstations?id=${id}`)
      toast.success('Poste de travail supprimé')
      fetchWorkstations()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const avgEfficiency = useMemo(() => {
    if (workstations.length === 0) return 0
    return Math.round(workstations.reduce((sum, ws) => sum + ws.efficiency, 0) / workstations.length)
  }, [workstations])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Postes de travail</h2>
          <Badge variant="secondary">{workstations.length}</Badge>
          {workstations.length > 0 && (
            <Badge variant="outline" className={getEfficiencyBg(avgEfficiency)}>
              <Gauge className="h-3 w-3 mr-1" />
              Rend. moyen {avgEfficiency}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau poste
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="w-[120px] text-center">Rendement</TableHead>
                    <TableHead className="w-[120px] text-center hidden sm:table-cell">Étapes gamme</TableHead>
                    <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workstations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search ? 'Aucun poste trouvé.' : 'Aucun poste de travail enregistré.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    workstations.map((ws) => (
                      <TableRow key={ws.id}>
                        <TableCell>
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Cpu className="h-4 w-4 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{ws.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-48 truncate">
                          {ws.description || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  ws.efficiency >= 100 ? 'bg-green-500' : ws.efficiency >= 75 ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(ws.efficiency, 200)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-mono font-medium ${getEfficiencyColor(ws.efficiency)}`}>
                              {ws.efficiency}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="secondary">{ws._count.routingSteps}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {new Date(ws.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ws)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={ws._count.routingSteps > 0}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              {ws._count.routingSteps > 0 ? null : (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le poste</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Supprimer <strong>{ws.name}</strong> ? Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(ws.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              )}
                            </AlertDialog>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              {editing ? 'Modifier le poste' : 'Nouveau poste de travail'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nom du poste..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Rendement (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="200"
                  value={form.efficiency}
                  onChange={(e) => setForm({ ...form, efficiency: e.target.value })}
                  className="w-24"
                />
                <div className="flex-1">
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-colors ${
                        parseFloat(form.efficiency) >= 100 ? 'bg-green-500' : parseFloat(form.efficiency) >= 75 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(parseFloat(form.efficiency) || 0, 200)}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                100% = rendement normal. &lt; 100% = sous-performant. &gt; 100% = sur-performant.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
