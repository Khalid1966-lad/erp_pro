'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import {
  Settings, Building2, Calculator, Briefcase, Save, RotateCcw, Info, Upload,
  ImageIcon, X, Loader2, ZoomIn, ZoomOut, Printer, Database, FileDown, type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/stores'
import { cn } from '@/lib/utils'
import { APP_VERSION, APP_NAME, BUILD_DATE } from '@/lib/version'
import { toast } from 'sonner'
import BackupSection from './backup-section'
import { HelpButton } from '@/components/erp/shared/help-button'

// ─── Types ───

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

interface SidebarTab {
  id: string
  label: string
  icon: LucideIcon
}

// ─── Sidebar Tabs ───

const sidebarTabs: SidebarTab[] = [
  { id: 'company', label: 'Entreprise', icon: Building2 },
  { id: 'logo', label: 'Logo', icon: ImageIcon },
  { id: 'printing', label: 'Impressions', icon: Printer },
  { id: 'accounting', label: 'Comptabilité', icon: Calculator },
  { id: 'rules', label: 'Règles métier', icon: Briefcase },
  { id: 'backup', label: 'Sauvegarde', icon: Database },
  { id: 'brochure', label: 'Brochure', icon: FileDown },
  { id: 'about', label: 'À propos', icon: Info },
]

// The tabs that show save/reset buttons in the header
const settingsTabIds = new Set(['company', 'printing', 'accounting', 'rules'])

// ─── Settings Groups ───

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

// Map tab id → settingGroups index
const tabGroupMap: Record<string, number> = {
  company: 0,
  printing: 1,
  accounting: 2,
  rules: 3,
}

// ─── Logo Upload Card ───

