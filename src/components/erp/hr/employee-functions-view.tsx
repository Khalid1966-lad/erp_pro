'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Briefcase, Plus, Search, Edit, Trash2, RefreshCw,
  Lock, Unlock, Loader2, Users, Shield, Settings2, Tag
} from 'lucide-react'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'

// ───────────────────── Types ─────────────────────
interface EmployeeFunction {
  id: string
  name: string
  description: string | null
  isCustom: boolean
  isActive: boolean
  employeeCount: number
  createdAt: string
  updatedAt: string
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Card>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEE FUNCTIONS VIEW
// ═══════════════════════════════════════════════════════════════
export default function EmployeeFunctionsView() {
  const [functions, setFunctions] = useState<EmployeeFunction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedFunction, setSelectedFunction] = useState<EmployeeFunction | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // ─── Fetch ───
  const fetchFunctions = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '1000' })
      if (searchRef.current) params.set('search', searchRef.current)
      const res = await api.get<{ functions: EmployeeFunction[] }>(`/employee-functions?${params}`)
      setFunctions(res.functions || [])
    } catch (err) {
      console.error('Erreur chargement fonctions:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des fonctions.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFunctions()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchFunctions])

  // ─── Debounced search ───
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchFunctions()
    }, 300)
  }, [fetchFunctions])

  // ─── Filtered ───
  const filteredFunctions = (() => {
    if (!search) return functions
    const q = search.toLowerCase()
    return functions.filter(
      f => f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q)
    )
  })()

  // ─── Stats ───
  const totalFunctions = functions.length
  const systemFunctions = functions.filter(f => !f.isCustom).length
  const customFunctions = functions.filter(f => f.isCustom).length
  const activeFunctions = functions.filter(f => f.isActive).length

  // ─── Open create dialog ───
  const openCreate = () => {
    setFormName('')
    setFormDescription('')
    setSelectedFunction(null)
    setDialogMode('create')
    setDialogOpen(true)
  }

  // ─── Open edit dialog ───
  const openEdit = (fn: EmployeeFunction) => {
    setSelectedFunction(fn)
    setFormName(fn.name)
    setFormDescription(fn.description || '')
    // For system functions, only description can be edited
    setDialogMode(fn.isCustom ? 'edit' : 'edit-description')
    setDialogOpen(true)
  }

  // ─── Save (create or edit) ───
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Champ manquant', { description: 'Le nom de la fonction est requis.' })
      return
    }

    // Check duplicate name
    const duplicate = functions.find(
      f => f.name.toLowerCase() === formName.trim().toLowerCase() && f.id !== selectedFunction?.id
    )
    if (duplicate) {
      toast.error('Nom dupliqué', { description: 'Une fonction avec ce nom existe déjà.' })
      return
    }

    try {
      setSaving(true)

      if (dialogMode === 'create') {
        await api.post('/employee-functions', {
          name: formName.trim(),
          description: formDescription.trim() || null,
        })
        toast.success('Fonction créée', {
          description: `"${formName.trim()}" a été ajoutée avec succès.`,
        })
      } else if (dialogMode === 'edit-description' && selectedFunction) {
        // System function — only update description
        await api.put('/employee-functions', {
          id: selectedFunction.id,
          name: selectedFunction.name,
          description: formDescription.trim() || null,
          isActive: selectedFunction.isActive,
        })
        toast.success('Description mise à jour', {
          description: `La description de "${selectedFunction.name}" a été mise à jour.`,
        })
      } else if (selectedFunction) {
        // Custom function — full edit
        await api.put('/employee-functions', {
          id: selectedFunction.id,
          name: formName.trim(),
          description: formDescription.trim() || null,
          isActive: selectedFunction.isActive,
        })
        toast.success('Fonction modifiée', {
          description: `"${formName.trim()}" a été mise à jour.`,
        })
      }

      setDialogOpen(false)
      fetchFunctions()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde'
      toast.error('Erreur de sauvegarde', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle active/inactive ───
  const handleToggleActive = async (fn: EmployeeFunction) => {
    try {
      await api.put('/employee-functions', {
        id: fn.id,
        name: fn.name,
        description: fn.description,
        isActive: !fn.isActive,
      })
      toast.success('Statut modifié', {
        description: `"${fn.name}" est maintenant ${fn.isActive ? 'inactive' : 'active'}.`,
      })
      fetchFunctions()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error('Erreur', { description: msg })
    }
  }

  // ─── Delete ───
  const handleDelete = async (fn: EmployeeFunction) => {
    try {
      await api.delete(`/employee-functions?id=${fn.id}`)
      toast.success('Fonction supprimée', {
        description: `"${fn.name}" a été supprimée.`,
      })
      fetchFunctions()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression'
      toast.error('Erreur de suppression', { description: msg })
    }
  }

  // ─── Render ───
  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Fonctions</h2>
          <Badge variant="secondary">{filteredFunctions.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="rh" sub="fonctions" />
          <Button variant="outline" size="sm" onClick={fetchFunctions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle fonction
          </Button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalFunctions}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{systemFunctions}</p>
              <p className="text-xs text-muted-foreground">Système</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customFunctions}</p>
              <p className="text-xs text-muted-foreground">Personnalisées</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeFunctions}</p>
              <p className="text-xs text-muted-foreground">Actives</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Search ─── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou description..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          autoComplete="off"
          data-form-type="other"
        />
      </div>

      {/* ─── Table ─── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '300px' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Salariés</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunctions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {search ? 'Aucune fonction trouvée.' : 'Aucune fonction enregistrée.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFunctions.map((fn) => (
                    <TableRow
                      key={fn.id}
                      className={cn(!fn.isActive && !fn.isCustom && 'opacity-60')}
                    >
                      {/* Nom */}
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-md bg-violet-50 text-violet-600 shrink-0">
                            <Briefcase className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-medium text-sm truncate">{fn.name}</span>
                        </div>
                      </TableCell>

                      {/* Description */}
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[250px]">
                        <span className="truncate block">{fn.description || '—'}</span>
                      </TableCell>

                      {/* Type */}
                      <TableCell className="hidden sm:table-cell">
                        {fn.isCustom ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <Settings2 className="h-3 w-3 mr-1" />
                            Personnalisée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Shield className="h-3 w-3 mr-1" />
                            Système
                          </Badge>
                        )}
                      </TableCell>

                      {/* Nombre de salariés */}
                      <TableCell className="hidden sm:table-cell text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-sm',
                            fn.employeeCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                          )}
                        >
                          <Users className="h-3 w-3" />
                          {fn.employeeCount}
                        </span>
                      </TableCell>

                      {/* Statut */}
                      <TableCell className="hidden sm:table-cell">
                        {fn.isActive ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                            Inactif
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(fn)}
                            title={fn.isCustom ? 'Modifier' : 'Modifier la description'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* Toggle active (custom functions only) */}
                          {fn.isCustom && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8',
                                fn.isActive
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-emerald-600 hover:text-emerald-700'
                              )}
                              onClick={() => handleToggleActive(fn)}
                              title={fn.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {fn.isActive ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {/* Delete (custom functions with no employees only) */}
                          {fn.isCustom && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  disabled={fn.employeeCount > 0}
                                  title={
                                    fn.employeeCount > 0
                                      ? `${fn.employeeCount} salarié(s) assigné(s) — impossible de supprimer`
                                      : 'Supprimer'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette fonction ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. La fonction <strong>{fn.name}</strong> sera
                                    définitivement supprimée.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(fn)}
                                    className="bg-red-600 text-white hover:bg-red-700"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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

      {/* ═══ Create Dialog ═══ */}
      <Dialog open={dialogOpen && dialogMode === 'create'} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setFormName(''); setFormDescription('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouvelle fonction
            </DialogTitle>
            <DialogDescription>
              Créez une fonction personnalisée pour vos salariés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="func-create-name">
                Nom de la fonction <span className="text-red-500">*</span>
              </Label>
              <Input
                id="func-create-name"
                placeholder="Ex: Chef de projet, Technicien..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="func-create-desc">Description</Label>
              <Textarea
                id="func-create-desc"
                placeholder="Description optionnelle de la fonction..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog (Custom Function) ═══ */}
      <Dialog open={dialogOpen && dialogMode === 'edit'} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedFunction(null); setFormName(''); setFormDescription('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier la fonction
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de la fonction "{selectedFunction?.name}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="func-edit-name">
                Nom de la fonction <span className="text-red-500">*</span>
              </Label>
              <Input
                id="func-edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="func-edit-desc">Description</Label>
              <Textarea
                id="func-edit-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Description Dialog (System Function) ═══ */}
      <Dialog open={dialogOpen && dialogMode === 'edit-description'} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedFunction(null); setFormName(''); setFormDescription('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier la description
            </DialogTitle>
            <DialogDescription>
              Fonction système : <strong>{selectedFunction?.name}</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                Seule la description peut être modifiée pour les fonctions système.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={selectedFunction?.name || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Le nom est protégé pour les fonctions système.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="func-editdesc-desc">Description</Label>
              <Textarea
                id="func-editdesc-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                autoComplete="off"
                data-form-type="other"
                placeholder="Ajoutez une description..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
