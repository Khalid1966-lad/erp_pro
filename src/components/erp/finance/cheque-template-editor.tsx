'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Save,
  Printer,
  Eye,
  EyeOff,
  Grid3X3,
  Upload,
  Ruler,
  Undo2,
  Download,
  Star,
  Copy,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface ChequeTemplateField {
  id?: string
  fieldKey: string
  label?: string | null
  x: number
  y: number
  width?: number | null
  height?: number | null
  fontSize: number
  fontWeight: string
  textAlign: string
  fontFamily: string
  sortOrder: number
}

export interface ChequeTemplate {
  id: string
  name: string
  description?: string | null
  bankName?: string | null
  chequeModel?: string | null
  chequeWidth: number
  chequeHeight: number
  scanOffsetX?: number | null
  scanOffsetY?: number | null
  backgroundImage?: string | null
  isDefault: boolean
  fields: ChequeTemplateField[]
  createdAt: string
  updatedAt: string
}

// ═══════════════════════════════════════════════════════════
// Available Fields for Cheque
// ═══════════════════════════════════════════════════════════

const CHEQUE_FIELDS = [
  { key: 'montant_chiffres', label: 'Montant en chiffres', required: true },
  { key: 'montant_lettres', label: 'Montant en lettres', required: true },
  { key: 'beneficiaire', label: 'Bénéficiaire', required: true },
  { key: 'lieu_date', label: 'Lieu et date', required: true },
  { key: 'date_emission', label: "Date d'émission" },
  { key: 'date_echeance', label: "Date d'échéance" },
  { key: 'numero_cheque', label: 'Numéro du chèque' },
  { key: 'banque_emettrice', label: 'Banque émettrice' },
  { key: 'compte_emetteur', label: 'Compte émetteur (RIB)' },
  { key: 'bic', label: 'BIC' },
  { key: 'libelle', label: 'Motif / Libellé' },
]

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const MM_TO_PX = 3.7795275591 // 1mm = 3.78px at 96 DPI
const SNAP_GRID = 1 // mm
const CHEQUE_STANDARD_WIDTH = 160 // mm
const CHEQUE_STANDARD_HEIGHT = 75 // mm

const BANKS = [
  'Attijariwafa Bank',
  'BMCE Bank of Africa',
  'Société Générale (SGA)',
  'Banque Populaire (CPM)',
  'CIH Bank',
  'Crédit Agricole du Maroc',
  'CFG Bank',
  'Al Barid Bank',
  'Autre',
]

const CHEQUE_MODELS = [
  { value: 'standard', label: 'Standard' },
  { value: 'entreprise', label: 'Entreprise' },
  { value: 'personnalise', label: 'Personnalisé' },
]

// ═══════════════════════════════════════════════════════════
// Sample data for preview
// ═══════════════════════════════════════════════════════════

const SAMPLE_FIELD_VALUES: Record<string, string> = {
  montant_chiffres: '12 500,00 MAD',
  montant_lettres: 'DOUZE MILLE CINQ CENTS DIRHAMS',
  beneficiaire: 'SOCIÉTÉ ABC SERVICES SARL',
  lieu_date: 'Casablanca, le 12/06/2026',
  date_emission: '12/06/2026',
  date_echeance: '12/07/2026',
  numero_cheque: '0012345678',
  banque_emettrice: 'Attijariwafa Bank',
  compte_emetteur: 'MA00 0000 0000 0000 0000 0000 00',
  bic: 'BCMAMAMC',
  libelle: 'Fact. FRS FA-2026-0042',
  type_document: 'CHÈQUE',
}

// ═══════════════════════════════════════════════════════════
// Draggable Field Component
// ═══════════════════════════════════════════════════════════

