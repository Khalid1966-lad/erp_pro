'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Settings, Building2, Calculator, Briefcase, Save, RotateCcw, Info, Upload, ImageIcon, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/stores'
import { cn } from '@/lib/utils'
import { APP_VERSION, APP_NAME, BUILD_DATE } from '@/lib/version'
import { toast } from 'sonner'
import Image from 'next/image'
import { useRef } from 'react'

interface Setting {
  key: string
  value: string
}

interface SettingsResponse {
  settings: Setting[]
  settingsMap: Record<string, string>
}

interface SettingGroup {
  title: string
  description: string
  icon: React.ReactNode
  category: string
  fields: SettingField[]
}

interface SettingField {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select' | 'switch'
  placeholder?: string
  options?: { value: string; label: string }[]
  description?: string
}

const settingGroups: SettingGroup[] = [
  {
    title: 'Informations entreprise',
    description: "Coordonnées et informations légales de l'entreprise",
    icon: <Building2 className="h-5 w-5" />,
    category: 'company',
    fields: [
      { key: 'company_name', label: 'Nom de l\'entreprise', type: 'text', placeholder: 'GEMA ERP PRO' },
      { key: 'company_address', label: 'Adresse', type: 'textarea', placeholder: '12 Rue de l\'Industrie' },
      { key: 'company_city', label: 'Ville', type: 'text', placeholder: 'Lyon' },
      { key: 'company_postal_code', label: 'Code postal', type: 'text', placeholder: '69001' },
      { key: 'company_country', label: 'Pays', type: 'text', placeholder: 'Maroc' },
      { key: 'company_phone', label: 'Téléphone', type: 'text', placeholder: '+212 5 XX XX XX XX' },
      { key: 'company_email', label: 'Email', type: 'text', placeholder: 'contact@gema-erp.com' },
      { key: 'company_siret', label: 'ICE (Identifiant Commun de l\'Entreprise)', type: 'text', placeholder: 'XXXXXXXXXXXXX' },
      { key: 'company_tva_number', label: 'N° TVA Intracommunautaire', type: 'text', placeholder: 'MA XX XXXXXXXXX' },
      { key: 'company_cnss', label: 'N° CNSS', type: 'text', placeholder: 'XXXXXXXXXX' },
      { key: 'company_if', label: 'Identification Fiscale (IF)', type: 'text', placeholder: 'XXXXXXXXXX' },
      { key: 'company_rc', label: 'Registre de Commerce (RC)', type: 'text', placeholder: 'XXXXXX' },
      { key: 'company_legal_form', label: 'Forme juridique', type: 'text', placeholder: 'SARL, SA, SARL AU...' },
      { key: 'company_capital', label: 'Capital social', type: 'text', placeholder: '100 000 MAD' },
    ]
  },
  {
    title: 'Pied de page des impressions',
    description: 'Informations affichées en bas de chaque document imprimé',
    icon: <Settings className="h-5 w-5" />,
    category: 'print_footer',
    fields: [
      { key: 'print_footer_line1', label: 'Ligne 1', type: 'text', placeholder: 'Siège social : ...' },
      { key: 'print_footer_line2', label: 'Ligne 2', type: 'text', placeholder: 'Tél : ... | Fax : ...' },
      { key: 'print_footer_line3', label: 'Ligne 3', type: 'text', placeholder: 'ICE : ... | IF : ... | CNSS : ...' },
      { key: 'print_footer_line4', label: 'Ligne 4', type: 'text', placeholder: 'RC : ... | Capital : ...' },
    ]
  },
  {
    title: 'Comptabilité & Finance',
    description: 'Paramètres comptables et financiers',
    icon: <Calculator className="h-5 w-5" />,
    category: 'accounting',
    fields: [
      {
        key: 'default_currency', label: 'Devise par défaut', type: 'select',
        options: [
          { value: 'MAD', label: 'MAD — Dirham marocain' },
          { value: 'USD', label: 'USD — Dollar US' },
          { value: 'GBP', label: 'GBP — Livre sterling' },
        ]
      },
      { key: 'default_payment_terms', label: 'Conditions de paiement par défaut (jours)', type: 'number', placeholder: '30' },
      {
        key: 'tva_rate_standard', label: 'TVA taux normal (%)', type: 'number', placeholder: '20'
      },
      {
        key: 'tva_rate_reduced', label: 'TVA taux réduit (%)', type: 'number', placeholder: '10'
      },
      {
        key: 'invoice_prefix', label: 'Préfixe des factures', type: 'text', placeholder: 'FA'
      },
      {
        key: 'invoice_next_number', label: 'Prochain n° de facture', type: 'text', placeholder: 'FA-2025-001'
      },
      {
        key: 'quote_prefix', label: 'Préfixe des devis', type: 'text', placeholder: 'DEV'
      },
      {
        key: 'quote_next_number', label: 'Prochain n° de devis', type: 'text', placeholder: 'DEV-2025-001'
      },
      {
        key: 'fiscal_year_start', label: 'Début d\'exercice (MM-DD)', type: 'text', placeholder: '01-01'
      },
    ]
  },
  {
    title: "Règles métier",
    description: 'Configuration des règles et seuils de l\'application',
    icon: <Briefcase className="h-5 w-5" />,
    category: 'business',
    fields: [
      {
        key: 'stock_alert_threshold', label: 'Seuil d\'alerte stock bas', type: 'number', placeholder: '10',
        description: 'Alerte quand le stock tombe sous ce seuil'
      },
      {
        key: 'default_margin_rate', label: 'Taux de marge par défaut (%)', type: 'number', placeholder: '30'
      },
      {
        key: 'enable_stock_management', label: 'Gestion de stock activée', type: 'switch',
        description: 'Activer/désactiver le suivi des stocks'
      },
      {
        key: 'enable_production', label: 'Module production activé', type: 'switch',
        description: 'Activer/désactiver les fonctionnalités de production'
      },
      {
        key: 'default_unit', label: 'Unité de mesure par défaut', type: 'select',
        options: [
          { value: 'unit', label: 'Unité' },
          { value: 'kg', label: 'Kilogramme' },
          { value: 'liter', label: 'Litre' },
          { value: 'meter', label: 'Mètre' },
          { value: 'm2', label: 'Mètre carré' },
          { value: 'm3', label: 'Mètre cube' },
        ]
      },
      {
        key: 'email_notifications', label: 'Notifications email', type: 'switch',
        description: 'Envoyer des notifications par email'
      },
    ]
  }
]

