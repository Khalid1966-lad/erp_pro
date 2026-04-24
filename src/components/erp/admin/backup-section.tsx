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
import { Progress } from '@/components/ui/progress'
import {
  Database, Download, Trash2, Upload, Plus, Loader2,
  Shield, CheckCircle2, XCircle, AlertTriangle, HardDrive,
  Archive, RotateCcw,
} from 'lucide-react'

// ─── Types ───

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

interface RestoreProgress {
  step: 'validating' | 'deleting' | 'inserting' | 'done' | 'error'
  message: string
  current?: number
  total?: number
  table?: string
  fileName?: string
  warnings?: string[]
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

// ─── Restore Progress Overlay ───

function RestoreProgressOverlay({ progress, onClose }: { progress: RestoreProgress; onClose?: () => void }) {
  const percent = progress.total && progress.current
    ? Math.round((progress.current / progress.total) * 100)
    : undefined

  const stepLabel = {
    validating: 'Validation du fichier',
    deleting: 'Suppression des données existantes',
    inserting: 'Restauration des données',
    done: 'Terminé',
    error: 'Erreur',
  }[progress.step]

  const stepColor = {
    validating: 'text-blue-600',
    deleting: 'text-amber-600',
    inserting: 'text-emerald-600',
    done: 'text-green-600',
    error: 'text-red-600',
  }[progress.step]

  const StepIcon = {
    validating: Loader2,
    deleting: Loader2,
    inserting: Loader2,
    done: CheckCircle2,
    error: XCircle,
  }[progress.step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl border p-6 sm:p-8 max-w-md w-full mx-4 space-y-5">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={cn(
            'rounded-full p-4',
            progress.step === 'done' ? 'bg-green-100 dark:bg-green-950/30' :
            progress.step === 'error' ? 'bg-red-100 dark:bg-red-950/30' :
            'bg-primary/10'
          )}>
            <StepIcon className={cn(
              'h-8 w-8',
              stepColor,
              progress.step !== 'done' && progress.step !== 'error' ? 'animate-spin' : ''
            )} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h3 className={cn('text-lg font-semibold', stepColor)}>
            {stepLabel}
          </h3>
          {progress.fileName && progress.step === 'validating' && (
            <p className="text-sm text-muted-foreground mt-1 font-mono truncate max-w-xs mx-auto">
              {progress.fileName}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {percent !== undefined && progress.step !== 'done' && progress.step !== 'error' && (
          <div className="space-y-2">
            <Progress value={percent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[200px]">{progress.message}</span>
              <span className="font-mono shrink-0">{percent}%</span>
            </div>
          </div>
        )}

        {/* Message without progress */}
        {percent === undefined && progress.step !== 'done' && progress.step !== 'error' && (
          <p className="text-sm text-muted-foreground text-center">{progress.message}</p>
        )}

        {/* Done state */}
        {progress.step === 'done' && (
          <div className="text-center space-y-2">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">
              {progress.message}
            </p>
            <p className="text-xs text-muted-foreground">
              La page va se recharger automatiquement...
            </p>
          </div>
        )}

        {/* Error state */}
        {progress.step === 'error' && (
          <div className="text-center space-y-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium leading-relaxed">
              {progress.message}
            </p>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose} className="mx-auto">
                Fermer
              </Button>
            )}
          </div>
        )}

        {/* Warnings */}
        {progress.warnings && progress.warnings.length > 0 && progress.step !== 'error' && (
          <div className="space-y-1">
            {progress.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Backup Section ───

export default function BackupSection() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // ─── Create Backup ───

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

  // ─── Download Backup ───

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

  // ─── Delete Backup ───

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

  // ─── File Selection ───

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json.gz') && !file.name.endsWith('.json')) {
        toast.error('Format invalide', { description: 'Sélectionnez un fichier .json.gz' })
        return
      }
      setSelectedFile(file)
      setConfirmText('')
    }
    if (e.target) e.target.value = ''
  }

  // ─── Restore from File (SSE streaming) ───

  const handleRestore = async () => {
    if (!selectedFile) return
    if (confirmText !== 'RESTAURER') {
      toast.error('Veuillez taper RESTAURER pour confirmer')
      return
    }

    // Create abort controller with 5-minute timeout
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

    try {
      setRestoring(true)
      setRestoreProgress({
        step: 'validating',
        message: 'Connexion au serveur...',
      })

      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        signal: controller.signal,
      })

      // Check if response is SSE (streaming) or regular JSON
      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        // ─── SSE Streaming ───
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const chunk of lines) {
            const eventLines = chunk.trim().split('\n')
            for (const line of eventLines) {
              if (line.startsWith('data: ')) {
                try {
                  const data: RestoreProgress = JSON.parse(line.slice(6))
                  setRestoreProgress(data)

                  // Stop on final states
                  if (data.step === 'done') {
                    clearTimeout(timeoutId)
                    // Show success, then reload
                    toast.success('Restauration réussie !', {
                      description: 'Les données ont été restaurées avec succès.',
                      duration: 3000,
                    })
                    setTimeout(() => {
                      window.location.reload()
                    }, 2000)
                    return
                  }
                  if (data.step === 'error') {
                    clearTimeout(timeoutId)
                    toast.error('Restauration échouée', {
                      description: data.message,
                      duration: 6000,
                    })
                    setRestoring(false)
                    setTimeout(() => setRestoreProgress(null), 2000)
                    return
                  }
                } catch {
                  // Ignore malformed SSE data
                }
              }
            }
          }
        }
      } else {
        // ─── Regular JSON response (error fallback) ───
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || data.message || 'Erreur de restauration')
        }

        // If we got a regular success response
        setRestoreProgress({
          step: 'done',
          message: data.message || 'Restauration terminée',
        })
        toast.success('Restauration réussie !')
        clearTimeout(timeoutId)
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err: any) {
      clearTimeout(timeoutId)

      if (err.name === 'AbortError') {
        setRestoreProgress({
          step: 'error',
          message: 'La restauration a dépassé le délai maximum (5 minutes). Vérifiez l\'état des données.',
        })
        toast.error('Délai dépassé', {
          description: 'La restauration a pris trop de temps. Vérifiez manuellement.',
          duration: 8000,
        })
      } else {
        setRestoreProgress({
          step: 'error',
          message: err.message || 'Erreur inconnue lors de la restauration',
        })
        toast.error('Erreur de restauration', {
          description: err.message || 'Erreur inconnue',
          duration: 6000,
        })
      }
    } finally {
      setRestoring(false)
      abortRef.current = null
    }
  }

  const cancelRestore = () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setRestoring(false)
    setRestoreProgress(null)
    setSelectedFile(null)
    setConfirmText('')
  }

  // ─── Non-admin view ───

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
    <>
      {/* Progress Overlay */}
      {restoreProgress && (
        <RestoreProgressOverlay progress={restoreProgress} onClose={cancelRestore} />
      )}

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
                        <p className="text-sm font-medium truncate">
                          {backup.label || `Sauvegarde du ${formatDate(backup.createdAt)}`}
                        </p>
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
                accept=".json.gz"
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
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {restoring ? 'Restauration en cours...' : 'Restaurer'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={cancelRestore}
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
    </>
  )
}