function DraggableField({
  field,
  sampleValue,
  isSelected,
  onSelect,
  onDragEnd,
  showGrid,
  chequeWidth,
  chequeHeight,
}: {
  field: ChequeTemplateField
  sampleValue: string
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  showGrid: boolean
  chequeWidth: number
  chequeHeight: number
}) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onSelect()
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    },
    [onSelect]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.x) / MM_TO_PX
      const dy = (e.clientY - dragStart.y) / MM_TO_PX
      const snappedX = Math.round((field.x + dx) / SNAP_GRID) * SNAP_GRID
      const snappedY = Math.round((field.y + dy) / SNAP_GRID) * SNAP_GRID
      setDragOffset({ x: snappedX - field.x, y: snappedY - field.y })
    }

    const handleMouseUp = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.x) / MM_TO_PX
      const dy = (e.clientY - dragStart.y) / MM_TO_PX
      const snappedX = Math.max(0, Math.round((field.x + dx) / SNAP_GRID) * SNAP_GRID)
      const snappedY = Math.max(0, Math.round((field.y + dy) / SNAP_GRID) * SNAP_GRID)
      onDragEnd(snappedX, snappedY)
      setIsDragging(false)
      setDragOffset({ x: 0, y: 0 })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, field.x, field.y, onDragEnd])

  const posX = (field.x + dragOffset.x) * MM_TO_PX
  const posY = (field.y + dragOffset.y) * MM_TO_PX
  const widthPx = field.width ? field.width * MM_TO_PX : 'auto'
  const heightPx = field.height ? field.height * MM_TO_PX : 'auto'

  const fieldDef = CHEQUE_FIELDS.find((f) => f.key === field.fieldKey)

  return (
    <div
      ref={fieldRef}
      className={`absolute cursor-move select-none group ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-1'
          : 'hover:ring-1 hover:ring-blue-300'
      } ${isDragging ? 'opacity-80 z-50' : 'z-10'}`}
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        width: typeof widthPx === 'number' ? `${widthPx}px` : undefined,
        minWidth: '80px',
        height: typeof heightPx === 'number' ? `${heightPx}px` : undefined,
        fontSize: `${field.fontSize}px`,
        fontWeight: field.fontWeight,
        textAlign: field.textAlign as 'left' | 'center' | 'right',
        fontFamily: field.fontFamily,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Field content / preview */}
      <div
        className={`px-1 py-0.5 rounded whitespace-nowrap ${
          isSelected ? 'bg-blue-50/70' : 'bg-white/40'
        }`}
      >
        <div
          className="truncate"
          style={{
            fontSize: `${field.fontSize * 0.8}px`,
            color: '#374151',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sampleValue}
        </div>
      </div>

      {/* Field label tooltip */}
      <div
        className={`absolute -top-6 left-0 text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap ${
          isSelected ? 'bg-blue-500 text-white' : 'bg-gray-600 text-white opacity-0 group-hover:opacity-100'
        } transition-opacity pointer-events-none`}
      >
        {fieldDef?.label || field.fieldKey}
      </div>

      {/* Position indicator when selected */}
      {isSelected && showGrid && (
        <div className="absolute -bottom-5 left-0 text-[8px] text-blue-600 font-mono whitespace-nowrap">
          {field.x.toFixed(0)}×{field.y.toFixed(0)} mm
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Editor Component
// ═══════════════════════════════════════════════════════════

interface ChequeTemplateEditorProps {
  open: boolean
  onClose: () => void
  template?: ChequeTemplate | null
  onSave: (template: ChequeTemplate) => void
}

export function ChequeTemplateEditor({
  open,
  onClose,
  template,
  onSave,
}: ChequeTemplateEditorProps) {
  // Template metadata
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bankName, setBankName] = useState('')
  const [chequeModel, setChequeModel] = useState('standard')
  const [chequeWidth, setChequeWidth] = useState(CHEQUE_STANDARD_WIDTH)
  const [chequeHeight, setChequeHeight] = useState(CHEQUE_STANDARD_HEIGHT)
  const [isDefault, setIsDefault] = useState(false)

  // Editor state
  const [fields, setFields] = useState<ChequeTemplateField[]>([])
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [undoStack, setUndoStack] = useState<ChequeTemplateField[][]>([])

  const chequeRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize from template
  useEffect(() => {
    if (template) {
      setName(template.name)
      setDescription(template.description || '')
      setBankName(template.bankName || '')
      setChequeModel(template.chequeModel || 'standard')
      setChequeWidth(template.chequeWidth)
      setChequeHeight(template.chequeHeight)
      setIsDefault(template.isDefault)
      setFields(template.fields || [])
      setBackgroundImage(template.backgroundImage || null)
    } else {
      setName('')
      setDescription('')
      setBankName('')
      setChequeModel('standard')
      setChequeWidth(CHEQUE_STANDARD_WIDTH)
      setChequeHeight(CHEQUE_STANDARD_HEIGHT)
      setIsDefault(false)
      setFields([])
      setBackgroundImage(null)
    }
    setSelectedFieldKey(null)
    setShowGrid(true)
    setShowPreview(true)
    setUndoStack([])
  }, [template, open])

  // Push to undo stack before changes
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-20), JSON.parse(JSON.stringify(fields))])
  }, [fields])

  // Undo
  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const newStack = [...prev]
      const lastState = newStack.pop()!
      setFields(lastState)
      return newStack
    })
  }, [])

  // Add field
  const handleAddField = useCallback(
    (fieldKey: string) => {
      if (fields.find((f) => f.fieldKey === fieldKey)) {
        toast.warning('Ce champ existe déjà')
        return
      }
      pushUndo()
      const newField: ChequeTemplateField = {
        fieldKey,
        label: CHEQUE_FIELDS.find((f) => f.key === fieldKey)?.label || fieldKey,
        x: 15,
        y: fields.length * 8 + 10,
        width: fieldKey === 'montant_lettres' ? 130 : null,
        height: null,
        fontSize: fieldKey === 'montant_chiffres' ? 14 : 11,
        fontWeight: fieldKey === 'montant_chiffres' ? 'bold' : 'normal',
        textAlign: fieldKey === 'montant_chiffres' ? 'right' : 'left',
        fontFamily: 'sans-serif',
        sortOrder: fields.length,
      }
      setFields((prev) => [...prev, newField])
      setSelectedFieldKey(fieldKey)
    },
    [fields, pushUndo]
  )

  // Remove field
  const handleRemoveField = useCallback(
    (fieldKey: string) => {
      pushUndo()
      setFields((prev) => prev.filter((f) => f.fieldKey !== fieldKey))
      if (selectedFieldKey === fieldKey) setSelectedFieldKey(null)
    },
    [pushUndo, selectedFieldKey]
  )

  // Move field
  const handleFieldDragEnd = useCallback(
    (fieldKey: string, x: number, y: number) => {
      pushUndo()
      setFields((prev) =>
        prev.map((f) => (f.fieldKey === fieldKey ? { ...f, x, y } : f))
      )
    },
    [pushUndo]
  )

  // Update field properties
  const updateSelectedField = useCallback(
    (updates: Partial<ChequeTemplateField>) => {
      if (!selectedFieldKey) return
      pushUndo()
      setFields((prev) =>
        prev.map((f) => (f.fieldKey === selectedFieldKey ? { ...f, ...updates } : f))
      )
    },
    [selectedFieldKey, pushUndo]
  )

  // Upload background image
  const handleUploadImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // Compress if needed
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        // Scale down if too large (max 2000px wide for A4 scan)
        const maxW = 2000
        if (img.width > maxW) {
          canvas.width = maxW
          canvas.height = (img.height * maxW) / img.width
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/jpeg', 0.7)
        setBackgroundImage(compressed)
        toast.success('Image chargée')
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }, [])

  // Save template
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Le nom du template est obligatoire')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        id: template?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        bankName: bankName || undefined,
        chequeModel: chequeModel,
        chequeWidth,
        chequeHeight,
        backgroundImage: backgroundImage || undefined,
        isDefault,
        fields: fields.map((f, i) => ({
          ...f,
          sortOrder: i,
        })),
      }

      const method = template?.id ? 'PUT' : 'POST'
      const res = await fetch('/api/cheque-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur serveur')
      }

      const saved = await res.json()
      toast.success(template?.id ? 'Template mis à jour' : 'Template créé')
      onSave(saved)
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [name, description, bankName, chequeModel, chequeWidth, chequeHeight, backgroundImage, isDefault, fields, template, onSave, onClose])

  // Duplicate template
  const handleDuplicate = useCallback(async () => {
    if (!template?.id) return
    const newName = `${template.name} (copie)`
    setName(newName)
    // Clear template id to create new
    const newFields = template.fields.map((f) => ({ ...f }))
    setFields(newFields)
    toast.info('Modifiez le nom et sauvegardez pour créer une copie')
  }, [template])

  const selectedField = fields.find((f) => f.fieldKey === selectedFieldKey)
  const usedFieldKeys = fields.map((f) => f.fieldKey)
  const availableFields = CHEQUE_FIELDS.filter((f) => !usedFieldKeys.includes(f.key))

  // Cheque area dimensions in pixels
  const areaWidthPx = chequeWidth * MM_TO_PX
  const areaHeightPx = chequeHeight * MM_TO_PX

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] w-[1400px] h-[850px] p-0 overflow-hidden flex flex-col [&>button]:hidden">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {template?.id ? 'Modifier le modèle de chèque' : 'Nouveau modèle de chèque'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* ─── LEFT PANEL: Properties ─── */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={22} minSize={18} maxSize={30}>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {/* Template Info */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Informations
                  </Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Nom *</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Modèle chèque AWB"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description optionnelle"
                        className="text-sm min-h-[60px]"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Banque</Label>
                      <Select value={bankName} onValueChange={setBankName}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BANKS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Modèle</Label>
                      <Select value={chequeModel} onValueChange={setChequeModel}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHEQUE_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Modèle par défaut</Label>
                      <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cheque Dimensions */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Ruler className="h-3 w-3 inline mr-1" />
                    Dimensions chèque (mm)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Largeur</Label>
                      <Input
                        type="number"
                        value={chequeWidth}
                        onChange={(e) => setChequeWidth(Number(e.target.value))}
                        className="h-8 text-sm"
                        min={50}
                        max={250}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Hauteur</Label>
                      <Input
                        type="number"
                        value={chequeHeight}
                        onChange={(e) => setChequeHeight(Number(e.target.value))}
                        className="h-8 text-sm"
                        min={30}
                        max={200}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Add Fields */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Champs disponibles
                  </Label>
                  {availableFields.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Tous les champs sont ajoutés
                    </p>
                  )}
                  <div className="space-y-1">
                    {availableFields.map((f) => (
                      <Button
                        key={f.key}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start h-7 text-xs"
                        onClick={() => handleAddField(f.key)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {f.label}
                        {f.required && (
                          <Badge variant="secondary" className="ml-auto text-[9px] px-1">
                            Req.
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Background Image */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Image de fond
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadImage}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Importer
                    </Button>
                    {backgroundImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setBackgroundImage(null)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {backgroundImage && (
                    <p className="text-[10px] text-muted-foreground">
                      Image chargée ✓
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ─── CENTER: Canvas Editor ─── */}
          <ResizablePanel defaultSize={50} minSize={35}>
          <div className="flex flex-col overflow-hidden bg-gray-100 h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b bg-white flex-shrink-0">
              <Button
                variant={showGrid ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3X3 className="h-3 w-3 mr-1" />
                Grille
              </Button>
              <Button
                variant={showPreview ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                Aperçu
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Annuler
              </Button>
              <div className="flex-1" />
              {template?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleDuplicate}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Dupliquer
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
              >
                <Save className="h-3 w-3 mr-1" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-8">
              <div className="relative" style={{ padding: '20px' }}>
                {/* Page background */}
                <div
                  className="bg-white shadow-lg border"
                  style={{
                    width: `${areaWidthPx + 40}px`,
                    height: `${areaHeightPx + 40}px`,
                  }}
                >
                  {/* Cheque area */}
                  <div
                    ref={chequeRef}
                    className="relative overflow-hidden border border-dashed border-gray-300"
                    style={{
                      width: `${areaWidthPx}px`,
                      height: `${areaHeightPx}px`,
                      margin: '20px',
                    }}
                    onClick={() => setSelectedFieldKey(null)}
                  >
                    {/* Background image */}
                    {backgroundImage && (
                      <img
                        src={backgroundImage}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        style={{ opacity: 0.3 }}
                      />
                    )}

                    {/* Grid overlay */}
                    {showGrid && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ zIndex: 1 }}
                      >
                        <defs>
                          <pattern
                            id="chequeGrid"
                            width={SNAP_GRID * MM_TO_PX}
                            height={SNAP_GRID * MM_TO_PX}
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d={`M ${SNAP_GRID * MM_TO_PX} 0 L 0 0 0 ${SNAP_GRID * MM_TO_PX}`}
                              fill="none"
                              stroke="rgba(156,163,175,0.3)"
                              strokeWidth="0.5"
                            />
                          </pattern>
                          {/* Major grid lines every 10mm */}
                          <pattern
                            id="chequeMajorGrid"
                            width={10 * MM_TO_PX}
                            height={10 * MM_TO_PX}
                            patternUnits="userSpaceOnUse"
                          >
                            <rect
                              width={10 * MM_TO_PX}
                              height={10 * MM_TO_PX}
                              fill="url(#chequeGrid)"
                            />
                            <path
                              d={`M ${10 * MM_TO_PX} 0 L 0 0 0 ${10 * MM_TO_PX}`}
                              fill="none"
                              stroke="rgba(156,163,175,0.5)"
                              strokeWidth="1"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#chequeMajorGrid)" />
                      </svg>
                    )}

                    {/* Draggable Fields */}
                    {fields.map((field) => (
                      <DraggableField
                        key={field.fieldKey}
                        field={field}
                        sampleValue={showPreview ? (SAMPLE_FIELD_VALUES[field.fieldKey] || `[${field.fieldKey}]`) : `[${field.fieldKey}]`}
                        isSelected={selectedFieldKey === field.fieldKey}
                        onSelect={() => setSelectedFieldKey(field.fieldKey)}
                        onDragEnd={(x, y) => handleFieldDragEnd(field.fieldKey, x, y)}
                        showGrid={showGrid}
                        chequeWidth={chequeWidth}
                        chequeHeight={chequeHeight}
                      />
                    ))}
                  </div>

                  {/* Dimensions label */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-mono whitespace-nowrap">
                    {chequeWidth} × {chequeHeight} mm
                  </div>
                </div>
              </div>
            </div>
          </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ─── RIGHT PANEL: Field Properties ─── */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={35}>
          <div className="border-l bg-muted/30 flex flex-col overflow-hidden h-full">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Champs ajoutés
                </Label>

                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Ajoutez des champs depuis le panneau de gauche
                  </p>
                )}

                {/* Field List */}
                <div className="space-y-1">
                  {fields.map((f) => {
                    const def = CHEQUE_FIELDS.find((d) => d.key === f.fieldKey)
                    return (
                      <div
                        key={f.fieldKey}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                          selectedFieldKey === f.fieldKey
                            ? 'bg-blue-100 border border-blue-300'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                        onClick={() => setSelectedFieldKey(f.fieldKey)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{def?.label || f.fieldKey}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {f.x.toFixed(0)},{f.y.toFixed(0)} mm — {f.fontSize}pt
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-destructive shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveField(f.fieldKey)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                {selectedField && (
                  <>
                    <Separator />

                    {/* Selected Field Properties */}
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Propriétés du champ
                    </Label>

                    <div className="space-y-2 bg-white rounded p-2 border">
                      <div>
                        <Label className="text-[10px]">Police (pt)</Label>
                        <Input
                          type="number"
                          value={selectedField.fontSize}
                          onChange={(e) => updateSelectedField({ fontSize: Number(e.target.value) })}
                          className="h-7 text-xs"
                          min={6}
                          max={36}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Graisse</Label>
                        <Select
                          value={selectedField.fontWeight}
                          onValueChange={(v) => updateSelectedField({ fontWeight: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="bold">Gras</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Alignement</Label>
                        <Select
                          value={selectedField.textAlign}
                          onValueChange={(v) => updateSelectedField({ textAlign: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Gauche</SelectItem>
                            <SelectItem value="center">Centré</SelectItem>
                            <SelectItem value="right">Droite</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Police</Label>
                        <Select
                          value={selectedField.fontFamily}
                          onValueChange={(v) => updateSelectedField({ fontFamily: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sans-serif">Sans-serif</SelectItem>
                            <SelectItem value="serif">Serif</SelectItem>
                            <SelectItem value="monospace">Monospace</SelectItem>
                            <SelectItem value="cursive">Cursive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <Label className="text-[10px]">Largeur (mm)</Label>
                          <Input
                            type="number"
                            value={selectedField.width || ''}
                            onChange={(e) =>
                              updateSelectedField({
                                width: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="h-7 text-xs"
                            placeholder="Auto"
                            min={10}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Hauteur (mm)</Label>
                          <Input
                            type="number"
                            value={selectedField.height || ''}
                            onChange={(e) =>
                              updateSelectedField({
                                height: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className="h-7 text-xs"
                            placeholder="Auto"
                            min={3}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <Label className="text-[10px]">X (mm)</Label>
                          <Input
                            type="number"
                            value={selectedField.x}
                            onChange={(e) =>
                              updateSelectedField({ x: Number(e.target.value) })
                            }
                            className="h-7 text-xs"
                            step={0.5}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Y (mm)</Label>
                          <Input
                            type="number"
                            value={selectedField.y}
                            onChange={(e) =>
                              updateSelectedField({ y: Number(e.target.value) })
                            }
                            className="h-7 text-xs"
                            step={0.5}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
          </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </DialogContent>
    </Dialog>
  )
}
