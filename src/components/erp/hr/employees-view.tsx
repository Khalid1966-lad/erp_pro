'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
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
  Users, Plus, Edit, Trash2, Search, RefreshCw, UserCog,
  Phone, Mail, Briefcase, CalendarDays, Building2, MapPin,
  FileText, CreditCard, Hash, Loader2, UserCheck, UserX, DollarSign, Camera
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
  employeeCount?: number
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  matricule: string | null
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  fonctionId: string | null
  fonctionName: string | null
  department: string | null
  dateEmbauche: string | null
  dateDepart: string | null
  salaryBase: number | null
  cinNumber: string | null
  cnssNumber: string | null
  notes: string | null
  photoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface FormState {
  firstName: string
  lastName: string
  matricule: string
  dateOfBirth: string
  gender: string
  phone: string
  email: string
  address: string
  city: string
  postalCode: string
  fonctionId: string
  department: string
  dateEmbauche: string
  dateDepart: string
  salaryBase: string
  cinNumber: string
  cnssNumber: string
  notes: string
  photoUrl: string
}

const defaultForm: FormState = {
  firstName: '',
  lastName: '',
  matricule: '',
  dateOfBirth: '',
  gender: 'M',
  phone: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  fonctionId: '',
  department: '',
  dateEmbauche: '',
  dateDepart: '',
  salaryBase: '',
  cinNumber: '',
  cnssNumber: '',
  notes: '',
  photoUrl: '',
}

// ───────────────────── Helpers ─────────────────────
function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return format(new Date(d), 'dd MMM yyyy', { locale: fr })
  } catch {
    return d
  }
}