function LogoUploadCard() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [logoShape, setLogoShape] = useState<'square' | 'rectangle'>('square')
  const [logoWidth, setLogoWidth] = useState(140)
  const [pendingSave, setPendingSave] = useState(false)

  useEffect(() => {
    // Load logo + settings
    Promise.all([
      fetch('/api/logo').then(r => r.ok).catch(() => false),
      api.get<{ settingsMap: Record<string, string> }>('/settings'),
    ]).then(([hasLogo, data]) => {
      const m = data.settingsMap || {}
      if (hasLogo) setCurrentLogo('/api/logo')
      if (m.company_logo_shape === 'rectangle') setLogoShape('rectangle')
      if (m.company_logo_width) setLogoWidth(parseInt(m.company_logo_width, 10) || 140)
    }).catch(() => {})
  }, [])

  const uploadFile = async (file: File) => {
    const allowedTypes = ['image/avif', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Type non supporté', { description: 'Utilisez PNG, JPEG, WebP, AVIF ou SVG.' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Fichier trop volumineux', { description: 'Taille maximale : 2 Mo' })
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

      setCurrentLogo('/api/logo?t=' + Date.now())
      toast.success('Logo mis à jour', {
        description: `Enregistré (${(data.size / 1024).toFixed(1)} Ko)`,
      })
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

  const saveDisplaySettings = async () => {
    try {
      await api.put('/settings', {
        settings: {
          company_logo_shape: logoShape,
          company_logo_width: String(logoWidth),
        }
      })
      setPendingSave(false)
      toast.success('Affichage du logo mis à jour')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const previewHeight = logoShape === 'rectangle'
    ? Math.round(logoWidth * 0.43) // ~2.33:1 aspect
    : logoWidth

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">Logo de l&apos;entreprise</CardTitle>
              <CardDescription className="text-sm">
                Ce logo apparaît sur les documents, factures et devis
              </CardDescription>
            </div>
          </div>
          {pendingSave && (
            <Button size="sm" onClick={saveDisplaySettings}>
              <Save className="h-3 w-3 mr-1" />
              Sauvegarder
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Live preview */}
        <div className="flex items-center justify-center p-6 bg-muted/30 rounded-xl border min-h-[120px]">
          {currentLogo ? (
            <img
              src={currentLogo}
              alt="Aperçu logo"
              style={{ width: logoWidth, height: previewHeight, objectFit: 'contain' }}
              className="max-w-full"
            />
          ) : (
            <div className="text-muted-foreground/40 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">Aucun logo téléchargé</p>
            </div>
          )}
        </div>

        {/* Size slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ZoomOut className="h-3.5 w-3.5" /> Taille d&apos;affichage
            </Label>
            <span className="text-sm text-muted-foreground font-mono">{logoWidth} px</span>
          </div>
          <input
            type="range"
            min={60}
            max={300}
            step={5}
            value={logoWidth}
            onChange={(e) => { setLogoWidth(Number(e.target.value)); setPendingSave(true) }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-muted"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>60px</span>
            <span>300px</span>
          </div>
        </div>

        {/* Shape selector */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">Forme :</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setLogoShape('square'); setPendingSave(true) }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                logoShape === 'square'
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div className="w-4 h-4 border border-current rounded-sm" />
              Carré
            </button>
            <button
              type="button"
              onClick={() => { setLogoShape('rectangle'); setPendingSave(true) }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                logoShape === 'rectangle'
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div className="w-5 h-3 border border-current rounded-sm" />
              Rectangle
            </button>
          </div>
        </div>

        {/* Upload area */}
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer',
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
              <span className="text-sm text-muted-foreground">Téléchargement...</span>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 mx-auto text-muted-foreground/60 mb-1.5" />
              <p className="text-sm font-medium">Glissez-déposez ou cliquez pour parcourir</p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPEG, WebP, AVIF, SVG (max 2 Mo) — image originale sans compression
              </p>
            </>
          )}
        </div>

        {/* Delete button */}
        {currentLogo && (
          <div className="flex justify-end">
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Settings Group Section ───

function SettingsGroupSection({
  group,
  settingsMap,
  handleChange,
  isDisabled,
}: {
  group: SettingGroup
  settingsMap: Record<string, string>
  handleChange: (key: string, value: string) => void
  isDisabled: boolean
}) {
  return (
    <Card>
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
  )
}

// ─── Brochure Section ───

function BrochureSection() {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await fetch('/api/brochure/download')
      if (!response.ok) throw new Error('Erreur de téléchargement')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'GEMAPLAST_ERP_PRO_Brochure.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Brochure téléchargée avec succès')
    } catch {
      toast.error('Erreur lors du téléchargement de la brochure')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground"><FileDown className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">Brochure marketing</CardTitle>
              <CardDescription className="text-sm">
                Résumé marketing de GEMA ERP PRO pour GEMAPLAST Maroc
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Preview */}
          <div className="border rounded-xl overflow-hidden bg-muted/20">
            <div className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
                <FileDown className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">GEMA ERP PRO</h3>
              <p className="text-sm text-muted-foreground mt-1">Brochure commerciale v1.2.9</p>
              <p className="text-xs text-muted-foreground mt-0.5">Signée par Jazel Web Agency</p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg font-bold">4</div>
              <div>
                <p className="text-xs text-muted-foreground">Pages</p>
                <p className="text-sm font-semibold">4 pages complètes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center text-lg font-bold">8</div>
              <div>
                <p className="text-xs text-muted-foreground">Modules détaillés</p>
                <p className="text-sm font-semibold">Ventes, Achats, Stock...</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center text-lg font-bold">
                <span style={{ fontSize: '14px' }}>JW</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Créateur</p>
                <p className="text-sm font-semibold">Jazel Web Agency</p>
              </div>
            </div>
          </div>

          {/* Signature Info */}
          <div className="border rounded-xl p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Créé et signé par</p>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">JW</div>
              <div>
                <p className="text-sm font-bold text-foreground">Jazel Web Agency</p>
                <p className="text-xs text-muted-foreground">Conception & Développement</p>
                <p className="text-xs text-muted-foreground">contact@jazelwebagency.com | +212 6 62 42 58 90</p>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div className="flex justify-center pt-2">
            <Button
              size="lg"
              onClick={handleDownload}
              disabled={downloading}
              className="px-8"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {downloading ? 'Téléchargement...' : 'Télécharger la brochure PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── About Section ───

function AboutSection() {
  return (
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
  )
}

// ─── Main Settings View ───

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('company')
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({})
  const [originalMap, setOriginalMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { user } = useAuthStore()

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const showSaveButtons = settingsTabIds.has(activeTab) && isAdmin

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
        <div className="flex gap-6">
          <div className="md:w-48 shrink-0 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="flex-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-64 mb-4" />
            ))}
          </div>
        </div>
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
        <div className="flex items-center gap-2">
          <HelpButton section="administration" sub="parametres" />
          {showSaveButtons && (
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
      </div>

      {/* Sidebar + Content Layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="md:w-48 shrink-0">
          {/* Mobile: horizontal scrollable tabs */}
          <div className="flex md:hidden gap-1 overflow-x-auto pb-2 scrollbar-none">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 py-2 px-3 rounded-lg text-sm whitespace-nowrap cursor-pointer transition-colors shrink-0',
                    activeTab === tab.id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
          {/* Desktop: vertical sidebar */}
          <div className="hidden md:flex flex-col gap-1 sticky top-6">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 py-2 px-3 rounded-lg text-sm cursor-pointer transition-colors',
                    activeTab === tab.id
                      ? 'bg-muted font-medium text-foreground border-l-2 border-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'company' && (
            <SettingsGroupSection
              group={settingGroups[tabGroupMap.company]}
              settingsMap={settingsMap}
              handleChange={handleChange}
              isDisabled={!isAdmin}
            />
          )}

          {activeTab === 'logo' && isAdmin && <LogoUploadCard />}

          {activeTab === 'logo' && !isAdmin && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Accès réservé aux administrateurs.</p>
              </CardContent>
            </Card>
          )}

          {activeTab === 'printing' && (
            <SettingsGroupSection
              group={settingGroups[tabGroupMap.printing]}
              settingsMap={settingsMap}
              handleChange={handleChange}
              isDisabled={!isAdmin}
            />
          )}

          {activeTab === 'accounting' && (
            <SettingsGroupSection
              group={settingGroups[tabGroupMap.accounting]}
              settingsMap={settingsMap}
              handleChange={handleChange}
              isDisabled={!isAdmin}
            />
          )}

          {activeTab === 'rules' && (
            <SettingsGroupSection
              group={settingGroups[tabGroupMap.rules]}
              settingsMap={settingsMap}
              handleChange={handleChange}
              isDisabled={!isAdmin}
            />
          )}

          {activeTab === 'backup' && <BackupSection />}

          {activeTab === 'brochure' && <BrochureSection />}

          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>

      {/* Sticky Save Bar — only for settings tabs */}
      {showSaveButtons && hasChanges && (
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
