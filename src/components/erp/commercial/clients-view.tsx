'use client'

import { useState, useEffect, useMemo } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Plus, Edit, Trash2, Search, Users, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  creditLimit: number | null
  paymentTerms: string | null
  notes: string | null
  balance: number
  createdAt: string
}

const emptyClient = {
  name: '',
  email: '',
  phone: '',
  siret: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'France',
  creditLimit: '',
  paymentTerms: '30',
  notes: ''
}

const paymentTermsOptions = [
  { value: '0', label: 'À réception' },
  { value: '15', label: '15 jours' },
  { value: '30', label: '30 jours' },
  { value: '45', label: '45 jours' },
  { value: '60', label: '60 jours' },
  { value: '90', label: '90 jours' },
  { value: 'end_of_month', label: 'Fin de mois' },
  { value: 'end_of_month_30', label: 'Fin de mois + 30 jours' }
]

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'name' | 'email'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyClient)
  const [saving, setSaving] = useState(false)

  const fetchClients = async () => {
    try {
      setLoading(true)
      const res = await api.get<{clients: Client[]}>(`/clients`)
      setClients(res.clients || [])
    } catch (err) {
      console.error('Erreur chargement clients:', err)
      toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des clients.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const filteredClients = useMemo(() => {
    let result = clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.city && c.city.toLowerCase().includes(search.toLowerCase()))
    )
    result.sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase()
      const valB = (b[sortField] || '').toLowerCase()
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    })
    return result
  }, [clients, search, sortField, sortDir])

  const toggleSort = (field: 'name' | 'email') => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const openCreate = () => {
    setEditingClient(null)
    setForm(emptyClient)
    setDialogOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      siret: client.siret || '',
      address: client.address || '',
      city: client.city || '',
      postalCode: client.postalCode || '',
      country: client.country || 'France',
      creditLimit: client.creditLimit?.toString() || '',
      paymentTerms: client.paymentTerms || '30',
      notes: client.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      setSaving(true)
      const body = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        siret: form.siret || null,
        address: form.address || null,
        city: form.city || null,
        postalCode: form.postalCode || null,
        country: form.country || null,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
        paymentTerms: form.paymentTerms || null,
        notes: form.notes || null
      }
      if (editingClient) {
        await api.put('/clients', { id: editingClient.id, ...body })
        toast.success('Client modifié', { description: `${body.name} a été mis à jour.` })
      } else {
        await api.post('/clients', body)
        toast.success('Client créé', { description: `${body.name} a été ajouté.` })
      }
      setDialogOpen(false)
      fetchClients()
    } catch (err) {
      console.error('Erreur sauvegarde client:', err)
      toast.error('Erreur de sauvegarde', { description: 'Impossible de sauvegarder le client.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clients?id=${id}`)
      toast.success('Client supprimé', { description: 'Le client a été supprimé avec succès.' })
      fetchClients()
    } catch (err) {
      console.error('Erreur suppression client:', err)
      toast.error('Erreur de suppression', { description: 'Impossible de supprimer le client.' })
    }
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Clients</h2>
          <Badge variant="secondary">{filteredClients.length}</Badge>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nouveau client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, email ou ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1">
                      Nom
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => toggleSort('email')}>
                    <div className="flex items-center gap-1">
                      Email
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell">Ville</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="hidden sm:table-cell">Conditions</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search ? 'Aucun client trouvé.' : 'Aucun client enregistré.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{client.email || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{client.phone || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{client.city || '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={client.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                          {fmt(client.balance)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {paymentTermsOptions.find(t => t.value === client.paymentTerms)?.label || client.paymentTerms || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
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
                                <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer le client <strong>{client.name}</strong> ?
                                  Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du client" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input id="siret" value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="XXX XXX XXX XXXXX" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ville" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Code postal</Label>
              <Input id="postalCode" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="75000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Pays</Label>
              <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="France" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Limite de crédit (€)</Label>
              <Input id="creditLimit" type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Conditions de paiement</Label>
              <Select value={form.paymentTerms} onValueChange={(v) => setForm({ ...form, paymentTerms: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentTermsOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes internes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? 'Enregistrement...' : editingClient ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
