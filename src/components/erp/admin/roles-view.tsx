'use client'

import React, { useState, useEffect, useCallback, Component } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Users,
  CheckSquare,
  Square,
  Search,
  RefreshCw,
  ShieldCheck,
  Loader2,
  Eye,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'

// ─── Error boundary to prevent silent crashes ───
class RolesErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RolesView] Error caught by boundary:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Shield className="h-12 w-12 text-red-400" />
          <h3 className="text-lg font-semibold">Erreur d&apos;affichage</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Une erreur inattendue s&apos;est produite. Veuillez recharger la page.
          </p>
          <p className="text-xs text-red-400 font-mono max-w-lg truncate">
            {this.state.error?.message}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            Recharger la page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

// ───────────────────── Permission Modules ─────────────────────
const PERMISSION_MODULES: Record<string, string[]> = {
  'Tableau de bord': ['dashboard:read'],
  Rapports: ['reports:read'],
  Paramètres: ['settings:read', 'settings:write'],
  Clients: ['clients:read', 'clients:write'],
  Produits: ['products:read', 'products:write'],
  Devis: ['quotes:read', 'quotes:write'],
  'Commandes clients': ['sales_orders:read', 'sales_orders:write'],
  'Bons de livraison': ['delivery_notes:read', 'delivery_notes:write'],
  Préparations: ['preparations:read', 'preparations:write'],
  'Factures clients': ['invoices:read', 'invoices:write'],
  'Avoirs clients': ['credit_notes:read', 'credit_notes:write'],
  'Retours clients': ['customer_returns:read', 'customer_returns:write'],
  Fournisseurs: ['suppliers:read', 'suppliers:write'],
  'Commandes fournisseurs': ['purchase_orders:read', 'purchase_orders:write'],
  Réceptions: ['receptions:read', 'receptions:write'],
  'Devis fournisseurs': ['supplier_quotes:read', 'supplier_quotes:write'],
  'Factures fournisseurs': ['supplier_invoices:read', 'supplier_invoices:write'],
  'Avoirs fournisseurs': ['supplier_credit_notes:read', 'supplier_credit_notes:write'],
  'Retours fournisseurs': ['supplier_returns:read', 'supplier_returns:write'],
  'Demandes de prix': ['price_requests:read', 'price_requests:write'],
  Stock: ['stock:read', 'stock:write'],
  Production: ['production:read', 'production:write'],
  'Ordres de fabrication': ['work_orders:read', 'work_orders:write'],
  Nomenclatures: ['bom:read', 'bom:write'],
  Gammes: ['routing:read', 'routing:write'],
  'Postes de travail': ['workstations:read', 'workstations:write'],
  Paiements: ['payments:read', 'payments:write'],
  Banque: ['bank:read', 'bank:write'],
  Caisse: ['cash:read', 'cash:write'],
  Comptabilité: ['accounting:read', 'accounting:write'],
  'Effets & Chèques': ['effets_cheques:read', 'effets_cheques:write'],
}

/** Derive a display label for a permission key like "clients:read" → "Lecture" */
function permLabel(key: string): string {
  const action = key.split(':')[1]
  switch (action) {
    case 'read':
      return 'Lecture'
    case 'write':
      return 'Écriture'
    default:
      return action
  }
}

/** Get total count of all available permissions */
const TOTAL_PERMISSIONS = Object.values(PERMISSION_MODULES).flat().length

