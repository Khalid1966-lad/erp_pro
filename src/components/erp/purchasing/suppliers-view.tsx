'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, Star, Phone, Mail, Building2, Eye, ArrowUpDown, AlertTriangle, RefreshCw } from 'lucide-react'
import SupplierDetailView from './supplier-detail-view'
import { toast } from 'sonner'
import { HelpButton } from '@/components/erp/shared/help-button'

// ── Types ──────────────────────────────────────────────
interface Supplier {
  id: string
  code: string
  name: string
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  deliveryDelay: number
  paymentTerms: string
  rating: number
  balance: number
  creditLimit: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface SupplierFormData {
  code: string
  name: string
  email: string
  phone: string
  siret: string
  address: string
  city: string
  postalCode: string
  country: string
  deliveryDelay: number
  paymentTerms: string
  rating: number
  creditLimit: number       // ADD
  notes: string
}

const emptyForm: SupplierFormData = {
  code: '', name: '', email: '', phone: '', siret: '', address: '', city: '',
  postalCode: '', country: 'Maroc', deliveryDelay: 7,
  paymentTerms: '30 jours', rating: 5, creditLimit: 0, notes: ''
}

// ── Helpers ────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n)

function Stars({ rating, onChange, size = 'sm' }: { rating: number; onChange?: (r: number) => void; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'} ${onChange ? 'cursor-pointer hover:text-yellow-400 transition-colors' : ''}`}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────
type SubView = 'list' | 'detail'

export default function SuppliersView() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debtor' | 'creditor' | 'creditLimit'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [subView, setSubView] = useState<SubView>('list')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const goBack = () => { setSubView('list'); setSelectedSupplier(null) }

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{suppliers: Supplier[]}>(`/suppliers?limit=500`)
      setSuppliers(res.suppliers || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des fournisseurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter((s) =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.siret?.includes(search) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  ).filter((s) => {
    if (balanceFilter === 'debtor') return s.balance > 0
    if (balanceFilter === 'creditor') return s.balance < 0
    if (balanceFilter === 'creditLimit') return s.creditLimit > 0 && s.balance >= s.creditLimit
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    // Fetch next auto-generated code
    api.get('/suppliers?nextCode=true').then((res: any) => {
      if (res.nextCode) {
        setForm(prev => ({ ...prev, code: res.nextCode }))
      }
    }).catch(() => {})
    setDialogOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setSelectedSupplier(s)
    setEditing(s)
    setForm({
      code: s.code, name: s.name, email: s.email || '', phone: s.phone || '', siret: s.siret || '',
      address: s.address || '', city: s.city || '', postalCode: s.postalCode || '',
      country: s.country || 'Maroc', deliveryDelay: s.deliveryDelay,
      paymentTerms: s.paymentTerms, rating: s.rating, creditLimit: s.creditLimit || 0, notes: s.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('La raison sociale est obligatoire')
      return
    }
    try {
      setSaving(true)
      if (editing) {
        await api.put('/suppliers', { id: editing.id, ...form })
        toast.success('Fournisseur mis à jour')
      } else {
        await api.post('/suppliers', form)
        toast.success('Fournisseur créé')
      }
      setDialogOpen(false)
      fetchSuppliers()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id)
      await api.delete(`/suppliers?id=${id}`)
      toast.success('Fournisseur supprimé')
      fetchSuppliers()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  const updateField = (field: keyof SupplierFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (subView === 'detail' && selectedSupplier) {
    return (
      <SupplierDetailView
        supplier={selectedSupplier}
        onBack={goBack}
        onEdit={() => { openEdit(selectedSupplier) }}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par code ou raison sociale..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="achats" sub="fournisseurs" />
          <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input value={form.code} onChange={(e) => updateField('code', e.target.value)} placeholder="Auto-généré" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Raison Sociale *</Label>
                  <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Raison sociale du fournisseur" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="email@fournisseur.com" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+212 X XX XX XX XX" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Adresse" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} placeholder="40000" />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="Marrakech" />
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Input value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="Maroc" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Délai de livraison (jours)</Label>
                  <Input type="number" min={0} value={form.deliveryDelay} onChange={(e) => updateField('deliveryDelay', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Délai de paiement</Label>
                  <Select value={form.paymentTerms} onValueChange={(v) => updateField('paymentTerms', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30 jours">30 jours</SelectItem>
                      <SelectItem value="60 jours">60 jours</SelectItem>
                      <SelectItem value="comptant">Comptant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plafond de crédit (MAD)</Label>
                  <Input type="number" min={0} step={0.01} value={form.creditLimit} onChange={(e) => updateField('creditLimit', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note (1-5)</Label>
                <Stars rating={form.rating} onChange={(r) => updateField('rating', r)} size="md" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder="Notes internes..." rows={3} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={balanceFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBalanceFilter('all')}
        >
          Tous
        </Button>
        <Button
          variant={balanceFilter === 'debtor' ? 'default' : 'outline'}
          size="sm"
          className={balanceFilter === 'debtor' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          onClick={() => setBalanceFilter(balanceFilter === 'debtor' ? 'all' : 'debtor')}
        >
          Débiteurs
        </Button>
        <Button
          variant={balanceFilter === 'creditor' ? 'default' : 'outline'}
          size="sm"
          className={balanceFilter === 'creditor' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          onClick={() => setBalanceFilter(balanceFilter === 'creditor' ? 'all' : 'creditor')}
        >
          Créditeurs
        </Button>
        <Button
          variant={balanceFilter === 'creditLimit' ? 'default' : 'outline'}
          size="sm"
          className={balanceFilter === 'creditLimit' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
          onClick={() => setBalanceFilter(balanceFilter === 'creditLimit' ? 'all' : 'creditLimit')}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Plafond atteint
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{search ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Raison Sociale</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Ville</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Délai</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Paiement</th>
                    <th className="text-left px-4 py-3 font-medium">Note</th>
                    <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                      <div className="flex items-center justify-end gap-1 cursor-pointer select-none" onClick={() => {}}>
                        Solde
                      </div>
                    </th>
                    <th className="text-right px-4 py-3 font-medium hidden xl:table-cell">Plafond</th>
                    <th className="text-right px-4 py-3 font-medium w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${s.creditLimit > 0 && s.balance >= s.creditLimit ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`} onClick={() => { setSelectedSupplier(s); setSubView('detail') }}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{s.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.name}</div>
                        {s.siret && <div className="text-xs text-muted-foreground font-mono">ICE: {s.siret}</div>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-1">
                          {s.email && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {s.email}
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {s.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm">
                        {s.city}{s.postalCode ? ` ${s.postalCode}` : ''}{s.country && s.country !== 'Maroc' ? `, ${s.country}` : ''}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm">{s.deliveryDelay}j</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant="outline">{s.paymentTerms}</Badge>
                      </td>
                      <td className="px-4 py-3"><Stars rating={s.rating} /></td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className={s.balance > 0 ? 'text-red-600 font-medium' : s.balance < 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {fmt(s.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">
                        {s.creditLimit > 0 ? (
                          <span className={s.balance >= s.creditLimit ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            {fmt(s.creditLimit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedSupplier(s); setSubView('detail') }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. Le fournisseur &quot;{s.name}&quot; sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(s.id)}
                                  disabled={deleting === s.id}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleting === s.id ? 'Suppression...' : 'Supprimer'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {!loading && filtered.length > 0 && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {filtered.length} fournisseur{filtered.length > 1 ? 's' : ''} {search ? '(filtré)' : 'au total'}
          </div>
        )}
      </Card>
    </div>
  )
}