// ─── Logo Upload Card ───
function LogoUploadCard() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    // Check if custom logo exists
    fetch('/api/logo')
      .then(r => {
        if (r.ok) setCurrentLogo('/api/logo')
        else setCurrentLogo(null)
      })
      .catch(() => setCurrentLogo(null))
  }, [])

  const uploadFile = async (file: File) => {
    const allowedTypes = ['image/avif', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type non supporté', { description: 'Utilisez PNG, JPEG, WebP, AVIF ou SVG.' })
      return
    }
    if (file.size > 500 * 1024) {
      toast.error('Fichier trop volumineux', { description: 'Taille maximale : 500 Ko' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur de téléchargement')
      }

      setCurrentLogo('/api/logo')
      toast.success('Logo mis à jour', {
        description: data.compressionRatio > 0
          ? `Compressé : ${data.compressionRatio}% réduit (${(data.size / 1024).toFixed(1)} Ko)`
          : `Enregistré (${(data.size / 1024).toFixed(1)} Ko)`,
      })

      // Bust cache by adding timestamp
      const img = new Image()
      img.src = `/api/logo?t=${Date.now()}`
    } catch (err: any) {
      toast.error('Erreur', { description: err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
          <div>
            <CardTitle className="text-base">Logo de l&apos;entreprise</CardTitle>
            <CardDescription className="text-sm">
              Ce logo apparaît sur les documents, factures et devis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Preview */}
          <div className="w-32 h-32 bg-muted rounded-xl border-2 border-dashed border-border flex items-center justify-center shrink-0 overflow-hidden relative">
            {currentLogo ? (
              <Image
                src={currentLogo}
                alt="Logo entreprise"
                fill
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>

          {/* Upload area */}
          <div className="flex-1 space-y-3 w-full">
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/avif,image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile(file)
                  e.target.value = ''
                }}
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Compression en cours...</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium">
                    Glissez-déposez votre logo ici
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou cliquez pour parcourir — PNG, JPEG, WebP, AVIF, SVG (max 500 Ko)
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    L&apos;image est automatiquement compressée en AVIF haute qualité
                  </p>
                </>
              )}
            </div>
            {currentLogo && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  try {
                    await fetch('/api/upload', {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
                    })
                    setCurrentLogo(null)
                    toast.success('Logo supprimé', { description: 'Le logo par défaut sera utilisé' })
                  } catch {
                    toast.error('Erreur lors de la suppression du logo')
                  }
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Réinitialiser le logo par défaut
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsView() {
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({})
  const [originalMap, setOriginalMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { user } = useAuthStore()

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<SettingsResponse>('/settings')
      setSettingsMap(data.settingsMap || {})
      setOriginalMap(data.settingsMap || {})
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement paramètres')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleChange = (key: string, value: string) => {
    setSettingsMap(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put('/settings', { settings: settingsMap })
      setOriginalMap({ ...settingsMap })
      toast.success('Paramètres sauvegardés')
    } catch (err: any) {
      toast.error(err.message || 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettingsMap({ ...originalMap })
    toast.info('Modifications annulées')
  }

  const hasChanges = JSON.stringify(settingsMap) !== JSON.stringify(originalMap)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-48" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Paramètres</h2>
          {!isAdmin && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Lecture seule
            </span>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        )}
      </div>

      {/* Logo upload */}
      {isAdmin && <LogoUploadCard />}

      {/* Settings Groups */}
      {settingGroups.map((group) => (
        <Card key={group.category}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{group.icon}</div>
              <div>
                <CardTitle className="text-base">{group.title}</CardTitle>
                <CardDescription className="text-sm">{group.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.fields.map((field) => {
                const value = settingsMap[field.key] || ''
                const isDisabled = !isAdmin

                return (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={field.key} className="text-sm font-medium">
                          {field.label}
                        </Label>
                        {field.type === 'switch' && (
                          <Switch
                            id={field.key}
                            checked={value === 'true'}
                            onCheckedChange={(checked) => handleChange(field.key, checked ? 'true' : 'false')}
                            disabled={isDisabled}
                          />
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      )}
                      {field.type === 'text' && (
                        <Input
                          id={field.key}
                          value={value}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          disabled={isDisabled}
                        />
                      )}
                      {field.type === 'number' && (
                        <Input
                          id={field.key}
                          type="number"
                          step="0.01"
                          value={value}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          disabled={isDisabled}
                        />
                      )}
                      {field.type === 'textarea' && (
                        <Textarea
                          id={field.key}
                          value={value}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={2}
                          disabled={isDisabled}
                        />
                      )}
                      {field.type === 'select' && field.options && (
                        <Select
                          value={value}
                          onValueChange={(v) => handleChange(field.key, v)}
                          disabled={isDisabled}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Separator className="mt-4 hidden md:block" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* À propos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground"><Info className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">À propos</CardTitle>
              <CardDescription className="text-sm">Informations sur l&apos;application</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Application</p>
              <p className="text-sm font-semibold">{APP_NAME}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="text-sm font-semibold">v{APP_VERSION}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date de build</p>
              <p className="text-sm font-semibold">{BUILD_DATE}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save bar (bottom sticky) */}
      {isAdmin && hasChanges && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Modifications non sauvegardées</span>
            <Button variant="outline" size="sm" onClick={handleReset}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