// ───────────────────── Types ─────────────────────
interface Role {
  id: string
  name: string
  label: string
  description: string | null
  permissions: string[]
  isSystem: boolean
  isActive: boolean
  userCount: number
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════════
//  ROLES VIEW
// ═══════════════════════════════════════════════════════════════
function RolesViewInner() {
  const { user: currentUser } = useAuthStore()
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.isSuperAdmin

  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewPermsOpen, setViewPermsOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPermissions, setFormPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // ─── Fetch ───
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{ roles: Role[] }>('/roles')
      setRoles(res.roles || [])
    } catch (err) {
      console.error('Erreur chargement rôles:', err)
      toast.error('Erreur', {
        description: 'Impossible de charger la liste des rôles.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) fetchRoles()
  }, [isSuperAdmin, fetchRoles])

  // ─── Filtered ───
  const filteredRoles = search
    ? roles.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.label.toLowerCase().includes(search.toLowerCase()) ||
          (r.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : roles

  // ─── Permission helpers ───
  const isModuleFullySelected = (modulePerms: string[]) =>
    modulePerms.every((p) => formPermissions.includes(p))

  const isModulePartiallySelected = (modulePerms: string[]) =>
    modulePerms.some((p) => formPermissions.includes(p)) &&
    !isModuleFullySelected(modulePerms)

  const toggleModule = (modulePerms: string[]) => {
    if (isModuleFullySelected(modulePerms)) {
      setFormPermissions((prev) => prev.filter((p) => !modulePerms.includes(p)))
    } else {
      setFormPermissions((prev) => {
        const set = new Set(prev)
        modulePerms.forEach((p) => set.add(p))
        return Array.from(set)
      })
    }
  }

  const togglePermission = (perm: string) => {
    setFormPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    )
  }

  // ─── Select all / deselect all ───
  const allPerms = Object.values(PERMISSION_MODULES).flat()
  const isAllSelected = allPerms.every((p) => formPermissions.includes(p))
  const isAllPartial = allPerms.some((p) => formPermissions.includes(p)) && !isAllSelected

  const toggleAll = () => {
    if (isAllSelected) {
      setFormPermissions([])
    } else {
      setFormPermissions([...allPerms])
    }
  }

  // ─── Create role ───
  const openCreate = () => {
    setFormName('')
    setFormLabel('')
    setFormDescription('')
    setFormPermissions([])
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!formName || !formLabel) {
      toast.error('Champs manquants', {
        description: 'Le nom technique et le libellé sont requis.',
      })
      return
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formName)) {
      toast.error('Nom invalide', {
        description:
          'Le nom doit commencer par une minuscule et contenir uniquement des minuscules, chiffres et underscores.',
      })
      return
    }
    try {
      setSaving(true)
      await api.post('/roles', {
        name: formName,
        label: formLabel,
        description: formDescription || null,
        permissions: formPermissions,
      })
      toast.success('Rôle créé', {
        description: `Le rôle "${formLabel}" a été créé avec succès.`,
      })
      setCreateOpen(false)
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de création'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Edit role ───
  const openEdit = (role: Role) => {
    setSelectedRole(role)
    setFormName(role.name)
    setFormLabel(role.label)
    setFormDescription(role.description || '')
    setFormPermissions([...role.permissions])
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!selectedRole || !formLabel) return
    try {
      setSaving(true)
      await api.put('/roles', {
        id: selectedRole.id,
        label: formLabel,
        description: formDescription || null,
        permissions: formPermissions,
        isActive: selectedRole.isActive,
      })
      toast.success('Rôle modifié', {
        description: `Le rôle "${formLabel}" a été mis à jour.`,
      })
      setEditOpen(false)
      setSelectedRole(null)
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de modification'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Toggle active/inactive ───
  const handleToggleActive = async (role: Role) => {
    if (role.isSystem) return
    try {
      await api.put('/roles', {
        id: role.id,
        label: role.label,
        description: role.description,
        permissions: role.permissions,
        isActive: !role.isActive,
      })
      toast.success('Statut modifié', {
        description: `Le rôle "${role.label}" est maintenant ${role.isActive ? 'inactif' : 'actif'}.`,
      })
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error('Erreur', { description: msg })
    }
  }

  // ─── Delete role ───
  const handleDelete = async (roleId: string) => {
    try {
      await api.delete(`/roles?id=${roleId}`)
      toast.success('Rôle supprimé', {
        description: 'Le rôle a été supprimé définitivement.',
      })
      setRoles((prev) => prev.filter((r) => r.id !== roleId))
      fetchRoles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression'
      toast.error('Erreur', { description: msg })
    }
  }

  // ─── View permissions ───
  const openViewPerms = (role: Role) => {
    setSelectedRole(role)
    setViewPermsOpen(true)
  }

  // ─── Stats ───
  const totalRoles = roles.length
  const activeRoles = roles.filter((r) => r.isActive).length
  const systemRoles = roles.filter((r) => r.isSystem).length
  const customRoles = roles.filter((r) => !r.isSystem).length

  // ─── Not admin guard ───
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">Accès restreint</h3>
          <p className="text-sm text-muted-foreground">
            Seuls les super administrateurs peuvent gérer les rôles.
          </p>
        </div>
      </div>
    )
  }

