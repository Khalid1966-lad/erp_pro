'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Database, Download, Trash2, Upload, Plus, Loader2,
  Shield, CheckCircle2, XCircle, AlertTriangle, HardDrive,
  Archive,
} from 'lucide-react'

interface Backup {
  id: string
  label: string | null
  appVersion: string
  schemaHash: string
  originalSize: number
  compressedSize: number
  tablesInfo: string
  isValid: boolean
  createdBy: string | null
  createdAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BackupSection() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<Backup[]>('/backup')
      setBackups(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement sauvegardes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchBackups()
    }
  }, [isAdmin, fetchBackups])

  const handleCreate = async () => {
    try {
      setCreating(true)
      await api.post('/backup')
      toast.success('Sauvegarde créée avec succès')
      fetchBackups()
    } catch (err: any) {
      toast.error(err.message || 'Erreur création sauvegarde')
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = async (backup: Backup) => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`/api/backup/${backup.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur de téléchargement' }))
        throw new Error(data.error || 'Erreur de téléchargement')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date(backup.createdAt)
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
      a.download = `gema-erp-backup-${dateStr}.json.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Téléchargement démarré')
    } catch (err: any) {
      toast.error(err.message || 'Erreur téléchargement')
    }
  }

  const handleDelete = async (backup: Backup) => {
    if (!window.confirm(`Supprimer la sauvegarde du ${formatDate(backup.createdAt)} ?\nCette action est irréversible.`)) {
      return
    }
    try {
      setDeletingId(backup.id)
      await api.delete(`/backup/${backup.id}`)
      toast.success('Sauvegarde supprimée')
      fetchBackups()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    } finally {
      setDeletingId(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json.gz') && !file.name.endsWith('.json')) {
        toast.error('Format invalide', { description: 'Sélectionnez un fichier .json.gz ou .json' })
        return
      }
      setSelectedFile(file)
      setConfirmText('')
      setShowConfirm(false)
    }
    if (e.target) e.target.value = ''
  }

  const handleRestore = async () => {
    if (!selectedFile) return
    if (confirmText !== 'RESTAURER') {
      toast.error('Veuillez taper RESTAURER pour confirmer')
      return
    }

    try {
      setRestoring(true)
      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur de restauration')
      }

      toast.success('Restauration réussie', {
        description: 'Les données ont été restaurées. La page va se recharger.',
      })

      // Reload after successful restore
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la restauration')
    } finally {
      setRestoring(false)
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Sauvegarde & Restauration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Accès réservé aux administrateurs.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Attention :</strong> La restauration remplace <strong>TOUTES</strong> les données actuelles. 
          Assurez-vous d&apos;avoir une sauvegarde récente avant de restaurer.
        </AlertDescription>
      </Alert>

      {/* Create Backup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Créer une sauvegarde</CardTitle>
              <CardDescription className="text-sm">
                Sauvegarder toutes les données de l&apos;application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {creating ? 'Création en cours...' : 'Créer une sauvegarde maintenant'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Backups */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Sauvegardes existantes</CardTitle>
              <CardDescription className="text-sm">
                Maximum 7 sauvegardes — les plus anciennes sont automatiquement supprimées
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Archive className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Aucune sauvegarde disponible</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Créez votre première sauvegarde pour protéger vos données
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{backup.label || `Sauvegarde du ${formatDate(backup.createdAt)}`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(backup.createdAt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-muted-foreground">
                          v{backup.appVersion}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(backup.compressedSize)} compressé
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(backup.originalSize)} original
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 sm:ml-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(backup)}
                      className="gap-1.5 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Télécharger
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(backup)}
                      disabled={deletingId === backup.id}
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    >
                      {deletingId === backup.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore from File */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Restaurer depuis un fichier</CardTitle>
              <CardDescription className="text-sm">
                Téléverser un fichier de sauvegarde pour restaurer les données
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer',
              selectedFile
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json.gz,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-1.5">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setShowConfirm(false)
                    setConfirmText('')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
                >
                  Choisir un autre fichier
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground/60 mb-1.5" />
                <p className="text-sm font-medium">Choisir un fichier .json.gz</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sélectionnez un fichier de sauvegarde précédemment téléchargé
                </p>
              </>
            )}
          </div>

          {/* Confirmation Flow */}
          {selectedFile && (
            <div className="space-y-4">
              {/* Validation info / confirmation */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Confirmer la restauration
                </div>
                <p className="text-sm text-muted-foreground">
                  Cette action va <strong className="text-foreground">remplacer TOUTES</strong> les données actuelles 
                  par le contenu du fichier sélectionné.
                </p>
                <p className="text-sm text-muted-foreground">
                  Tapez <code className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-xs">RESTAURER</code> pour confirmer :
                </p>
                <Input
                  placeholder="RESTAURER"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="max-w-xs font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRestore}
                  disabled={restoring || confirmText !== 'RESTAURER'}
                  variant="destructive"
                  className="gap-2"
                >
                  {restoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  {restoring ? 'Restauration en cours...' : 'Restaurer'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedFile(null)
                    setShowConfirm(false)
                    setConfirmText('')
                  }}
                  disabled={restoring}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
