'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible'
import {
  Input
} from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield, ChevronDown, ChevronRight, Search, User, Globe, Filter, Clock
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'

interface AuditLog {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface AuditLogResponse {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  validate: 'bg-purple-100 text-purple-800',
  login: 'bg-cyan-100 text-cyan-800',
  logout: 'bg-gray-100 text-gray-800',
}

const actionLabels: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  validate: 'Validation',
  login: 'Connexion',
  logout: 'Déconnexion',
}

const entityLabels: Record<string, string> = {
  client: 'Client',
  product: 'Produit',
  quote: 'Devis',
  'sales-order': 'Commande',
  invoice: 'Facture',
  supplier: 'Fournisseur',
  'purchase-order': 'Commande fournisseur',
  reception: 'Réception',
  'cash-register': 'Caisse',
  'bank-account': 'Compte bancaire',
  payment: 'Paiement',
  'accounting-entry': 'Écriture comptable',
  setting: 'Paramètre',
  user: 'Utilisateur',
  stock: 'Stock',
  bom: 'Nomenclature',
  work_order: 'Ordre de travail',
}

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.get<AuditLogResponse>('/settings?view=audit_log')
      setLogs(data.logs || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement journal d\'audit')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Extract unique users for filter
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>()
    logs.forEach(log => {
      if (!map.has(log.userId)) {
        map.set(log.userId, { id: log.userId, name: log.user.name, email: log.user.email })
      }
    })
    return Array.from(map.values())
  }, [logs])

  // Extract unique entities for filter
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(log => set.add(log.entity))
    return Array.from(set)
  }, [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false
      if (entityFilter !== 'all' && log.entity !== entityFilter) return false
      if (userFilter !== 'all' && log.userId !== userFilter) return false
      if (dateFrom) {
        const logDate = format(new Date(log.createdAt), 'yyyy-MM-dd')
        if (logDate < dateFrom) return false
      }
      if (dateTo) {
        const logDate = format(new Date(log.createdAt), 'yyyy-MM-dd')
        if (logDate > dateTo) return false
      }
      if (search) {
        const s = search.toLowerCase()
        return (
          log.user.name.toLowerCase().includes(s) ||
          log.user.email.toLowerCase().includes(s) ||
          (entityLabels[log.entity] || log.entity).toLowerCase().includes(s) ||
          (actionLabels[log.action] || log.action).toLowerCase().includes(s) ||
          (log.entityId && log.entityId.toLowerCase().includes(s))
        )
      }
      return true
    })
  }, [logs, search, actionFilter, entityFilter, userFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayLogs = logs.filter(l => format(new Date(l.createdAt), 'yyyy-MM-dd') === today)
    return {
      total: logs.length,
      today: todayLogs.length,
      creates: logs.filter(l => l.action === 'create').length,
      updates: logs.filter(l => l.action === 'update').length,
      deletes: logs.filter(l => l.action === 'delete').length,
    }
  }, [logs])

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  const hasChanges = (log: AuditLog) => {
    return log.oldValues && Object.keys(log.oldValues).length > 0 ||
           log.newValues && Object.keys(log.newValues).length > 0
  }

  const getChangedFields = (log: AuditLog): string[] => {
    const oldKeys = log.oldValues ? Object.keys(log.oldValues) : []
    const newKeys = log.newValues ? Object.keys(log.newValues) : []
    return Array.from(new Set([...oldKeys, ...newKeys]))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Journal d&apos;audit</h2>
          <Badge variant="secondary">{filteredLogs.length}</Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Créations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.creates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Modifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.updates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Suppressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.deletes}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {Object.entries(actionLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Entité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les entités</SelectItem>
                {uniqueEntities.map(entity => (
                  <SelectItem key={entity} value={entity}>{entityLabels[entity] || entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Du</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Au</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {(search || actionFilter !== 'all' || entityFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo) && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setActionFilter('all')
                  setEntityFilter('all')
                  setUserFilter('all')
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] pl-4"></TableHead>
                  <TableHead className="w-[100px]">Date/Heure</TableHead>
                  <TableHead className="w-[110px]">Utilisateur</TableHead>
                  <TableHead className="w-[110px]">Action</TableHead>
                  <TableHead className="w-[130px]">Entité</TableHead>
                  <TableHead className="hidden md:table-cell">Résumé</TableHead>
                  <TableHead className="hidden lg:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search || actionFilter !== 'all' || entityFilter !== 'all' || userFilter !== 'all'
                        ? 'Aucune entrée trouvée.'
                        : 'Aucune entrée dans le journal d\'audit.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <Collapsible
                      key={log.id}
                      open={expandedId === log.id}
                      onOpenChange={() => toggleExpand(log.id)}
                    >
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(log.id)}>
                        <TableCell className="pl-4">
                          {expandedId === log.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(log.createdAt), 'dd/MM/yyyy', { locale: fr })}
                          <br />
                          {format(new Date(log.createdAt), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{log.user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}
                          >
                            {actionLabels[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{entityLabels[log.entity] || log.entity}</span>
                          {log.entityId && (
                            <span className="text-muted-foreground text-xs ml-1">#{log.entityId.substring(0, 8)}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[250px] truncate">
                          {hasChanges(log) ? (
                            <span>{getChangedFields(log).length} champ(s) modifié(s)</span>
                          ) : (
                            <span>{log.action === 'create' ? 'Nouvelle entrée' : log.action === 'delete' ? 'Entrée supprimée' : 'Action système'}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-xs font-mono">
                          {log.ipAddress || '—'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <CollapsibleContent>
                            <div className="px-8 py-4 bg-muted/30 border-b">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                    Informations
                                  </h4>
                                  <div className="space-y-1.5 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Utilisateur : </span>
                                      <span>{log.user.name}</span>
                                      <span className="text-muted-foreground"> ({log.user.email})</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Rôle : </span>
                                      <Badge variant="outline" className="text-xs">{log.user.role}</Badge>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Entité : </span>
                                      <span className="font-medium">{entityLabels[log.entity] || log.entity}</span>
                                      {log.entityId && <span className="font-mono text-muted-foreground"> ({log.entityId})</span>}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Adresse IP : </span>
                                      <span className="font-mono">{log.ipAddress || 'Non disponible'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Date complète : </span>
                                      <span>{format(new Date(log.createdAt), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}</span>
                                    </div>
                                  </div>
                                </div>
                                {(log.oldValues || log.newValues) && (
                                  <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                      Détails des modifications
                                    </h4>
                                    <div className="space-y-2">
                                      {getChangedFields(log).map((field) => {
                                        const oldVal = log.oldValues?.[field]
                                        const newVal = log.newValues?.[field]
                                        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
                                        return (
                                          <div
                                            key={field}
                                            className={`flex items-start gap-2 text-sm p-2 rounded border ${
                                              changed ? 'bg-amber-50 border-amber-200' : 'bg-white'
                                            }`}
                                          >
                                            <span className="font-mono text-xs font-medium text-muted-foreground min-w-[80px]">{field}</span>
                                            <div className="flex-1 flex flex-wrap gap-2">
                                              {oldVal !== undefined && (
                                                <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs line-through">
                                                  {renderValue(oldVal)}
                                                </span>
                                              )}
                                              {newVal !== undefined && (
                                                <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-xs">
                                                  {renderValue(newVal)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </TableCell>
                      </TableRow>
                    </Collapsible>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
