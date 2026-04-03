'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  UserCog, Plus, Search, Edit, Shield, ShieldCheck, Ban, Unlock,
  Phone, Mail, Clock, Calendar, Eye, EyeOff, Loader2, RefreshCw, CheckCircle2, XCircle
} from 'lucide-react'
import { toast } from 'sonner'

// ───────────────────── Types ─────────────────────
interface User {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  isSuperAdmin: boolean
  isBlocked: boolean
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
  blockedAt: string | null
}

// ───────────────────── Constants ─────────────────────
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur', color: 'bg-red-100 text-red-800' },
  { value: 'commercial', label: 'Commercial', color: 'bg-blue-100 text-blue-800' },
  { value: 'buyer', label: 'Acheteur', color: 'bg-teal-100 text-teal-800' },
  { value: 'storekeeper', label: 'Magasinier', color: 'bg-amber-100 text-amber-800' },
  { value: 'prod_manager', label: 'Resp. Production', color: 'bg-purple-100 text-purple-800' },
  { value: 'operator', label: 'Opérateur', color: 'bg-gray-100 text-gray-700' },
  { value: 'accountant', label: 'Comptable', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cashier', label: 'Caissier', color: 'bg-lime-100 text-lime-800' },
  { value: 'direction', label: 'Direction', color: 'bg-indigo-100 text-indigo-800' },
]

const roleColorMap: Record<string, string> = {
  super_admin: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
  admin: 'bg-red-100 text-red-800 border-red-200',
  commercial: 'bg-blue-100 text-blue-800 border-blue-200',
  buyer: 'bg-teal-100 text-teal-800 border-teal-200',
  storekeeper: 'bg-amber-100 text-amber-800 border-amber-200',
  prod_manager: 'bg-purple-100 text-purple-800 border-purple-200',
  operator: 'bg-gray-100 text-gray-700 border-gray-200',
  accountant: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cashier: 'bg-lime-100 text-lime-800 border-lime-200',
  direction: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

const roleLabelMap: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  commercial: 'Commercial',
  buyer: 'Acheteur',
  storekeeper: 'Magasinier',
  prod_manager: 'Resp. Production',
  operator: 'Opérateur',
  accountant: 'Comptable',
  cashier: 'Caissier',
  direction: 'Direction',
}