  // ─── Render permission group for dialogs ───
  const renderPermissionGroups = (readOnly: boolean = false) => (
    <div className="space-y-3">
      {/* Select all toggle */}
      {!readOnly && (
        <div className="flex items-center justify-between py-1">
          <Label className="text-sm font-medium">Permissions</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formPermissions.length} / {TOTAL_PERMISSIONS}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={toggleAll}
            >
              {isAllSelected ? (
                <>
                  <Square className="h-3 w-3" />
                  Tout déselectionner
                </>
              ) : (
                <>
                  <CheckSquare className="h-3 w-3" />
                  Tout sélectionner
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[50vh] pr-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(PERMISSION_MODULES).map(([module, perms]) => {
            const fullySelected = isModuleFullySelected(perms)
            const partiallySelected = isModulePartiallySelected(perms)

            return (
              <div
                key={module}
                className={cn(
                  'rounded-lg border p-3 space-y-2',
                  fullySelected && !readOnly
                    ? 'border-primary/40 bg-primary/5'
                    : partiallySelected && !readOnly
                      ? 'border-amber-300 bg-amber-50/50'
                      : 'border-border'
                )}
              >
                {/* Module header with select all */}
                <div className="flex items-center gap-2">
                  {!readOnly ? (
                    <Checkbox
                      checked={fullySelected}
                      {...(partiallySelected
                        ? { 'data-state': 'indeterminate' as const, onCheckedChange: () => toggleModule(perms) }
                        : { onCheckedChange: () => toggleModule(perms) })}
                      className="shrink-0"
                    />
                  ) : (
                    <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-medium leading-none truncate">
                    {module}
                  </span>
                </div>

                {/* Individual permissions */}
                <div className="space-y-1.5 pl-6">
                  {perms.map((perm) => {
                    const checked = formPermissions.includes(perm)
                    return (
                      <label
                        key={perm}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer',
                          readOnly && 'cursor-default'
                        )}
                      >
                        {!readOnly ? (
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePermission(perm)}
                            className="h-3.5 w-3.5"
                          />
                        ) : (
                          <span className="flex items-center justify-center h-3.5 w-3.5">
                            {checked ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground/40" />
                            )}
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-xs',
                            checked ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {permLabel(perm)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Rôles & Permissions</h2>
          <Badge variant="secondary">{totalRoles}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="administration" sub="roles" />
          <Button variant="outline" size="sm" onClick={fetchRoles}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau rôle
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRoles}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeRoles}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{systemRoles}</p>
              <p className="text-xs text-muted-foreground">Système</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customRoles}</p>
              <p className="text-xs text-muted-foreground">Personnalisés</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, libellé ou description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          autoComplete="off"
          data-form-type="other"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '300px' }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">
                    Permissions
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-center">
                    Utilisateurs
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {search
                        ? 'Aucun rôle trouvé.'
                        : 'Aucun rôle enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((role) => (
                    <TableRow
                      key={role.id}
                      className={cn(
                        !role.isActive && !role.isSystem && 'opacity-60'
                      )}
                    >
                      {/* Role name + system badge */}
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm truncate">
                                {role.label}
                              </span>
                              {role.isSystem && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 shrink-0"
                                >
                                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                                  Système
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {role.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Description */}
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-[200px]">
                        <span className="truncate block">
                          {role.description || '—'}
                        </span>
                      </TableCell>

                      {/* Permissions count */}
                      <TableCell className="hidden sm:table-cell text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 font-normal"
                          onClick={() => openViewPerms(role)}
                        >
                          <Eye className="h-3 w-3" />
                          {role.permissions.length}
                          <span className="hidden lg:inline text-muted-foreground">
                            / {TOTAL_PERMISSIONS}
                          </span>
                        </Button>
                      </TableCell>

                      {/* User count */}
                      <TableCell className="hidden sm:table-cell text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            role.userCount > 0
                              ? 'text-foreground font-medium'
                              : 'text-muted-foreground'
                          )}
                        >
                          <Users className="h-3 w-3" />
                          {role.userCount}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="hidden sm:table-cell">
                        {role.isSystem ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                          >
                            Système
                          </Badge>
                        ) : role.isActive ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"
                          >
                            Actif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-600 border-gray-200 text-xs"
                          >
                            Inactif
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* View permissions */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openViewPerms(role)}
                            title="Voir permissions"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(role)}
                            disabled={role.isSystem}
                            title={
                              role.isSystem
                                ? 'Les rôles système ne sont pas modifiables'
                                : 'Modifier'
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* Toggle active */}
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8',
                                role.isActive
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-emerald-600 hover:text-emerald-700'
                              )}
                              onClick={() => handleToggleActive(role)}
                              title={
                                role.isActive
                                  ? 'Désactiver ce rôle'
                                  : 'Activer ce rôle'
                              }
                            >
                              {role.isActive ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {/* Delete */}
                          {!role.isSystem && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  disabled={role.userCount > 0}
                                  title={
                                    role.userCount > 0
                                      ? `${role.userCount} utilisateur(s) assigné(s) — impossible de supprimer`
                                      : 'Supprimer'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Supprimer ce rôle ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. Le rôle{' '}
                                    <strong>{role.label}</strong> (
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                      {role.name}
                                    </code>
                                    ) sera définitivement supprimé.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(role.id)}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouveau rôle
            </DialogTitle>
            <DialogDescription>
              Créez un rôle personnalisé avec des permissions spécifiques.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">
                  Nom technique <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  placeholder="responsable_achat"
                  value={formName}
                  onChange={(e) =>
                    setFormName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
                  }
                  autoComplete="off"
                  data-form-type="other"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Minuscules, chiffres et underscores uniquement. Ex:{' '}
                  <code className="bg-muted px-1 rounded">responsable_achat</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-label">
                  Libellé <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-label"
                  placeholder="Responsable Achats"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  autoComplete="off"
                  data-form-type="other"
                />
                <p className="text-xs text-muted-foreground">
                  Nom affiché dans l&apos;interface
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Description optionnelle du rôle..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                autoComplete="off"
                data-form-type="other"
              />
            </div>

            <Separator />

            {renderPermissionGroups(false)}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formName || !formLabel}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Créer le rôle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedRole(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier le rôle
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations et permissions du rôle{' '}
              <strong>{selectedRole?.label}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* System role name - readonly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom technique</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  disabled
                  className="bg-muted font-mono text-sm"
                  autoComplete="off"
                  data-form-type="other"
                />
                <p className="text-xs text-muted-foreground">
                  Le nom technique ne peut pas être modifié après création.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-label">
                  Libellé <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-label"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  autoComplete="off"
                  data-form-type="other"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Description optionnelle du rôle..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                autoComplete="off"
                data-form-type="other"
              />
            </div>

            {/* Active toggle */}
            {selectedRole && !selectedRole.isSystem && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Rôle actif</Label>
                  <p className="text-xs text-muted-foreground">
                    Les rôles inactifs ne sont pas disponibles pour l&apos;assignation.
                  </p>
                </div>
                <Switch
                  checked={selectedRole.isActive}
                  onCheckedChange={(checked) => {
                    if (selectedRole) {
                      setSelectedRole({ ...selectedRole, isActive: checked })
                    }
                  }}
                />
              </div>
            )}

            <Separator />

            {renderPermissionGroups(false)}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={saving || !formLabel}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ View Permissions Dialog ═══ */}
      <Dialog
        open={viewPermsOpen}
        onOpenChange={(open) => {
          setViewPermsOpen(open)
          if (!open) {
            setSelectedRole(null)
            setFormPermissions([])
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Permissions — {selectedRole?.label}
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {selectedRole?.name}
              </span>
              {selectedRole?.isSystem && (
                <Badge
                  variant="outline"
                  className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0"
                >
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  Système
                </Badge>
              )}
              {selectedRole?.description && (
                <p className="mt-1 text-muted-foreground">
                  {selectedRole.description}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {formPermissions.length} permission(s) accordée(s)
              </span>
            </span>
            <span className="text-muted-foreground">
              sur {TOTAL_PERMISSIONS} disponibles
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {renderPermissionGroups(true)}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setViewPermsOpen(false)}>
              Fermer
            </Button>
            {selectedRole && !selectedRole.isSystem && (
              <Button
                variant="default"
                onClick={() => {
                  setViewPermsOpen(false)
                  openEdit(selectedRole)
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RolesView() {
  return (
    <RolesErrorBoundary>
      <RolesViewInner />
    </RolesErrorBoundary>
  )
}
