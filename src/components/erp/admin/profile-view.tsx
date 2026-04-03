'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import {
  User, Mail, Phone, Shield, ShieldCheck, Calendar,
  Clock, Eye, EyeOff, Loader2, Save, KeyRound, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

// ───────────────────── Types ─────────────────────
interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  phone: string | null
  isSuperAdmin: boolean
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

const roleLabelMap: Record<string, string> = {
  super_admin: 'Super Administrateur',
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

// ═══════════════════════════════════════════════════════════════
//  PROFILE VIEW
// ═══════════════════════════════════════════════════════════════
export default function ProfileView() {
  const { user: authUser, setUser } = useAuthStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Profile form
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get<{ user: UserProfile }>('/profile')
      const u = res.user
      setProfile(u)
      setFormName(u.name)
      setFormPhone(u.phone || '')
    } catch (err) {
      console.error('Erreur chargement profil:', err)
      toast.error('Erreur', { description: 'Impossible de charger le profil.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!formName.trim()) {
      toast.error('Nom requis', { description: 'Le nom ne peut pas être vide.' })
      return
    }
    try {
      setSavingProfile(true)
      const res = await api.put<{ user: UserProfile; message: string }>('/profile', {
        name: formName.trim(),
        phone: formPhone || null,
      })
      setProfile(res.user)
      // Update auth store
      if (authUser) {
        setUser({ ...authUser, name: res.user.name })
      }
      toast.success(res.message)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde'
      toast.error('Erreur', { description: msg })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Mot de passe actuel requis')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Nouveau mot de passe invalide', { description: 'Minimum 6 caractères requis.' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Confirmation incorrecte', { description: 'Les mots de passe ne correspondent pas.' })
      return
    }
    try {
      setSavingPassword(true)
      await api.put('/profile', {
        currentPassword,
        newPassword,
      })
      toast.success('Mot de passe modifié', { description: 'Votre mot de passe a été mis à jour avec succès.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      toast.error('Erreur', { description: msg })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-60" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground text-lg font-bold">
          {profile.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
        </div>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {profile.name}
            {profile.isSuperAdmin && <ShieldCheck className="h-5 w-5 text-red-500" />}
          </h2>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <Badge variant="outline" className={roleColorMap[profile.role] || ''}>
          {roleLabelMap[profile.role] || profile.role}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{profile.email}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm font-medium truncate">{profile.phone || 'Non renseigné'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Dernière connexion</p>
              <p className="text-sm font-medium">
                {profile.lastLogin
                  ? format(new Date(profile.lastLogin), 'dd MMM yyyy HH:mm', { locale: fr })
                  : 'Première connexion'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informations personnelles
          </CardTitle>
          <CardDescription>Modifiez votre nom et numéro de téléphone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nom complet</Label>
              <Input
                id="profile-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Votre nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Téléphone</Label>
              <Input
                id="profile-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+212 6XX XXX XXX"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              Compte créé le {format(new Date(profile.createdAt), 'dd MMMM yyyy', { locale: fr })}
            </p>
            <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
              {savingProfile ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>Modifiez votre mot de passe de connexion. Vous devez connaître le mot de passe actuel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
              />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              Les mots de passe ne correspondent pas
            </p>
          )}
          {newPassword && newPassword.length < 6 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              Le mot de passe doit contenir au moins 6 caractères
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              size="sm"
            >
              {savingPassword ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
              Changer le mot de passe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