// ───────────────────── Image Compression ─────────────────────
function compressImage(file: File, maxKb: number, initialQuality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDimension = 1024

        // Scale down if too large
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not available')); return }
        ctx.drawImage(img, 0, 0, width, height)

        let quality = initialQuality
        let dataUrl = canvas.toDataURL('image/jpeg', quality)

        // Iteratively reduce quality until under maxKb
        while (dataUrl.length > maxKb * 1024 * (4 / 3) && quality > 0.1) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        // If still too big, reduce dimensions
        if (dataUrl.length > maxKb * 1024 * (4 / 3)) {
          const scale = 0.75
          canvas.width = Math.round(width * scale)
          canvas.height = Math.round(height * scale)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          quality = initialQuality
          dataUrl = canvas.toDataURL('image/jpeg', quality)
          while (dataUrl.length > maxKb * 1024 * (4 / 3) && quality > 0.1) {
            quality -= 0.1
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
        }

        if (dataUrl.length > maxKb * 1024 * (4 / 3)) {
          reject(new Error(`Impossible de compresser l'image sous ${maxKb} Ko`))
        } else {
          resolve(dataUrl)
        }
      }
      img.onerror = () => reject(new Error('Impossible de lire l\'image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
    reader.readAsDataURL(file)
  })
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
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

// ───────────────────── Date Picker Field ─────────────────────
function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          max={new Date().toISOString().split('T')[0]}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEES VIEW
// ═══════════════════════════════════════════════════════════════
export default function EmployeesView() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [functions, setFunctions] = useState<EmployeeFunction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fonctionFilter, setFonctionFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'departed'>('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)

  // ─── Fetch employees ───
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: '1000' })
      if (searchRef.current) params.set('search', searchRef.current)
      const res = await api.get<{ employees: Array<Record<string, unknown>>; total: number }>(`/employees?${params}`)
      const mapped = (res.employees || []).map((e: Record<string, unknown>) => {
        const fonc = e.fonction as { id: string; name: string } | null
        return {
          ...e,
          fonctionId: fonc?.id || null,
          fonctionName: fonc?.name || null,
        } as unknown as Employee
      })
      setEmployees(mapped)
    } catch (err) {
      console.error('Erreur chargement salariés:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des salariés.' })
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Fetch functions (for dropdowns & filters) ───
  const fetchFunctions = useCallback(async () => {
    try {
      const res = await api.get<{ functions: EmployeeFunction[] }>('/employee-functions?dropdown=true')
      setFunctions(res.functions || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
    fetchFunctions()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchEmployees, fetchFunctions])

  // ─── Debounced search ───
  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    searchRef.current = value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchEmployees()
    }, 300)
  }, [fetchEmployees])

  // ─── Filtered employees ───
  const filteredEmployees = (() => {
    let result = [...employees]
    if (fonctionFilter) result = result.filter(e => e.fonctionId === fonctionFilter)
    if (statusFilter === 'active') result = result.filter(e => e.isActive)
    if (statusFilter === 'departed') result = result.filter(e => !e.isActive || e.dateDepart)
    return result
  })()

  // ─── Stats ───
  const totalEmployees = employees.length
  const activeEmployees = employees.filter(e => e.isActive).length
  const commercialCount = employees.filter(e => {
    const fn = functions.find(f => f.id === e.fonctionId)
    return fn?.name?.toLowerCase().includes('commercial')
  }).length
  const departedEmployees = employees.filter(e => !e.isActive || e.dateDepart).length

  // ─── Open create dialog ───
  const openCreate = () => {
    setForm(defaultForm)
    setSelectedEmployee(null)
    setDialogMode('create')
    setDialogOpen(true)
  }

  // ─── Open edit dialog ───
  const openEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setForm({
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      matricule: employee.matricule || '',
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
      gender: employee.gender || 'M',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      city: employee.city || '',
      postalCode: employee.postalCode || '',
      fonctionId: employee.fonctionId || '',
      department: employee.department || '',
      dateEmbauche: employee.dateEmbauche ? employee.dateEmbauche.split('T')[0] : '',
      dateDepart: employee.dateDepart ? employee.dateDepart.split('T')[0] : '',
      salaryBase: employee.salaryBase != null ? String(employee.salaryBase) : '',
      cinNumber: employee.cinNumber || '',
      cnssNumber: employee.cnssNumber || '',
      notes: employee.notes || '',
      photoUrl: employee.photoUrl || '',
    })
    setDialogMode('edit')
    setDialogOpen(true)
  }

  // ─── Save (create or edit) ───
  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Champs manquants', { description: 'Le nom et le prénom sont requis.' })
      return
    }
    try {
      setSaving(true)
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        matricule: form.matricule.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        fonctionId: form.fonctionId || null,
        department: form.department.trim() || null,
        dateEmbauche: form.dateEmbauche || null,
        dateDepart: form.dateDepart || null,
        salaryBase: form.salaryBase ? parseFloat(form.salaryBase) : null,
        cinNumber: form.cinNumber.trim() || null,
        cnssNumber: form.cnssNumber.trim() || null,
        notes: form.notes.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
      }

      if (dialogMode === 'edit' && selectedEmployee) {
        body.id = selectedEmployee.id
        await api.put('/employees', body)
        toast.success('Salarié modifié', {
          description: `${form.firstName} ${form.lastName} a été mis à jour.`,
        })
      } else {
        await api.post('/employees', body)
        toast.success('Salarié créé', {
          description: `${form.firstName} ${form.lastName} a été ajouté avec succès.`,
        })
      }
      setDialogOpen(false)
      fetchEmployees()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde'
      toast.error('Erreur de sauvegarde', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───
  const handleDelete = async (employee: Employee) => {
    try {
      await api.delete(`/employees?id=${employee.id}`)
      toast.success('Salarié supprimé', {
        description: `${employee.firstName} ${employee.lastName} a été supprimé.`,
      })
      fetchEmployees()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression'
      toast.error('Erreur de suppression', { description: msg })
    }
  }

  // ─── Photo upload with compression ───
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const dataUrl = await compressImage(file, 500, 0.8)
      updateForm('photoUrl', dataUrl)
      toast.success('Photo ajoutée', { description: `${(dataUrl.length * 3 / 4 / 1024).toFixed(0)} Ko` })
    } catch (err) {
      toast.error('Erreur', { description: 'Impossible de traiter cette image.' })
    } finally {
      setUploadingPhoto(false)
      // Reset file input so same file can be re-selected
      e.target.value = ''
    }
  }, [])

  // ─── Form update helper ───
  const updateForm = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ─── Render ───
  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Salariés</h2>
          <Badge variant="secondary">
            {filteredEmployees.length}
            {filteredEmployees.length !== totalEmployees && `/${totalEmployees}`}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <HelpButton section="rh" sub="salaries" />
          <Button variant="outline" size="sm" onClick={fetchEmployees}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau salarié
          </Button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalEmployees}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeEmployees}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{commercialCount}</p>
              <p className="text-xs text-muted-foreground">Commerciaux</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <UserX className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{departedEmployees}</p>
              <p className="text-xs text-muted-foreground">Départis</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Search ─── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, matricule, email ou téléphone..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          autoComplete="off"
          data-form-type="other"
        />
      </div>

      {/* ─── Filter Buttons ─── */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'all' && !fonctionFilter ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setStatusFilter('all'); setFonctionFilter(null) }}
        >
          Tous
        </Button>
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          className={statusFilter === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        >
          <UserCheck className="h-3.5 w-3.5 mr-1" />
          Actifs
        </Button>
        <Button
          variant={statusFilter === 'departed' ? 'default' : 'outline'}
          size="sm"
          className={statusFilter === 'departed' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          onClick={() => setStatusFilter(statusFilter === 'departed' ? 'all' : 'departed')}
        >
          <UserX className="h-3.5 w-3.5 mr-1" />
          Départis
        </Button>
        <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
        <Select value={fonctionFilter ?? '__all__'} onValueChange={(v) => setFonctionFilter(v === '__all__' ? null : v)}>
          <SelectTrigger className="w-auto h-8 text-sm">
            <SelectValue placeholder="Fonction..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes fonctions</SelectItem>
            {functions.filter(f => f.isActive).map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ─── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)', minHeight: '300px' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Photo</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule</TableHead>
                  <TableHead className="hidden lg:table-cell">Fonction</TableHead>
                  <TableHead className="hidden xl:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden xl:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {search || fonctionFilter || statusFilter !== 'all'
                        ? 'Aucun salarié trouvé.'
                        : 'Aucun salarié enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow
                      key={emp.id}
                      className={cn(!emp.isActive && 'opacity-60 bg-muted/30')}
                    >
                      {/* Photo */}
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          {emp.photoUrl ? (
                            <AvatarImage src={emp.photoUrl} alt={`${emp.firstName} ${emp.lastName}`} />
                          ) : null}
                          <AvatarFallback className="text-xs font-medium">
                            {`${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      {/* Nom complet */}
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{`${emp.firstName} ${emp.lastName}`}</p>
                          {emp.department && (
                            <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                          )}
                        </div>
                      </TableCell>
                      {/* Matricule */}
                      <TableCell className="hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground font-mono">
                          <Hash className="h-3 w-3" />
                          {emp.matricule || '—'}
                        </span>
                      </TableCell>
                      {/* Fonction */}
                      <TableCell className="hidden lg:table-cell">
                        {emp.fonctionName ? (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {emp.fonctionName}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      {/* Téléphone */}
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                        {emp.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {emp.phone}
                          </span>
                        ) : '—'}
                      </TableCell>
                      {/* Email */}
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                        {emp.email ? (
                          <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <Mail className="h-3 w-3 shrink-0" />
                            {emp.email}
                          </span>
                        ) : '—'}
                      </TableCell>
                      {/* Statut */}
                      <TableCell className="hidden sm:table-cell">
                        {!emp.isActive || emp.dateDepart ? (
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                            <UserX className="h-3 w-3 mr-1" />
                            Parti
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Actif
                          </Badge>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)} title="Modifier">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce salarié ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer <strong>{emp.firstName} {emp.lastName}</strong> ?
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(emp)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* ═══ Create / Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedEmployee(null); setForm(defaultForm) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogMode === 'create' ? (
                <><Plus className="h-5 w-5" /> Nouveau salarié</>
              ) : (
                <><Edit className="h-5 w-5" /> Modifier le salarié</>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Remplissez les informations pour ajouter un nouveau salarié.'
                : `Modification de ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto flex-1 pr-1">
            {/* ─── Section: Identité ─── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Identité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-firstName">Prénom <span className="text-red-500">*</span></Label>
                  <Input
                    id="emp-firstName"
                    placeholder="Prénom"
                    value={form.firstName}
                    onChange={(e) => updateForm('firstName', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-lastName">Nom <span className="text-red-500">*</span></Label>
                  <Input
                    id="emp-lastName"
                    placeholder="Nom"
                    value={form.lastName}
                    onChange={(e) => updateForm('lastName', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-matricule" className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Matricule
                  </Label>
                  <Input
                    id="emp-matricule"
                    placeholder="Ex: EMP-001"
                    value={form.matricule}
                    onChange={(e) => updateForm('matricule', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={form.gender} onValueChange={(v) => updateForm('gender', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DatePickerField
                label="Date de naissance"
                value={form.dateOfBirth}
                onChange={(v) => updateForm('dateOfBirth', v)}
                placeholder="Sélectionner la date de naissance"
                id="emp-dateOfBirth"
              />
            </div>

            <Separator />

            {/* ─── Section: Coordonnées ─── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Coordonnées
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-phone" className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Téléphone
                  </Label>
                  <Input
                    id="emp-phone"
                    placeholder="+212 6XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-email" className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="email@exemple.com"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="emp-address">Adresse</Label>
                  <Input
                    id="emp-address"
                    placeholder="Adresse complète"
                    value={form.address}
                    onChange={(e) => updateForm('address', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-city">Ville</Label>
                  <Input
                    id="emp-city"
                    placeholder="Ville"
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-postalCode">Code postal</Label>
                  <Input
                    id="emp-postalCode"
                    placeholder="Code postal"
                    value={form.postalCode}
                    onChange={(e) => updateForm('postalCode', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Section: Professionnel ─── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Professionnel
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fonction</Label>
                  <Select value={form.fonctionId || '__none__'} onValueChange={(v) => updateForm('fonctionId', v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une fonction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune fonction</SelectItem>
                      {functions.filter(f => f.isActive).map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-department" className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Département
                  </Label>
                  <Input
                    id="emp-department"
                    placeholder="Ex: Direction, Comptabilité..."
                    value={form.department}
                    onChange={(e) => updateForm('department', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DatePickerField
                  label="Date d'embauche"
                  value={form.dateEmbauche}
                  onChange={(v) => updateForm('dateEmbauche', v)}
                  placeholder="Sélectionner la date d'embauche"
                  id="emp-dateEmbauche"
                />
                <DatePickerField
                  label="Date de départ"
                  value={form.dateDepart}
                  onChange={(v) => updateForm('dateDepart', v)}
                  placeholder="Sélectionner la date de départ"
                  id="emp-dateDepart"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-salaryBase" className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Salaire de base (MAD)
                </Label>
                <Input
                  id="emp-salaryBase"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.salaryBase}
                  onChange={(e) => updateForm('salaryBase', e.target.value)}
                  autoComplete="off"
                  data-form-type="other"
                />
              </div>
            </div>

            <Separator />

            {/* ─── Section: Documents ─── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                Documents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-cinNumber" className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    N° CIN
                  </Label>
                  <Input
                    id="emp-cinNumber"
                    placeholder="Numéro de la carte d'identité"
                    value={form.cinNumber}
                    onChange={(e) => updateForm('cinNumber', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-cnssNumber" className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    N° CNSS
                  </Label>
                  <Input
                    id="emp-cnssNumber"
                    placeholder="Numéro CNSS"
                    value={form.cnssNumber}
                    onChange={(e) => updateForm('cnssNumber', e.target.value)}
                    autoComplete="off"
                    data-form-type="other"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Section: Photo ─── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Camera className="h-4 w-4" />
                Photo
              </h3>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {form.photoUrl ? (
                    <AvatarImage src={form.photoUrl} alt="Photo" />
                  ) : null}
                  <AvatarFallback className="text-lg font-semibold">
                    {`${form.firstName?.[0] || ''}${form.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="emp-photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('emp-photo-upload')?.click()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                    {form.photoUrl ? 'Changer la photo' : 'Télécharger une photo'}
                  </Button>
                  {form.photoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateForm('photoUrl', '')}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP ou GIF — Max 500 Ko. L&apos;image est compressée automatiquement.
              </p>
            </div>

            <Separator />

            {/* ─── Section: Notes ─── */}
            <div className="space-y-2">
              <Label htmlFor="emp-notes">Notes</Label>
              <Textarea
                id="emp-notes"
                placeholder="Notes ou observations supplémentaires..."
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={3}
                autoComplete="off"
                data-form-type="other"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {dialogMode === 'create' ? 'Créer le salarié' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