// ═══════════════════════════════════════════════════════════════
//  USERS VIEW
// ═══════════════════════════════════════════════════════════════
export default function UsersView() {
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const isSuperAdmin = currentUser?.isSuperAdmin || currentUser?.role === 'super_admin'

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState('operator')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{ users: User[] }>('/users')
      setUsers(res.users || [])
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err)
      toast.error('Erreur', { description: 'Impossible de charger la liste des utilisateurs.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  // ─── Filtered users ───
  const filteredUsers = search
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
      )
    : users

  // ─── Create user ───
  const openCreate = () => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPhone('')
    setFormRole('operator')
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword) {
      toast.error('Champs manquants', { description: 'Nom, email et mot de passe sont requis.' })
      return
    }
    try {
      setSaving(true)
      await api.post('/users', {
        name: formName,
        email: formEmail,
        password: formPassword,
        phone: formPhone || null,
        role: formRole,
      })
      toast.success('Utilisateur créé', { description: `${formName} a été ajouté.` })
      setCreateOpen(false)
      fetchUsers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de création'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Edit user ───
  const openEdit = (user: User) => {
    setSelectedUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword('')
    setFormPhone(user.phone || '')
    setFormRole(user.role)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!selectedUser) return
    try {
      setSaving(true)
      const body: Record<string, unknown> = {
        id: selectedUser.id,
        name: formName,
        role: formRole,
        phone: formPhone || null,
      }
      if (formPassword) body.password = formPassword
      await api.put('/users', body)
      toast.success('Utilisateur modifié', { description: `${formName} a été mis à jour.` })
      setEditOpen(false)
      fetchUsers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de modification'
      toast.error('Erreur', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Block / Unblock ───
  const handleBlock = async (userId: string, block: boolean) => {
    try {
      const res = await api.post<{ message: string }>('/users/block', { userId, block })
      toast.success(res.message, {
        description: block ? "L'utilisateur ne peut plus se connecter." : "L'utilisateur peut de nouveau se connecter.",
      })
      fetchUsers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error('Erreur', { description: msg })
    }
  }

  // ─── Stats ───
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.isActive && !u.isBlocked).length
  const blockedUsers = users.filter(u => u.isBlocked).length
  const adminCount = users.filter(u => u.role === 'admin' || u.isSuperAdmin).length

  // ─── Not admin guard ───
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">Accès restreint</h3>
          <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent gérer les utilisateurs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Utilisateurs</h2>
          <Badge variant="secondary">{totalUsers}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvel utilisateur
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
              <p className="text-2xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeUsers}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <Ban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{blockedUsers}</p>
              <p className="text-xs text-muted-foreground">Bloqués</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou rôle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="hidden md:table-cell">Rôle</TableHead>
                  <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
                  <TableHead className="hidden lg:table-cell">Créé le</TableHead>
                  <TableHead className="text-right w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search ? 'Aucun utilisateur trouvé.' : 'Aucun utilisateur enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow
                      key={u.id}
                      className={u.isBlocked ? 'opacity-60 bg-red-50/30' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted text-sm font-medium shrink-0">
                            {u.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm truncate">{u.name}</p>
                              {u.isSuperAdmin && (
                                <ShieldCheck className="h-3.5 w-3.5 text-red-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={roleColorMap[u.role] || ''}>
                          {roleLabelMap[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {u.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {u.phone}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.isBlocked ? (
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                            <Ban className="h-3 w-3 mr-1" />
                            Bloqué
                          </Badge>
                        ) : u.isActive ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                            Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {u.lastLogin ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(u.lastLogin), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(u.createdAt), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(u)}
                            disabled={u.isSuperAdmin && !isSuperAdmin}
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {u.isBlocked ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleBlock(u.id, false)}
                              disabled={u.isSuperAdmin}
                              title="Débloquer"
                            >
                              <Unlock className="h-4 w-4" />
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  disabled={u.id === currentUser?.id || u.isSuperAdmin}
                                  title="Bloquer"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Bloquer cet utilisateur ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{u.name}</strong> ({u.email}) ne pourra plus se connecter à l&apos;application. Vous pourrez le débloquer à tout moment.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleBlock(u.id, true)}
                                    className="bg-red-600 text-white hover:bg-red-700"
                                  >
                                    Bloquer
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouvel utilisateur
            </DialogTitle>
            <DialogDescription>
              Créez un nouveau compte utilisateur avec un rôle et un accès.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nom complet *</Label>
              <Input
                id="create-name"
                placeholder="Mohammed Alaoui"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@gema-erp.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Mot de passe *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 caractères"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Téléphone</Label>
              <Input
                id="create-phone"
                placeholder="+212 6XX XXX XXX"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} disabled={r.value === 'admin' && !isSuperAdmin}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${r.color.split(' ')[0]}`} />
                        {r.label}
                        {r.value === 'admin' && !isSuperAdmin && ' (Super Admin uniquement)'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving || !formName || !formEmail || !formPassword}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier l&apos;utilisateur
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isSuperAdmin && (
                <span className="text-amber-600 font-medium">Super administrateur — certains champs sont protégés.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom complet *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={selectedUser?.isSuperAdmin && !isSuperAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">L&apos;email ne peut pas être modifié.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                Nouveau mot de passe
                <span className="text-muted-foreground font-normal ml-1">(laisser vide pour ne pas changer)</span>
              </Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 caractères"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input
                id="edit-phone"
                placeholder="+212 6XX XXX XXX"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={formRole} onValueChange={setFormRole} disabled={selectedUser?.isSuperAdmin && !isSuperAdmin}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} disabled={r.value === 'admin' && !isSuperAdmin}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${r.color.split(' ')[0]}`} />
                        {r.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUser?.isSuperAdmin && (
                <p className="text-xs text-amber-600">Le rôle Super Admin ne peut pas être modifié.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={saving || !formName}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
