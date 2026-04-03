'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Search, Edit, Trash2, Star, Phone, Mail, Building2 } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────
interface Supplier {
  id: string
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
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface SupplierFormData {
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
  notes: string
}

const emptyForm: SupplierFormData = {
  name: '', email: '', phone: '', siret: '', address: '', city: '',
  postalCode: '', country: 'France', deliveryDelay: 7,
  paymentTerms: '30 jours', rating: 3, notes: ''
}

// ── Helpers ────────────────────────────────────────────
function formatCurrency(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

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
export default function SuppliersView() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<{suppliers: Supplier[]}>(`/suppliers`)
      setSuppliers(res.suppliers || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des fournisseurs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.siret?.includes(search) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name, email: s.email || '', phone: s.phone || '', siret: s.siret || '',
      address: s.address || '', city: s.city || '', postalCode: s.postalCode || '',
      country: s.country || 'France', deliveryDelay: s.deliveryDelay,
      paymentTerms: s.paymentTerms, rating: s.rating, notes: s.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom du fournisseur est obligatoire')
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Nom du fournisseur" />
                </div>
                <div className="space-y-2">
                  <Label>SIRET</Label>
                  <Input value={form.siret} onChange={(e) => updateField('siret', e.target.value)} placeholder="XXX XXX XXX XXXXX" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="email@fournisseur.fr" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+33 X XX XX XX XX" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Adresse" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} placeholder="75001" />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="Paris" />
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Input value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="France" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Délai de livraison (jours)</Label>
                  <Input type="number" min={0} value={form.deliveryDelay} onChange={(e) => updateField('deliveryDelay', parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Conditions de paiement</Label>
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
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Ville</TableHead>
                    <TableHead className="hidden lg:table-cell">Délai</TableHead>
                    <TableHead className="hidden sm:table-cell">Paiement</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{s.name}</p>
                            {s.siret && <p className="text-xs text-muted-foreground">{s.siret}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
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
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {s.city}{s.postalCode ? ` ${s.postalCode}` : ''}{s.country && s.country !== 'France' ? `, ${s.country}` : ''}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{s.deliveryDelay}j</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{s.paymentTerms}</Badge>
                      </TableCell>
                      <TableCell><Stars rating={s.rating} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
