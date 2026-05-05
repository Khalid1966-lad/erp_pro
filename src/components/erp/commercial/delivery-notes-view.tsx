'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Truck, MoreVertical, CheckCircle, XCircle, Eye, Trash2, Package, FileText, Plus, Pencil, Link2, Unlink, ShoppingCart, CalendarClock, Loader2, Search, RefreshCw, Printer, HardHat, MapPinned
} from 'lucide-react'
import { toast } from 'sonner'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { EntityCombobox } from '@/components/erp/shared/entity-combobox'
import { printDocument, fmtMoney, fmtDate } from '@/lib/print-utils'
import { PrintHeader } from '@/components/erp/shared/print-header'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ProductCombobox, ProductOption, useProductSearch } from '@/components/erp/shared/product-combobox'
import { HelpButton } from '@/components/erp/shared/help-button'
import { useNavStore } from '@/lib/stores'

// ─── Helpers ───

const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })

/** Parse a French-formatted number input (accepts both comma and dot as decimal separator) */
const parseNum = (val: string) => parseFloat(val.replace(',', '.')) || 0

/** HTML pour encadrés Notes + Visa Client / Visa Administration dans les impressions */
function buildVisaHtml(notes?: string | null): string {
  const notesHtml = notes
    ? `<div style="border:1px solid #999; border-radius:4px; padding:8px; margin-bottom:16px;">
         <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:4px;">Notes</div>
         <div style="font-size:11px; min-height:40px;">${notes.replace(/\n/g, '<br/>')}</div>
       </div>`
    : ''

  const visaHtml = `
    <div style="display:flex; gap:24px; margin-top:24px;">
      <div style="flex:1; border:1px solid #999; border-radius:4px; padding:8px; text-align:center;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:60px;">Visa Client</div>
        <div style="font-size:10px; color:#999; border-top:1px dashed #ccc; padding-top:4px;">Nom, Prénom & Cachet</div>
      </div>
      <div style="flex:1; border:1px solid #999; border-radius:4px; padding:8px; text-align:center;">
        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:60px;">Visa Administration</div>
        <div style="font-size:10px; color:#999; border-top:1px dashed #ccc; padding-top:4px;">Nom, Prénom & Cachet</div>
      </div>
    </div>`

  return notesHtml + visaHtml
}

// ─── Interfaces ───

interface ClientOption {
  id: string
  name: string
  raisonSociale: string | null
  ville: string | null
}

// ProductOption imported from @/components/erp/shared/product-combobox

interface SalesOrderOption {
  id: string
  clientOrderNumber: string
  status: string
  client: { id: string; name: string }
  totalHT: number
  totalTTC: number
}
import { useIsSuperAdmin } from '@/hooks/use-super-admin'

/** Sales order line as returned from the API with delivery tracking */
interface SalesOrderLineInfo {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  quantityPrepared: number
  quantityDelivered: number
  product?: { id: string; reference: string; designation: string }
}

interface DeliveryNoteLineItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  salesOrderLineId?: string
  product?: { id: string; reference: string; designation: string }
  salesOrderLine?: {
    id: string
    quantity: number
    quantityDelivered: number
    quantityPrepared: number
    unitPrice: number
    tvaRate: number
  } | null
  previouslyDelivered?: number
  remainingAfterDelivery?: number | null
}

interface DeliveryNote {
  id: string
  number: string
  status: string
  date: string
  plannedDate: string | null
  deliveryDate: string | null
  transporteur: string | null
  vehiclePlate: string | null
  notes: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  salesOrderId: string | null
  salesOrder: {
    id: string
    clientOrderNumber: string
    lines: SalesOrderLineInfo[]
  } | null
  client: { id: string; name: string; address?: string | null; city?: string | null }
  lines: DeliveryNoteLineItem[]
  chantier?: ChantierOption | null
  deliveryAddress?: string | null
  dueDate: string | null
  driverName: string | null
  transportType: string | null
  createdByName: string | null
}

interface EditableLine {
  tempId: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
}

/** Line for edit dialog — may have an id (existing) or not (new) */
interface EditLine {
  tempId: string
  id?: string              // existing DeliveryNoteLine id
  salesOrderLineId?: string // linked SO line
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  product?: { id: string; reference: string; designation: string }
}

// ─── Order line for partial delivery ───

interface OrderLineWithDelivery {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  tvaRate: number
  quantityDelivered: number
  quantityPrepared: number
  remaining: number
  deliveryPercentage: number
  product?: { id: string; reference: string; designation: string }
}

interface ChantierOption {
  id: string
  nomProjet: string
  adresse: string
  ville: string
  codePostal: string | null
  provincePrefecture: string | null
  responsableNom: string
  responsableFonction: string | null
  telephone: string | null
  gsm: string | null
}

// ─── Status Config ───

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmé',
  delivered: 'Livré',
  cancelled: 'Annulé'
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
}

// ─── Helpers ───

/** Compute overall delivery percentage for a delivery note linked to a sales order */
function getOrderDeliveryPercentage(note: DeliveryNote): number | null {
  if (!note.salesOrderId || !note.salesOrder?.lines || note.salesOrder.lines.length === 0) return null
  let totalQty = 0
  let totalDelivered = 0
  for (const line of note.salesOrder.lines) {
    totalQty += line.quantity
    totalDelivered += line.quantityDelivered || 0
  }
  if (totalQty === 0) return 0
  return Math.round((totalDelivered / totalQty) * 100)
}

function DeliveryBadge({ percentage }: { percentage: number }) {
  if (percentage >= 100) {
    return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">100%</Badge>
  }
  if (percentage > 0) {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">{percentage}%</Badge>
  }
  return <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">0%</Badge>
}

function DeliveryProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={percentage} className="h-2 w-20" />
      <span className={`text-xs font-medium ${percentage >= 100 ? 'text-green-600' : percentage > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {percentage}%
      </span>
    </div>
  )
}

function getStatusIcon(status: string) {
  const config: Record<string, { icon: React.ReactNode; color: string }> = {
    draft: { icon: <FileText className="h-4 w-4" />, color: 'text-yellow-500' },
    confirmed: { icon: <Truck className="h-4 w-4" />, color: 'text-blue-500' },
    delivered: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-500' },
    cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
  }
  const c = config[status]
  if (!c) return null
  return <span className={c.color}>{c.icon}</span>
}

function IconLegend({ items }: { items: Array<{ icon: React.ReactNode; label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={item.color}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

const deliveryNoteLegendItems = [
  { icon: <FileText className="h-3.5 w-3.5" />, label: 'Brouillon', color: 'text-yellow-500' },
  { icon: <Truck className="h-3.5 w-3.5" />, label: 'Confirmé', color: 'text-blue-500' },
  { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Livré', color: 'text-green-500' },
  { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Annulé', color: 'text-red-500' },
]

// ─── Main Component ───

export default function DeliveryNotesView() {
  const isSuperAdmin = useIsSuperAdmin()
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterClientOrderNumber, setFilterClientOrderNumber] = useState('')

  const navigationParams = useNavStore((s) => s.navigationParams)

  // Apply navigation params from dashboard
  useEffect(() => {
    if (navigationParams?.status === 'pending') {
      // Pending delivery notes are draft or confirmed (not delivered/cancelled)
      setStatusFilter('draft')
      useNavStore.setState({ navigationParams: null })
    }
  }, [navigationParams])

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Selected
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Create form - mode: 'order' | 'standalone'
  const [createMode, setCreateMode] = useState<'order' | 'standalone'>('order')
  const [availableOrders, setAvailableOrders] = useState<SalesOrderOption[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [availableClients, setAvailableClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([])
  const [editableLines, setEditableLines] = useState<EditableLine[]>([])
  const [createTransporteur, setCreateTransporteur] = useState('')
  const [createVehiclePlate, setCreateVehiclePlate] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [createPlannedDate, setCreatePlannedDate] = useState('')
  const [createDriverName, setCreateDriverName] = useState('')
  const [createTransportType, setCreateTransportType] = useState<string>('rendu')
  const [createDueDate, setCreateDueDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Order lines for partial delivery
  const [orderLinesForDelivery, setOrderLinesForDelivery] = useState<OrderLineWithDelivery[]>([])
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({})
  const [includedLines, setIncludedLines] = useState<Record<string, boolean>>({})
  const [loadingOrderLines, setLoadingOrderLines] = useState(false)

  // Edit form
  const [editTransporteur, setEditTransporteur] = useState('')
  const [editVehiclePlate, setEditVehiclePlate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPlannedDate, setEditPlannedDate] = useState('')
  const [editDriverName, setEditDriverName] = useState('')
  const [editTransportType, setEditTransportType] = useState<string>('rendu')
  const [editDueDate, setEditDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  // Edit form - delivery address
  const [editDeliveryType, setEditDeliveryType] = useState<string>('none')
  const [editChantierId, setEditChantierId] = useState<string>('')
  const [editChantierOptions, setEditChantierOptions] = useState<ChantierOption[]>([])
  const [editManualDeliveryAddress, setEditManualDeliveryAddress] = useState('')

  // Edit form - lines
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [editProducts, setEditProducts] = useState<ProductOption[]>([])

  // Chantier filters
  const [clientFilter, setClientFilter] = useState<string>('')
  const [chantierFilter, setChantierFilter] = useState<string>('')
  const [clientOptionsForFilter, setClientOptionsForFilter] = useState<ClientOption[]>([])
  const [chantierOptionsForFilter, setChantierOptionsForFilter] = useState<ChantierOption[]>([])

  // Chantier for create dialog
  const [selectedChantierId, setSelectedChantierId] = useState<string>('')
  const [chantierOptions, setChantierOptions] = useState<ChantierOption[]>([])
  const [createDeliveryType, setCreateDeliveryType] = useState<string>('principal')
  const [manualDeliveryAddress, setManualDeliveryAddress] = useState('')

  // Derived: effective client ID for create dialog chantier fetching
  const effectiveCreateClientId = useMemo(() => {
    if (createMode === 'order' && selectedOrderId) {
      const order = availableOrders.find(o => o.id === selectedOrderId)
      return order?.client.id || ''
    }
    return selectedClientId
  }, [createMode, selectedOrderId, selectedClientId, availableOrders])

  // ─── Fetch ───

  const fetchDeliveryNotes = useCallback(async () => {
    try {
      setLoading(true)
      setExpandedNoteId(null)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '100')
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      if (clientFilter) params.set('clientId', clientFilter)
      if (chantierFilter) params.set('chantierId', chantierFilter)
      if (filterClientOrderNumber) params.set('clientOrderNumber', filterClientOrderNumber)
      const data = await api.get<{ deliveryNotes: DeliveryNote[]; total: number }>(`/delivery-notes?${params.toString()}`)
      setDeliveryNotes(data.deliveryNotes)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement bons de livraison')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, clientFilter, chantierFilter, filterClientOrderNumber])

  useEffect(() => {
    fetchDeliveryNotes()
    setExpandedNoteId(null)
  }, [fetchDeliveryNotes])

  // ─── Fetch filter dropdowns ───

  useEffect(() => {
    api.get<{ clients: ClientOption[] }>('/clients?dropdown=true')
      .then(data => setClientOptionsForFilter(data.clients || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (clientFilter) {
      api.get<{ chantiers: ChantierOption[] }>(`/clients/${clientFilter}/chantiers`)
        .then(data => setChantierOptionsForFilter(data.chantiers || []))
        .catch(() => setChantierOptionsForFilter([]))
      setChantierFilter('')
    } else {
      setChantierOptionsForFilter([])
      setChantierFilter('')
    }
  }, [clientFilter])

  // ─── Fetch chantiers for create dialog ───

  useEffect(() => {
    if (effectiveCreateClientId) {
      api.get<{ chantiers: ChantierOption[] }>(`/clients/${effectiveCreateClientId}/chantiers`)
        .then(data => setChantierOptions(data.chantiers || []))
        .catch(() => setChantierOptions([]))
      setSelectedChantierId('')
      setCreateDeliveryType('principal')
      setManualDeliveryAddress('')
    } else {
      setChantierOptions([])
      setSelectedChantierId('')
      setCreateDeliveryType('principal')
      setManualDeliveryAddress('')
    }
  }, [effectiveCreateClientId])

  // ─── Create BL ───

  const openCreateDialog = async () => {
    setCreateOpen(true)
    setCreateMode('order')
    setSelectedOrderId('')
    setSelectedClientId('')
    setSelectedChantierId('')
    setChantierOptions([])
    setCreateDeliveryType('principal')
    setManualDeliveryAddress('')
    setEditableLines([])
    setOrderLinesForDelivery([])
    setDeliveryQuantities({})
    setIncludedLines({})
    setCreateTransporteur('')
    setCreateVehiclePlate('')
    setCreateNotes('')
    setCreatePlannedDate('')
    setCreateDriverName('')
    setCreateTransportType('rendu')
    setCreateDueDate('')
    resetLineSearches()

    // Fetch available data in parallel
    setLoadingOrders(true)
    setLoadingClients(true)
    setLoadingProducts(true)

    try {
      const [prepData, partData, clientsData, productsData] = await Promise.all([
        api.get<{ orders: any[] }>('/sales-orders?status=prepared&limit=100'),
        api.get<{ orders: any[] }>('/sales-orders?status=partially_delivered&limit=100'),
        api.get<{ clients: ClientOption[] }>('/clients?dropdown=true'),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      const allOrders = [...(prepData.orders || []), ...(partData.orders || [])]
      setAvailableOrders(allOrders)
      setAvailableClients(clientsData.clients || [])
      setAvailableProducts(productsData.products || [])
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement des données')
    } finally {
      setLoadingOrders(false)
      setLoadingClients(false)
      setLoadingProducts(false)
    }
  }

  const { lineSearches, setLineSearches, getFilteredProducts, resetLineSearches } = useProductSearch(availableProducts)

  // ─── Fetch order lines for partial delivery ───

  const fetchOrderLinesForDelivery = async (orderId: string) => {
    setLoadingOrderLines(true)
    setOrderLinesForDelivery([])
    setDeliveryQuantities({})
    setIncludedLines({})
    try {
      // Fetch the sales order with its lines directly using the id filter
      const data = await api.get<{ orders: any[] }>(`/sales-orders?id=${orderId}&limit=1`)
      const order = data.orders?.[0]
      if (!order || !order.lines) {
        toast.error('Impossible de charger les lignes de la commande')
        setLoadingOrderLines(false)
        return
      }

      const lines: OrderLineWithDelivery[] = order.lines
        .map((line: any) => {
          const remaining = Math.max(0, line.quantity - (line.quantityDelivered || 0))
          const pct = line.quantity > 0 ? Math.round(((line.quantityDelivered || 0) / line.quantity) * 100) : 0
          return {
            id: line.id,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            tvaRate: line.tvaRate,
            quantityDelivered: line.quantityDelivered || 0,
            quantityPrepared: line.quantityPrepared || 0,
            remaining,
            deliveryPercentage: pct,
            product: line.product,
          }
        })
        .filter((l: OrderLineWithDelivery) => l.remaining > 0)

      setOrderLinesForDelivery(lines)

      // Default: all lines included with qty = remaining
      const qtyMap: Record<string, number> = {}
      const incMap: Record<string, boolean> = {}
      lines.forEach((l: OrderLineWithDelivery) => {
        qtyMap[l.id] = l.remaining
        incMap[l.id] = true
      })
      setDeliveryQuantities(qtyMap)
      setIncludedLines(incMap)
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement lignes')
    } finally {
      setLoadingOrderLines(false)
    }
  }

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId)
    if (orderId) {
      fetchOrderLinesForDelivery(orderId)
    } else {
      setOrderLinesForDelivery([])
      setDeliveryQuantities({})
      setIncludedLines({})
    }
  }

  // ─── Delivery quantities & inclusion management ───

  const updateDeliveryQuantity = (lineId: string, value: number) => {
    setDeliveryQuantities((prev) => ({ ...prev, [lineId]: value }))
  }

  const toggleLineIncluded = (lineId: string, checked: boolean) => {
    setIncludedLines((prev) => ({ ...prev, [lineId]: checked }))
    // If unchecking, zero out the quantity
    if (!checked) {
      setDeliveryQuantities((prev) => ({ ...prev, [lineId]: 0 }))
    } else {
      // Re-checking: restore to remaining
      const line = orderLinesForDelivery.find((l) => l.id === lineId)
      if (line) {
        setDeliveryQuantities((prev) => ({ ...prev, [lineId]: line.remaining }))
      }
    }
  }

  const getSelectedLineCount = () => {
    return orderLinesForDelivery.filter((l) => includedLines[l.id] && (deliveryQuantities[l.id] || 0) > 0).length
  }

  const getOrderDeliveryTotals = () => {
    let totalHT = 0
    let totalTVA = 0
    orderLinesForDelivery.forEach((line) => {
      if (!includedLines[line.id]) return
      const qty = deliveryQuantities[line.id] || 0
      if (qty > 0) {
        const ht = qty * line.unitPrice
        totalHT += ht
        totalTVA += ht * (line.tvaRate / 100)
      }
    })
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }

  const hasAnyQuantity = () => {
    return orderLinesForDelivery.some((l) => includedLines[l.id] && (deliveryQuantities[l.id] || 0) > 0)
  }

  const handleCreate = async () => {
    try {
      setCreating(true)

      if (createMode === 'order') {
        if (!selectedOrderId) {
          toast.error('Veuillez sélectionner une commande')
          setCreating(false)
          return
        }

        // Build lines array with selected quantities
        const lines = orderLinesForDelivery
          .filter((l) => includedLines[l.id] && (deliveryQuantities[l.id] || 0) > 0)
          .map((l) => ({
            salesOrderLineId: l.id,
            quantity: deliveryQuantities[l.id],
          }))

        // Add supplementary (free) lines
        const supplementaryLines = editableLines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
          }))

        if (lines.length === 0 && supplementaryLines.length === 0) {
          toast.error('Sélectionnez au moins une ligne à livrer avec une quantité > 0')
          setCreating(false)
          return
        }
        if (createDeliveryType === 'manual' && !manualDeliveryAddress.trim()) {
          toast.error('Veuillez saisir l\'adresse de livraison')
          setCreating(false)
          return
        }

        await api.post('/delivery-notes', {
          salesOrderId: selectedOrderId,
          chantierId: selectedChantierId || undefined,
          deliveryAddress: createDeliveryType === 'manual' ? manualDeliveryAddress : undefined,
          transporteur: createTransporteur || undefined,
          vehiclePlate: createVehiclePlate || undefined,
          notes: createNotes || undefined,
          plannedDate: createPlannedDate || undefined,
          driverName: createDriverName || undefined,
          transportType: createTransportType || undefined,
          dueDate: createDueDate || undefined,
          lines: [...lines, ...supplementaryLines],
        })
      } else {
        // Standalone mode
        if (!selectedClientId) {
          toast.error('Veuillez sélectionner un client')
          setCreating(false)
          return
        }
        if (editableLines.length === 0) {
          toast.error('Ajoutez au moins une ligne de produit')
          setCreating(false)
          return
        }
        if (createDeliveryType === 'manual' && !manualDeliveryAddress.trim()) {
          toast.error('Veuillez saisir l\'adresse de livraison')
          setCreating(false)
          return
        }
        await api.post('/delivery-notes', {
          clientId: selectedClientId,
          chantierId: selectedChantierId || undefined,
          deliveryAddress: createDeliveryType === 'manual' ? manualDeliveryAddress : undefined,
          transporteur: createTransporteur || undefined,
          vehiclePlate: createVehiclePlate || undefined,
          notes: createNotes || undefined,
          plannedDate: createPlannedDate || undefined,
          driverName: createDriverName || undefined,
          transportType: createTransportType || undefined,
          dueDate: createDueDate || undefined,
          lines: editableLines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
          })),
        })
      }

      toast.success('Bon de livraison créé avec succès')
      setCreateOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur création')
    } finally {
      setCreating(false)
    }
  }

  // ─── Editable Lines Management (Standalone Mode) ───

  const addEditableLine = () => {
    setEditableLines([
      ...editableLines,
      {
        tempId: `temp-${Date.now()}`,
        productId: '',
        quantity: 1,
        unitPrice: 0,
        tvaRate: 20,
      },
    ])
  }

  const removeEditableLine = (tempId: string) => {
    setEditableLines(editableLines.filter((l) => l.tempId !== tempId))
  }

  const updateEditableLine = (tempId: string, field: keyof EditableLine, value: string | number) => {
    setEditableLines(
      editableLines.map((l) => {
        if (l.tempId !== tempId) return l
        const updated = { ...l, [field]: value }

        if (field === 'productId' && typeof value === 'string') {
          const prod = availableProducts.find((p) => p.id === value)
          if (prod) {
            updated.unitPrice = prod.priceHT ?? 0
            updated.tvaRate = prod.tvaRate ?? 20
          }
        }
        return updated
      })
    )
  }

  const getEditableLineTotalHT = (line: EditableLine) => line.quantity * line.unitPrice

  const getEditableLineTotalTTC = (line: EditableLine) => {
    const ht = line.quantity * line.unitPrice
    return ht * (1 + line.tvaRate / 100)
  }

  const getGrandTotalHT = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalHT(l), 0)
  const getGrandTotalTVA = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalHT(l) * (l.tvaRate / 100), 0)
  const getGrandTotalTTC = () => editableLines.reduce((sum, l) => sum + getEditableLineTotalTTC(l), 0)

  // ─── Edit BL ───

  const { lineSearches: editLineSearches, setLineSearches: setEditLineSearches, getFilteredProducts: getEditFilteredProducts, resetLineSearches: resetEditLineSearches } = useProductSearch(editProducts)

  const openEditDialog = async (note: DeliveryNote) => {
    if (note.status === 'cancelled') {
      toast.error('Impossible de modifier un BL annulé')
      return
    }
    setSelectedNote(note)
    setEditTransporteur(note.transporteur || '')
    setEditVehiclePlate(note.vehiclePlate || '')
    setEditNotes(note.notes || '')
    setEditPlannedDate(note.plannedDate ? format(new Date(note.plannedDate), 'yyyy-MM-dd') : '')
    setEditDriverName(note.driverName || '')
    setEditTransportType(note.transportType || 'rendu')
    setEditDueDate(note.dueDate ? format(new Date(note.dueDate), 'yyyy-MM-dd') : '')

    // Auto-detect current delivery address mode
    if (note.chantier?.id) {
      setEditDeliveryType('chantier')
      setEditChantierId(note.chantier.id)
      setEditManualDeliveryAddress('')
    } else if (note.deliveryAddress) {
      setEditDeliveryType('manual')
      setEditManualDeliveryAddress(note.deliveryAddress)
      setEditChantierId('')
    } else {
      setEditDeliveryType('none')
      setEditChantierId('')
      setEditManualDeliveryAddress('')
    }

    // Populate edit lines from existing lines
    setEditLines(note.lines.map(l => ({
      tempId: l.id,
      id: l.id,
      salesOrderLineId: l.salesOrderLineId,
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      tvaRate: l.tvaRate,
      product: l.product,
    })))
    resetEditLineSearches()

    // Fetch chantiers + products for this client
    setEditChantierOptions([])
    try {
      const [chantierData, productsData] = await Promise.all([
        api.get<{ chantiers: ChantierOption[] }>(`/clients/${note.client.id}/chantiers`),
        api.get<{ products: ProductOption[] }>('/products?dropdown=true&productUsage=vente&active=true'),
      ])
      setEditChantierOptions(chantierData.chantiers || [])
      setEditProducts(productsData.products || [])
    } catch {
      setEditChantierOptions([])
      setEditProducts([])
    }

    setEditOpen(true)
  }

  // Edit line management
  const addEditLine = () => {
    setEditLines([
      ...editLines,
      {
        tempId: `new-${Date.now()}`,
        productId: '',
        quantity: 1,
        unitPrice: 0,
        tvaRate: 20,
      },
    ])
  }

  const removeEditLine = (tempId: string) => {
    setEditLines(editLines.filter(l => l.tempId !== tempId))
  }

  const updateEditLine = (tempId: string, field: keyof EditLine, value: string | number) => {
    setEditLines(editLines.map(l => {
      if (l.tempId !== tempId) return l
      const updated = { ...l, [field]: value }
      if (field === 'productId' && typeof value === 'string') {
        const prod = editProducts.find(p => p.id === value)
        if (prod) {
          updated.unitPrice = prod.priceHT ?? 0
          updated.tvaRate = prod.tvaRate ?? 20
          updated.product = { id: prod.id, reference: prod.reference, designation: prod.designation }
        }
      }
      return updated
    }))
  }

  const getEditLineTotalHT = (line: EditLine) => line.quantity * line.unitPrice

  const getEditTotals = () => {
    let totalHT = 0
    let totalTVA = 0
    editLines.forEach(l => {
      if (!l.productId) return
      const ht = l.quantity * l.unitPrice
      totalHT += ht
      totalTVA += ht * (l.tvaRate / 100)
    })
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }

  const handleEdit = async () => {
    if (!selectedNote) return
    try {
      setSaving(true)
      if (editDeliveryType === 'manual' && !editManualDeliveryAddress.trim()) {
        toast.error('Veuillez saisir l\'adresse de livraison')
        setSaving(false)
        return
      }

      const validLines = editLines.filter(l => l.productId)
      if (validLines.length === 0) {
        toast.error('Au moins une ligne est requise')
        setSaving(false)
        return
      }

      const hasLineChanges = validLines.some(l => {
        if (!l.id) return true // new line
        const orig = selectedNote.lines.find(ol => ol.id === l.id)
        if (!orig) return true
        return Math.abs(orig.quantity - l.quantity) > 0.001 ||
               Math.abs(orig.unitPrice - l.unitPrice) > 0.001 ||
               Math.abs(orig.tvaRate - l.tvaRate) > 0.001
      })

      const removedLines = selectedNote.lines.some(ol => !validLines.find(l => l.id === ol.id))

      if (hasLineChanges || removedLines) {
        // Use edit_lines action for line changes
        await api.put('/delivery-notes', {
          id: selectedNote.id,
          action: 'edit_lines',
          lines: validLines.map(l => ({
            id: l.id || undefined,
            salesOrderLineId: l.salesOrderLineId || undefined,
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            tvaRate: l.tvaRate,
          })),
          chantierId: editDeliveryType === 'chantier' ? editChantierId : null,
          deliveryAddress: editDeliveryType === 'manual' ? editManualDeliveryAddress : null,
          transporteur: editTransporteur || null,
          vehiclePlate: editVehiclePlate || null,
          driverName: editDriverName || null,
          transportType: editTransportType || null,
          dueDate: editDueDate || undefined,
          notes: editNotes || null,
          plannedDate: editPlannedDate || undefined,
        })
      } else {
        // Simple header-only update
        await api.put('/delivery-notes', {
          id: selectedNote.id,
          transporteur: editTransporteur || null,
          vehiclePlate: editVehiclePlate || null,
          notes: editNotes || null,
          plannedDate: editPlannedDate || undefined,
          chantierId: editDeliveryType === 'chantier' ? editChantierId : null,
          deliveryAddress: editDeliveryType === 'manual' ? editManualDeliveryAddress : null,
          driverName: editDriverName || null,
          transportType: editTransportType || null,
          dueDate: editDueDate || undefined,
        })
      }

      const isDelivered = selectedNote.status === 'delivered'
      toast.success(`BL ${selectedNote.number} modifié${isDelivered ? ' (stock mis à jour)' : ''}`)
      setEditOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur modification')
    } finally {
      setSaving(false)
    }
  }

  // ─── Status Actions ───

  const handleConfirm = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'confirm' })
      toast.success(`BL ${note.number} confirmé`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur confirmation')
    }
  }

  const handleDeliver = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'deliver' })
      toast.success(`BL ${note.number} livré — stock mis à jour`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur livraison')
    }
  }

  const handleUndeliver = async (note: DeliveryNote) => {
    try {
      await api.put('/delivery-notes', { id: note.id, action: 'undeliver' })
      toast.success(`BL ${note.number} remis en confirmation — stock et qté livrée ajustés`)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation livraison')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.put('/delivery-notes', { id, action: 'cancel' })
      toast.success('BL annulé')
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation')
    }
  }

  // ─── Delete ───

  const confirmDelete = (id: string) => {
    setDeleteId(id)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/delivery-notes?id=${deleteId}`)
      toast.success('BL supprimé')
      setDeleteOpen(false)
      setDeleteId(null)
      if (detailOpen) setDetailOpen(false)
      fetchDeliveryNotes()
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression')
    }
  }

  // ─── Detail ───

  const openDetail = (note: DeliveryNote) => {
    setSelectedNote(note)
    setDetailOpen(true)
  }

  // ─── Action Menu ───

  const getActions = (note: DeliveryNote) => {
    const actions: { label: string; icon: React.ReactNode; action: string }[] = []
    switch (note.status) {
      case 'draft':
        actions.push({ label: 'Modifier', icon: <Pencil className="h-4 w-4" />, action: 'edit' })
        actions.push({ label: 'Confirmer', icon: <CheckCircle className="h-4 w-4" />, action: 'confirm' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        if (isSuperAdmin) actions.push({ label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, action: 'delete' })
        break
      case 'confirmed':
        actions.push({ label: 'Modifier', icon: <Pencil className="h-4 w-4" />, action: 'edit' })
        actions.push({ label: 'Livrer', icon: <Truck className="h-4 w-4" />, action: 'deliver' })
        actions.push({ label: 'Annuler', icon: <XCircle className="h-4 w-4" />, action: 'cancel' })
        break
      case 'delivered':
        actions.push({ label: 'Modifier', icon: <Pencil className="h-4 w-4" />, action: 'edit' })
        actions.push({ label: 'Dé-livrer', icon: <RefreshCw className="h-4 w-4" />, action: 'undeliver' })
        break
    }
    return actions
  }

  const executeAction = async (note: DeliveryNote, action: string) => {
    switch (action) {
      case 'edit': openEditDialog(note); break
      case 'confirm': await handleConfirm(note); break
      case 'deliver': await handleDeliver(note); break
      case 'undeliver': await handleUndeliver(note); break
      case 'cancel': await handleCancel(note.id); break
      case 'delete': confirmDelete(note.id); break
    }
  }

  // ─── Loading ───

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <Card><CardContent className="p-4"><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent></Card>
      </div>
    )
  }

  // ─── Render ───

  return (
    <div className="space-y-4">
      {/* Header + Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Bons de Livraison</h2>
          <Badge variant="secondary">{deliveryNotes.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section="ventes" sub="bons-livraison" />
          <Button variant="outline" size="sm" onClick={fetchDeliveryNotes}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau bon de livraison
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par N°, commande, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="N° Cmd Client..."
          value={filterClientOrderNumber}
          onChange={(e) => setFilterClientOrderNumber(e.target.value)}
          className="w-[180px]"
        />
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            {clientOptionsForFilter.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.raisonSociale || c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clientFilter && clientFilter !== 'all' && (
          <Select value={chantierFilter} onValueChange={setChantierFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les chantiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les chantiers</SelectItem>
              {chantierOptionsForFilter.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  {ch.nomProjet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="delivered">Livré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <IconLegend items={deliveryNoteLegendItems} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>N° Cmd Client</TableHead>
                  <TableHead className="hidden md:table-cell">Chantier</TableHead>
                  <TableHead>Commande / Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Date prévue</TableHead>
                  <TableHead className="hidden md:table-cell">% Livré</TableHead>
                  <TableHead className="hidden lg:table-cell">Transporteur</TableHead>
                  <TableHead className="hidden lg:table-cell">Total TTC</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-10 w-10 text-muted-foreground/30" />
                        <p className="font-medium">Aucun bon de livraison</p>
                        <p className="text-sm">
                          Cliquez sur &quot;Nouveau bon de livraison&quot; pour en créer un.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveryNotes.map((note) => {
                    const deliveryPct = getOrderDeliveryPercentage(note)
                    return (
                      <TableRow key={note.id} className={cn("cursor-pointer", expandedNoteId === note.id && "bg-primary/5 border-l-2 border-l-primary")} onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)} onDoubleClick={() => openEditDialog(note)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(note.status)}
                            <span className="font-mono font-medium">{note.number}</span>
                          </div>
                        </TableCell>
                      <TableCell>
                        {note.salesOrder?.clientOrderNumber ? (
                          <span className="font-mono text-sm font-semibold text-primary">{note.salesOrder.clientOrderNumber}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {note.chantier ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <HardHat className="h-3 w-3" />
                              {note.chantier.nomProjet}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {note.salesOrderId ? (
                            <div>
                              <p className="font-mono text-sm">{note.salesOrder?.number}</p>
                              <p className="text-xs text-muted-foreground">{note.client.name}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium">{note.client.name}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[note.status] || ''}>
                            {statusLabels[note.status] || note.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {note.plannedDate ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {format(new Date(note.plannedDate), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {deliveryPct !== null ? (
                            <DeliveryProgressBar percentage={deliveryPct} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {note.transporteur || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-medium">
                          {formatCurrency(note.totalTTC)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(note)} title="Détails">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {getActions(note).length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {getActions(note).map((action) => (
                                    <DropdownMenuItem
                                      key={action.action}
                                      onClick={() => executeAction(note, action.action)}
                                      className={action.action === 'delete' ? 'text-destructive focus:text-destructive' : ''}
                                    >
                                      {action.icon}
                                      <span className="ml-2">{action.label}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Inline Detail Panel */}
      {expandedNoteId && (() => {
        const en = deliveryNotes.find(n => n.id === expandedNoteId)
        if (!en) return null
        return (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{en.number}</span>
                      <Badge variant="secondary" className={statusColors[en.status]}>{statusLabels[en.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{en.client.name} — {format(new Date(en.date), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => openDetail(en)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ouvrir
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!en) return
                    printDocument({
                      title: 'BON DE LIVRAISON',
                      docNumber: en.number,
                      infoGrid: [
                        { label: 'N° BL', value: en.number },
                        { label: 'Date du BL', value: fmtDate(en.date) },
                        ...(en.salesOrder?.clientOrderNumber ? [{ label: 'N° Cmd Client', value: en.salesOrder.clientOrderNumber }] : []),
                        ...(en.salesOrder ? [{ label: 'Commande', value: en.salesOrder.clientOrderNumber }] : []),
                        { label: 'Date d\'échéance', value: fmtDate(en.dueDate || '') || '—' },
                        { label: 'Client', value: en.client.name },
                        { label: 'Adresse de livraison', value: (() => {
                          if (en.deliveryAddress) return en.deliveryAddress
                          if (en.chantier) {
                            const parts = [en.chantier.nomProjet, en.chantier.adresse, en.chantier.ville].filter(Boolean)
                            return parts.join(' - ') || null
                          }
                          if (en.client?.address) {
                            const parts = [en.client.address, en.client.city].filter(Boolean)
                            return parts.join(', ') || null
                          }
                          return null
                        })() || '—', colspan: 2 },
                        ...(en.chantier && en.chantier.responsableNom ? [{ label: 'Responsable', value: en.chantier.responsableNom }] : []),
                        ...(en.chantier && (en.chantier.telephone || en.chantier.gsm) ? [{ label: 'Tél chantier', value: en.chantier.telephone || en.chantier.gsm || '—' }] : []),
                        { label: 'Chauffeur', value: en.driverName || '—' },
                        { label: 'Matricule véhicule', value: en.vehiclePlate || '—' },
                        { label: 'Type transport', value: en.transportType === 'rendu' ? 'Rendu' : en.transportType === 'depart' ? 'Départ' : '—' },
                        { label: 'Transporteur', value: en.transporteur || '—' },
                        { label: 'Responsable BL', value: en.createdByName || '—' },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'Qté livrée', align: 'right' },
                        { label: 'Reste', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: en.lines.map(line => {
                        const totalDelivered = line.salesOrderLine ? (line.salesOrderLine.quantityDelivered || 0) : line.quantity
                        const remaining = line.salesOrderLine ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0)) : (line.remainingAfterDelivery ?? 0)
                        return [
                          { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                          { value: line.quantity, align: 'right' },
                          { value: totalDelivered, align: 'right' },
                          { value: remaining, align: 'right' },
                          { value: fmtMoney(line.unitPrice), align: 'right' },
                          { value: fmtMoney(line.totalHT), align: 'right' },
                        ]
                      }),
                      totals: [
                        { label: 'Total HT', value: fmtMoney(en.totalHT) },
                        { label: 'TVA', value: fmtMoney(en.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(en.totalTTC), bold: true },
                      ],
                      subSections: buildVisaHtml(en.notes),
                      amountInWords: numberToFrenchWords(en.totalTTC || 0) + ' dirhams',
                      amountInWordsLabel: 'Arrêté le présent bon de livraison à la somme de',
                    })
                  }}>
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedNoteId(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Type transport</span>
                  <p className="font-medium">{en.transportType === 'rendu' ? 'Rendu' : en.transportType === 'depart' ? 'Départ' : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Chauffeur</span>
                  <p className="font-medium">{en.driverName || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Immatriculation</span>
                  <p className="font-medium">{en.vehiclePlate || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Date d'échéance</span>
                  <p className="font-medium">{en.dueDate ? format(new Date(en.dueDate), 'dd/MM/yyyy', { locale: fr }) : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Date prévue</span>
                  <p className="font-medium">{en.plannedDate ? format(new Date(en.plannedDate), 'dd/MM/yyyy', { locale: fr }) : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Transporteur</span>
                  <p className="font-medium">{en.transporteur || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Responsable BL</span>
                  <p className="font-medium">{en.createdByName || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <span className="text-muted-foreground text-xs">Nb Lignes</span>
                  <p className="font-medium">{en.lines.length}</p>
                </div>
              </div>

              {en.chantier && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <HardHat className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Chantier : {en.chantier.nomProjet}</span>
                  </div>
                  <div className="text-muted-foreground space-y-0.5">
                    <p>{en.chantier.adresse}, {en.chantier.ville}{en.chantier.codePostal ? ` - ${en.chantier.codePostal}` : ''}</p>
                    {en.chantier.responsableNom && (
                      <p>Responsable : {en.chantier.responsableNom}{en.chantier.responsableFonction ? ` (${en.chantier.responsableFonction})` : ''}</p>
                    )}
                    {(en.chantier.telephone || en.chantier.gsm) && (
                      <p>Tél : {en.chantier.telephone || en.chantier.gsm}</p>
                    )}
                  </div>
                </div>
              )}

              {en.deliveryAddress && !en.chantier && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPinned className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Adresse de livraison</span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{en.deliveryAddress}</p>
                </div>
              )}

              {en.lines.length > 0 && (
                <div className="rounded border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right w-[70px]">Qté</TableHead>
                        <TableHead className="text-right w-[90px]">Livré</TableHead>
                        <TableHead className="text-right w-[90px]">Reste</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. HT</TableHead>
                        <TableHead className="text-right w-[100px]">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {en.lines.map((line) => {
                        const totalDelivered = line.salesOrderLine ? (line.salesOrderLine.quantityDelivered || 0) : line.quantity
                        const remaining = line.salesOrderLine ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0)) : (line.remainingAfterDelivery ?? 0)
                        return (
                          <TableRow key={line.id || line.productId}>
                            <TableCell className="font-medium text-sm">
                              <span className="font-mono text-muted-foreground mr-2">{line.product?.reference || ''}</span>
                              {line.product?.designation || '—'}
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">{totalDelivered}</TableCell>
                            <TableCell className="text-right">{remaining}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(line.totalHT)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {en.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes :</span> {en.notes}</div>
              )}

              <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(en.totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(en.totalTVA)}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span>{formatCurrency(en.totalTTC)}</span></div>
                <div className="text-sm italic text-muted-foreground pt-1">{numberToFrenchWords(en.totalTTC || 0)} dirhams</div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CREATE DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nouveau bon de livraison
            </DialogTitle>
            <DialogDescription>
              Créez un bon de livraison lié à une commande ou un BL autonome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="space-y-2">
              <Label>Type de bon de livraison</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateMode('order')}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    createMode === 'order'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <ShoppingCart className={`h-5 w-5 ${createMode === 'order' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Avec commande</p>
                    <p className="text-xs text-muted-foreground">Lier à un bon de commande existant</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('standalone')}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    createMode === 'standalone'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <Package className={`h-5 w-5 ${createMode === 'standalone' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Sans commande</p>
                    <p className="text-xs text-muted-foreground">BL autonome (sélection manuelle)</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Mode: With Sales Order (Partial Delivery) ── */}
            {createMode === 'order' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Commande client <span className="text-destructive">*</span></Label>
                  {loadingOrders ? (
                    <Skeleton className="h-10 w-full" />
                  ) : availableOrders.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Aucune commande préparée disponible.<br />
                      Veuillez d&apos;abord préparer une commande ou utilisez le mode &quot;Sans commande&quot;.
                    </div>
                  ) : (
                    <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une commande..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex flex-col">
                              <span className="font-mono text-sm">{order.clientOrderNumber} - {order.client.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(order.totalTTC)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Order Lines with Delivery Tracking */}
                {selectedOrderId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Lignes à livrer</Label>
                      {orderLinesForDelivery.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {orderLinesForDelivery.length} ligne(s) restante(s) &middot; {getSelectedLineCount()} sélectionnée(s)
                        </span>
                      )}
                    </div>

                    {loadingOrderLines ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Chargement des lignes...</span>
                      </div>
                    ) : orderLinesForDelivery.length === 0 ? (
                      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Cette commande est déjà entièrement livrée.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <div className="max-h-[280px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[40px]">
                                  <Checkbox
                                    checked={orderLinesForDelivery.every((l) => includedLines[l.id])}
                                    onCheckedChange={(checked) => {
                                      const val = checked === true
                                      const newIncluded: Record<string, boolean> = {}
                                      const newQty: Record<string, number> = {}
                                      orderLinesForDelivery.forEach((l) => {
                                        newIncluded[l.id] = val
                                        newQty[l.id] = val ? l.remaining : 0
                                      })
                                      setIncludedLines(newIncluded)
                                      setDeliveryQuantities(newQty)
                                    }}
                                  />
                                </TableHead>
                                <TableHead className="w-[28%]">Produit</TableHead>
                                <TableHead className="text-right w-[10%]">Commandé</TableHead>
                                <TableHead className="text-right w-[10%]">Livré</TableHead>
                                <TableHead className="text-right w-[10%]">Restant</TableHead>
                                <TableHead className="text-center w-[12%]">Avancement</TableHead>
                                <TableHead className="text-right w-[15%]">Qté BL</TableHead>
                                <TableHead className="text-right w-[15%]">Total HT</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orderLinesForDelivery.map((line) => {
                                const isIncluded = includedLines[line.id] ?? true
                                const qty = deliveryQuantities[line.id] ?? 0
                                return (
                                  <TableRow key={line.id} className={!isIncluded ? 'opacity-50' : ''}>
                                    <TableCell>
                                      <Checkbox
                                        checked={isIncluded}
                                        onCheckedChange={(checked) => toggleLineIncluded(line.id, checked === true)}
                                      />
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{line.product?.designation || (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</p>
                                          <p className="text-muted-foreground font-mono">{line.product?.reference}</p>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                                    <TableCell className="text-right text-sm text-blue-600 font-medium">{line.quantityDelivered}</TableCell>
                                    <TableCell className="text-right text-sm text-amber-600 font-semibold">{line.remaining}</TableCell>
                                    <TableCell className="text-center">
                                      <DeliveryProgressBar percentage={line.deliveryPercentage} />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        max={line.remaining}
                                        step="0.01"
                                        value={qty}
                                        disabled={!isIncluded}
                                        onChange={(e) => updateDeliveryQuantity(line.id, Math.min(parseNum(e.target.value), line.remaining))}
                                        className="h-8 text-right text-sm"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium">
                                      {isIncluded && qty > 0 ? formatCurrency(qty * line.unitPrice) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {/* Totals */}
                        {hasAnyQuantity() && (
                          <div className="flex justify-end p-3 border-t bg-muted/30">
                            <div className="w-64 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total HT</span>
                                <span className="font-medium">{formatCurrency(getOrderDeliveryTotals().totalHT)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total TVA</span>
                                <span className="font-medium">{formatCurrency(getOrderDeliveryTotals().totalTVA)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 font-semibold text-base">
                                <span>Total TTC</span>
                                <span>{formatCurrency(getOrderDeliveryTotals().totalTTC)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Supplementary Lines */}
                    {orderLinesForDelivery.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            Articles supplémentaires
                          </Label>
                          <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addEditableLine}>
                            <Plus className="h-3 w-3" /> Ajouter un article supplémentaire
                          </Button>
                        </div>
                        {editableLines.length > 0 && (
                          <div className="rounded-md border border-dashed">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[36%]">Produit</TableHead>
                                  <TableHead className="w-[18%] text-right">Qté</TableHead>
                                  <TableHead className="w-[20%] text-right">P.U. HT</TableHead>
                                  <TableHead className="w-[16%] text-right">TVA %</TableHead>
                                  <TableHead className="w-[16%] text-right">Total HT</TableHead>
                                  <TableHead className="w-[40px]" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {editableLines.map((line, idx) => (
                                  <TableRow key={line.tempId}>
                                    <TableCell>
                                      <ProductCombobox
                                        products={getFilteredProducts(1000 + idx)}
                                        value={line.productId}
                                        searchValue={lineSearches[1000 + idx] || ''}
                                        onSearchChange={(val) => setLineSearches(prev => ({ ...prev, [1000 + idx]: val }))}
                                        onSelect={(productId) => {
                                          updateEditableLine(line.tempId, 'productId', productId)
                                          setLineSearches(prev => ({ ...prev, [1000 + idx]: '' }))
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input type="number" min="0.01" step="1" value={line.quantity}
                                        onChange={(e) => updateEditableLine(line.tempId, 'quantity', parseNum(e.target.value))}
                                        className="w-full h-8" />
                                    </TableCell>
                                    <TableCell>
                                      <Input type="number" min="0" step="0.01" value={line.unitPrice}
                                        onChange={(e) => updateEditableLine(line.tempId, 'unitPrice', parseNum(e.target.value))}
                                        className="w-full h-8 text-right" />
                                    </TableCell>
                                    <TableCell>
                                      <Select value={String(line.tvaRate)} onValueChange={(v) => updateEditableLine(line.tempId, 'tvaRate', parseFloat(v))}>
                                        <SelectTrigger className="w-full h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="0">0%</SelectItem>
                                          <SelectItem value="7">7%</SelectItem>
                                          <SelectItem value="10">10%</SelectItem>
                                          <SelectItem value="14">14%</SelectItem>
                                          <SelectItem value="20">20%</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium">
                                      {line.productId ? formatCurrency(line.quantity * line.unitPrice) : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                        onClick={() => removeEditableLine(line.tempId)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Mode: Standalone (No Sales Order) ── */}
            {createMode === 'standalone' && (
              <>
                {/* Client Select */}
                <div className="space-y-2">
                  <Label>Client <span className="text-destructive">*</span></Label>
                  {loadingClients ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <EntityCombobox
                      entities={availableClients}
                      value={selectedClientId}
                      onValueChange={setSelectedClientId}
                      placeholder="Sélectionner un client..."
                      searchPlaceholder="Rechercher par raison sociale, nom, ICE..."
                      showSubText="ville"
                    />
                  )}
                </div>

                {/* Product Lines */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Articles <span className="text-destructive">*</span></Label>
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addEditableLine}>
                      <Plus className="h-3.5 w-3.5" /> Ajouter un article
                    </Button>
                  </div>

                  {loadingProducts ? (
                    <Skeleton className="h-20 w-full" />
                  ) : editableLines.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Cliquez sur &quot;Ajouter un article&quot; pour commencer.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Produit</TableHead>
                            <TableHead className="w-[15%] text-right">Qté</TableHead>
                            <TableHead className="w-[20%] text-right">P.U. HT</TableHead>
                            <TableHead className="w-[15%] text-right">TVA %</TableHead>
                            <TableHead className="w-[15%] text-right">Total HT</TableHead>
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editableLines.map((line) => (
                            <TableRow key={line.tempId}>
                              <TableCell>
                                <ProductCombobox
                                  products={getFilteredProducts(line.tempId)}
                                  value={line.productId}
                                  searchValue={lineSearches[line.tempId] || ''}
                                  onSearchChange={(val) => setLineSearches(prev => ({ ...prev, [line.tempId]: val }))}
                                  onSelect={(productId) => {
                                    updateEditableLine(line.tempId, 'productId', productId)
                                    setLineSearches(prev => ({ ...prev, [line.tempId]: '' }))
                                  }}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={line.quantity}
                                  onChange={(e) => updateEditableLine(line.tempId, 'quantity', parseNum(e.target.value))}
                                  className="h-8 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitPrice}
                                  onChange={(e) => updateEditableLine(line.tempId, 'unitPrice', parseNum(e.target.value))}
                                  className="h-8 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={String(line.tvaRate)}
                                  onValueChange={(val) => updateEditableLine(line.tempId, 'tvaRate', parseFloat(val))}
                                >
                                  <SelectTrigger className="h-8 text-xs text-right">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="20">20%</SelectItem>
                                    <SelectItem value="14">14%</SelectItem>
                                    <SelectItem value="10">10%</SelectItem>
                                    <SelectItem value="7">7%</SelectItem>
                                    <SelectItem value="0">0%</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(getEditableLineTotalHT(line))}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeEditableLine(line.tempId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* Totals */}
                      {editableLines.length > 0 && (
                        <div className="flex justify-end p-3 border-t bg-muted/30">
                          <div className="w-64 space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total HT</span>
                              <span className="font-medium">{formatCurrency(getGrandTotalHT())}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total TVA</span>
                              <span className="font-medium">{formatCurrency(getGrandTotalTVA())}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 font-semibold text-base">
                              <span>Total TTC</span>
                              <span>{formatCurrency(getGrandTotalTTC())}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Lieu de livraison */}
            {effectiveCreateClientId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPinned className="h-3.5 w-3.5" />
                  Lieu de livraison
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => { setCreateDeliveryType('principal'); setSelectedChantierId(''); setManualDeliveryAddress('') }}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                      createDeliveryType === 'principal'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${createDeliveryType === 'principal' ? 'border-primary' : 'border-muted-foreground'}`}>
                      {createDeliveryType === 'principal' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    Adresse principale
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateDeliveryType('chantier'); setManualDeliveryAddress('') }}
                    disabled={chantierOptions.length === 0}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm disabled:opacity-50 ${
                      createDeliveryType === 'chantier'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${createDeliveryType === 'chantier' ? 'border-primary' : 'border-muted-foreground'}`}>
                      {createDeliveryType === 'chantier' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <HardHat className="h-4 w-4 shrink-0" />
                    Chantier existant
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateDeliveryType('manual'); setSelectedChantierId('') }}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                      createDeliveryType === 'manual'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${createDeliveryType === 'manual' ? 'border-primary' : 'border-muted-foreground'}`}>
                      {createDeliveryType === 'manual' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <MapPinned className="h-4 w-4 shrink-0" />
                    Autre adresse
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateDeliveryType('none'); setSelectedChantierId(''); setManualDeliveryAddress('') }}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                      createDeliveryType === 'none'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${createDeliveryType === 'none' ? 'border-primary' : 'border-muted-foreground'}`}>
                      {createDeliveryType === 'none' && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    Aucun
                  </button>
                </div>
                {createDeliveryType === 'chantier' && (
                  <Select value={selectedChantierId} onValueChange={setSelectedChantierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un chantier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chantierOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{c.nomProjet}</span>
                            <span className="text-xs text-muted-foreground">{c.adresse}, {c.ville}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {createDeliveryType === 'manual' && (
                  <div className="space-y-2 mt-2">
                    <Label>Adresse de livraison <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="Saisissez l'adresse de livraison complète..."
                      value={manualDeliveryAddress}
                      onChange={(e) => setManualDeliveryAddress(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Planned Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Date prévue de livraison
              </Label>
              <Input
                type="date"
                value={createPlannedDate}
                onChange={(e) => setCreatePlannedDate(e.target.value)}
                placeholder="Date prévue..."
              />
            </div>

            {/* Type de transport */}
            <div className="space-y-2">
              <Label>Type de transport</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateTransportType('rendu')}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition-all text-sm font-medium ${
                    createTransportType === 'rendu'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <Truck className="h-4 w-4" />
                  Rendu
                </button>
                <button
                  type="button"
                  onClick={() => setCreateTransportType('depart')}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition-all text-sm font-medium ${
                    createTransportType === 'depart'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Départ
                </button>
              </div>
            </div>

            {/* Chauffeur */}
            <div className="space-y-2">
              <Label>Nom & Prénom du chauffeur</Label>
              <Input
                value={createDriverName}
                onChange={(e) => setCreateDriverName(e.target.value)}
                placeholder="Nom, Prénom du chauffeur..."
              />
            </div>

            {/* Date d'échéance */}
            <div className="space-y-2">
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={createDueDate}
                onChange={(e) => setCreateDueDate(e.target.value)}
              />
            </div>

            {/* Transporteur */}
            <div className="space-y-2">
              <Label>Transporteur</Label>
              <Input
                value={createTransporteur}
                onChange={(e) => setCreateTransporteur(e.target.value)}
                placeholder="Nom du transporteur..."
              />
            </div>

            {/* Vehicle Plate */}
            <div className="space-y-2">
              <Label>Immatriculation véhicule</Label>
              <Input
                value={createVehiclePlate}
                onChange={(e) => setCreateVehiclePlate(e.target.value)}
                placeholder="Ex: 12345-A-6"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Instructions de livraison..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                (createMode === 'order' && (!selectedOrderId || !hasAnyQuantity())) ||
                (createMode === 'standalone' && (!selectedClientId || editableLines.length === 0))
              }
            >
              {creating ? 'Création...' : 'Créer le BL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* EDIT DIALOG                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Modifier le BL {selectedNote?.number}
            </DialogTitle>
            <DialogDescription>
              {selectedNote?.status === 'delivered'
                ? '⚠️ BL livré — toute modification de quantité mettra à jour le stock et les quantités livrées de la commande.'
                : selectedNote?.status === 'confirmed'
                  ? 'Modifiez les informations et les lignes du bon de livraison.'
                  : 'Modifiez les informations et les lignes du bon de livraison.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">
                    {selectedNote?.salesOrderId ? (
                      <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Lié à une commande</span>
                    ) : (
                      <span className="flex items-center gap-1"><Unlink className="h-3.5 w-3.5" /> BL autonome</span>
                    )}
                  </p>
                </div>
                {selectedNote?.salesOrderId && (
                  <div>
                    <span className="text-muted-foreground">Commande</span>
                    <p className="font-mono font-medium">{selectedNote?.salesOrder?.number}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote?.client.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Date prévue de livraison
              </Label>
              <Input
                type="date"
                value={editPlannedDate}
                onChange={(e) => setEditPlannedDate(e.target.value)}
              />
            </div>

            {/* Adresse de livraison */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPinned className="h-3.5 w-3.5" />
                Adresse de livraison
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => { setEditDeliveryType('principal'); setEditChantierId(''); setEditManualDeliveryAddress('') }}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                    editDeliveryType === 'principal'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${editDeliveryType === 'principal' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {editDeliveryType === 'principal' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  Adresse principale
                </button>
                <button
                  type="button"
                  onClick={() => { setEditDeliveryType('chantier'); setEditManualDeliveryAddress('') }}
                  disabled={editChantierOptions.length === 0}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm disabled:opacity-50 ${
                    editDeliveryType === 'chantier'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${editDeliveryType === 'chantier' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {editDeliveryType === 'chantier' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <HardHat className="h-4 w-4 shrink-0" />
                  Chantier existant
                </button>
                <button
                  type="button"
                  onClick={() => { setEditDeliveryType('manual'); setEditChantierId('') }}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                    editDeliveryType === 'manual'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${editDeliveryType === 'manual' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {editDeliveryType === 'manual' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <MapPinned className="h-4 w-4 shrink-0" />
                  Autre adresse
                </button>
                <button
                  type="button"
                  onClick={() => { setEditDeliveryType('none'); setEditChantierId(''); setEditManualDeliveryAddress('') }}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all text-sm ${
                    editDeliveryType === 'none'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${editDeliveryType === 'none' ? 'border-primary' : 'border-muted-foreground'}`}>
                    {editDeliveryType === 'none' && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  Aucun
                </button>
              </div>
              {editDeliveryType === 'chantier' && (
                <Select value={editChantierId} onValueChange={setEditChantierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chantier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editChantierOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{c.nomProjet}</span>
                          <span className="text-xs text-muted-foreground">{c.adresse}, {c.ville}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {editDeliveryType === 'manual' && (
                <div className="space-y-2 mt-2">
                  <Label>Adresse de livraison <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Saisissez l'adresse de livraison complète..."
                    value={editManualDeliveryAddress}
                    onChange={(e) => setEditManualDeliveryAddress(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
              {editDeliveryType === 'principal' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Le BL sera livré à l'adresse principale du client.
                </p>
              )}
            </div>

            {/* Type de transport */}
            <div className="space-y-2">
              <Label>Type de transport</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditTransportType('rendu')}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition-all text-sm font-medium ${
                    editTransportType === 'rendu'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <Truck className="h-4 w-4" />
                  Rendu
                </button>
                <button
                  type="button"
                  onClick={() => setEditTransportType('depart')}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-center transition-all text-sm font-medium ${
                    editTransportType === 'depart'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Départ
                </button>
              </div>
            </div>

            {/* Chauffeur */}
            <div className="space-y-2">
              <Label>Nom & Prénom du chauffeur</Label>
              <Input
                value={editDriverName}
                onChange={(e) => setEditDriverName(e.target.value)}
                placeholder="Nom, Prénom du chauffeur..."
              />
            </div>

            {/* Date d'échéance */}
            <div className="space-y-2">
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Transporteur</Label>
              <Input
                value={editTransporteur}
                onChange={(e) => setEditTransporteur(e.target.value)}
                placeholder="Nom du transporteur..."
              />
            </div>

            <div className="space-y-2">
              <Label>Immatriculation véhicule</Label>
              <Input
                value={editVehiclePlate}
                onChange={(e) => setEditVehiclePlate(e.target.value)}
                placeholder="Ex: 12345-A-6"
              />
            </div>

            {/* ─── Lignes du BL ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Lignes du BL ({editLines.filter(l => l.productId).length})</Label>
                <Button variant="outline" size="sm" onClick={addEditLine} className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une ligne
                </Button>
              </div>
              <div className="rounded border max-h-[250px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produit</TableHead>
                      <TableHead className="text-right w-[120px]">Qté</TableHead>
                      <TableHead className="text-right w-[100px]">P.U. HT</TableHead>
                      <TableHead className="text-right w-[100px]">TVA %</TableHead>
                      <TableHead className="text-right w-[100px]">Total HT</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editLines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                          Aucune ligne
                        </TableCell>
                      </TableRow>
                    )}
                    {editLines.map((line) => (
                      <TableRow key={line.tempId}>
                        <TableCell>
                          {line.id ? (
                            <span className="text-sm">
                              <span className="font-mono text-muted-foreground mr-1">{line.product?.reference || ''}</span>
                              {line.product?.designation || '—'}
                            </span>
                          ) : (
                            <ProductCombobox
                              products={getEditFilteredProducts(editProducts, editLineSearches[line.tempId] || '')}
                              value={line.productId}
                              onChange={(val) => updateEditLine(line.tempId, 'productId', val)}
                              search={editLineSearches[line.tempId] || ''}
                              onSearchChange={(val) => setEditLineSearches(line.tempId, val)}
                              placeholder="Rechercher un produit..."
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.5}
                            value={line.quantity}
                            onChange={(e) => updateEditLine(line.tempId, 'quantity', parseNum(e.target.value))}
                            className="text-right h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitPrice}
                            onChange={(e) => updateEditLine(line.tempId, 'unitPrice', parseNum(e.target.value))}
                            className="text-right h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={line.tvaRate}
                            onChange={(e) => updateEditLine(line.tempId, 'tvaRate', parseNum(e.target.value))}
                            className="text-right h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(getEditLineTotalHT(line))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeEditLine(line.tempId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              {editLines.some(l => l.productId) && (() => {
                const totals = getEditTotals()
                return (
                  <div className="rounded-lg bg-muted p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-medium">{formatCurrency(totals.totalHT)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-medium">{formatCurrency(totals.totalTVA)}</span></div>
                    <div className="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total TTC</span><span>{formatCurrency(totals.totalTTC)}</span></div>
                  </div>
                )
              })()}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Instructions de livraison..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enregistrement...</> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DETAIL DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent resizable className="sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <Truck className="h-5 w-5" />
              {selectedNote?.number}
              {selectedNote && (
                <Badge variant="secondary" className={statusColors[selectedNote.status]}>
                  {statusLabels[selectedNote.status]}
                </Badge>
              )}
              {selectedNote && !selectedNote.salesOrderId && (
                <Badge variant="outline" className="gap-1 border-dashed text-xs">
                  <Unlink className="h-3 w-3" /> Autonome
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              <PrintHeader />
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">
                    {selectedNote.salesOrderId ? 'Lié à une commande' : 'BL autonome (sans commande)'}
                  </p>
                </div>
                {selectedNote.salesOrderId && (
                  <div>
                    <span className="text-muted-foreground">Commande</span>
                    <p className="font-mono font-medium">{selectedNote.salesOrder?.number}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Client</span>
                  <p className="font-medium">{selectedNote.client.name}</p>
                </div>
                {selectedNote.chantier ? (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <HardHat className="h-3 w-3" /> Chantier
                    </span>
                    <p className="font-medium">{selectedNote.chantier.nomProjet}</p>
                    <p className="text-xs text-muted-foreground">{selectedNote.chantier.adresse}, {selectedNote.chantier.ville}{selectedNote.chantier.codePostal ? ` - ${selectedNote.chantier.codePostal}` : ''}</p>
                    {selectedNote.chantier.responsableNom && (
                      <p className="text-xs text-muted-foreground">Resp. : {selectedNote.chantier.responsableNom}</p>
                    )}
                  </div>
                ) : null}
                {selectedNote.deliveryAddress && !selectedNote.chantier ? (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPinned className="h-3 w-3" /> Adresse de livraison
                    </span>
                    <p className="font-medium whitespace-pre-wrap">{selectedNote.deliveryAddress}</p>
                  </div>
                ) : null}
                <div>
                  <span className="text-muted-foreground">Date de création</span>
                  <p className="font-medium">{format(new Date(selectedNote.date), 'dd/MM/yyyy', { locale: fr })}</p>
                </div>
                {selectedNote.plannedDate && (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Date prévue
                    </span>
                    <p className="font-medium">{format(new Date(selectedNote.plannedDate), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
                {selectedNote.deliveryDate && (
                  <div>
                    <span className="text-muted-foreground">Date de livraison</span>
                    <p className="font-medium">{format(new Date(selectedNote.deliveryDate), 'dd/MM/yyyy', { locale: fr })}</p>
                  </div>
                )}
              </div>

              {selectedNote.transporteur && (
                <div className="rounded-md bg-muted/50 p-3 text-sm grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Transporteur</span>
                    <p className="font-medium">{selectedNote.transporteur}</p>
                  </div>
                  {selectedNote.vehiclePlate && (
                    <div>
                      <span className="text-muted-foreground">Immatriculation</span>
                      <p className="font-medium">{selectedNote.vehiclePlate}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Overall Delivery Progress (for linked orders) ── */}
              {selectedNote.salesOrderId && selectedNote.salesOrder?.lines && selectedNote.salesOrder.lines.length > 0 && (
                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-600" />
                      Avancement de livraison de la commande
                    </h4>
                    {(() => {
                      const pct = getOrderDeliveryPercentage(selectedNote)
                      return pct !== null ? (
                        <span className={`text-xs font-semibold ${pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {pct >= 100 ? 'Commande livrée' : `${pct}% livré`}
                        </span>
                      ) : null
                    })()}
                  </div>
                  {(() => {
                    const pct = getOrderDeliveryPercentage(selectedNote)
                    return pct !== null ? (
                      <Progress value={pct} className="h-3 mb-4" />
                    ) : null
                  })()}

                  <div className="max-h-[200px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Commandé</TableHead>
                          <TableHead className="text-right">Livré</TableHead>
                          <TableHead className="text-right">Restant</TableHead>
                          <TableHead className="text-center w-[140px]">Avancement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedNote.salesOrder.lines.map((soLine) => {
                          const delivered = soLine.quantityDelivered || 0
                          const remaining = Math.max(0, soLine.quantity - delivered)
                          const pct = soLine.quantity > 0 ? Math.round((delivered / soLine.quantity) * 100) : 0
                          return (
                            <TableRow key={soLine.id}>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{soLine.product?.designation}</p>
                                    <p className="text-muted-foreground font-mono">{soLine.product?.reference}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{soLine.quantity}</TableCell>
                              <TableCell className="text-right text-blue-600 font-medium">{delivered}</TableCell>
                              <TableCell className="text-right">
                                <span className={remaining > 0 ? 'text-amber-600 font-semibold' : 'text-green-600'}>
                                  {remaining}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <DeliveryProgressBar percentage={pct} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Lines table */}
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right min-w-[70px]">Qté BL</TableHead>
                      {selectedNote.salesOrderId && (
                        <>
                          <TableHead className="text-right min-w-[70px]">Déjà livré (avant)</TableHead>
                          <TableHead className="text-right min-w-[70px]">Total livré</TableHead>
                          <TableHead className="text-right min-w-[70px]">Reste après</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">P.U. HT</TableHead>
                      <TableHead className="text-right">Total HT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedNote.lines.map((line) => {
                      // For linked orders, compute the "already delivered before this BL" from the SO line
                      const previouslyDelivered = line.salesOrderLine
                        ? Math.max(0, (line.salesOrderLine.quantityDelivered || 0) - line.quantity)
                        : (line.previouslyDelivered || 0)
                      const totalDelivered = line.salesOrderLine
                        ? (line.salesOrderLine.quantityDelivered || 0)
                        : line.quantity
                      const remainingAfter = line.salesOrderLine
                        ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0))
                        : (line.remainingAfterDelivery ?? 0)

                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm">{line.product?.designation || (line.productId ? `ID: ${line.productId.slice(0, 8)}...` : '—')}</p>
                                <p className="text-xs text-muted-foreground font-mono">{line.product?.reference}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{line.quantity}</TableCell>
                          {selectedNote.salesOrderId && (
                            <>
                              <TableCell className="text-right text-sm">
                                {previouslyDelivered > 0 ? (
                                  <span className="text-blue-600">{previouslyDelivered}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <span className="font-medium text-green-700">{totalDelivered}</span>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                <span className={remainingAfter > 0 ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
                                  {remainingAfter}
                                </span>
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(line.totalHT)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalHT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TVA</span>
                    <span className="font-medium">{formatCurrency(selectedNote.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>Total TTC</span>
                    <span>{formatCurrency(selectedNote.totalTTC)}</span>
                  </div>
                </div>
              </div>

              <div className="text-sm italic text-muted-foreground pt-1">
                <span>Arrêté le présent bon de livraison à la somme de :</span>
              </div>
              <div className="text-sm font-medium italic text-right mt-1">
                {numberToFrenchWords(selectedNote.totalTTC || 0)} dirhams
              </div>

              {selectedNote.notes && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{selectedNote.notes}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedNote) return
                    printDocument({
                      title: 'BON DE LIVRAISON',
                      docNumber: selectedNote.number,
                      infoGrid: [
                        { label: 'N° BL', value: selectedNote.number },
                        { label: 'Date du BL', value: fmtDate(selectedNote.date) },
                        ...(selectedNote.salesOrder?.clientOrderNumber ? [{ label: 'N° Cmd Client', value: selectedNote.salesOrder.clientOrderNumber }] : []),
                        ...(selectedNote.salesOrder ? [{ label: 'Commande', value: selectedNote.salesOrder.clientOrderNumber }] : []),
                        { label: 'Date d\'échéance', value: fmtDate(selectedNote.dueDate || '') || '—' },
                        { label: 'Client', value: selectedNote.client.name },
                        { label: 'Adresse de livraison', value: (() => {
                          if (selectedNote.deliveryAddress) return selectedNote.deliveryAddress
                          if (selectedNote.chantier) {
                            const parts = [selectedNote.chantier.nomProjet, selectedNote.chantier.adresse, selectedNote.chantier.ville].filter(Boolean)
                            return parts.join(' - ') || null
                          }
                          if (selectedNote.client?.address) {
                            const parts = [selectedNote.client.address, selectedNote.client.city].filter(Boolean)
                            return parts.join(', ') || null
                          }
                          return null
                        })() || '—', colspan: 2 },
                        ...(selectedNote.chantier && selectedNote.chantier.responsableNom ? [{ label: 'Responsable', value: selectedNote.chantier.responsableNom }] : []),
                        ...(selectedNote.chantier && (selectedNote.chantier.telephone || selectedNote.chantier.gsm) ? [{ label: 'Tél chantier', value: selectedNote.chantier.telephone || selectedNote.chantier.gsm || '—' }] : []),
                        { label: 'Chauffeur', value: selectedNote.driverName || '—' },
                        { label: 'Matricule véhicule', value: selectedNote.vehiclePlate || '—' },
                        { label: 'Type transport', value: selectedNote.transportType === 'rendu' ? 'Rendu' : selectedNote.transportType === 'depart' ? 'Départ' : '—' },
                        { label: 'Transporteur', value: selectedNote.transporteur || '—' },
                        { label: 'Responsable BL', value: selectedNote.createdByName || '—' },
                      ],
                      columns: [
                        { label: 'Produit' },
                        { label: 'Qté', align: 'right' },
                        { label: 'Qté livrée', align: 'right' },
                        { label: 'Reste', align: 'right' },
                        { label: 'P.U. HT', align: 'right' },
                        { label: 'Total HT', align: 'right' },
                      ],
                      rows: selectedNote.lines.map(line => {
                        const totalDelivered = line.salesOrderLine ? (line.salesOrderLine.quantityDelivered || 0) : line.quantity
                        const remaining = line.salesOrderLine ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0)) : (line.remainingAfterDelivery ?? 0)
                        return [
                          { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
                          { value: line.quantity, align: 'right' },
                          { value: totalDelivered, align: 'right' },
                          { value: remaining, align: 'right' },
                          { value: fmtMoney(line.unitPrice), align: 'right' },
                          { value: fmtMoney(line.totalHT), align: 'right' },
                        ]
                      }),
                      totals: [
                        { label: 'Total HT', value: fmtMoney(selectedNote.totalHT) },
                        { label: 'TVA', value: fmtMoney(selectedNote.totalTVA) },
                        { label: 'Total TTC', value: fmtMoney(selectedNote.totalTTC), bold: true },
                      ],
                      subSections: buildVisaHtml(selectedNote.notes),
                      amountInWords: numberToFrenchWords(selectedNote.totalTTC || 0) + ' dirhams',
                      amountInWordsLabel: 'Arrêté le présent bon de livraison à la somme de',
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimer
                </Button>
                {selectedNote.status === 'draft' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEditDialog(selectedNote) }}>
                      <Pencil className="h-4 w-4 mr-1" /> Modifier
                    </Button>
                    <Button size="sm" onClick={() => { setDetailOpen(false); handleConfirm(selectedNote) }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Confirmer
                    </Button>
                  </>
                )}
                {(selectedNote.status === 'draft' || selectedNote.status === 'confirmed') && (
                  <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); handleCancel(selectedNote.id) }}>
                    <XCircle className="h-4 w-4 mr-1" /> Annuler
                  </Button>
                )}
                {selectedNote.status === 'confirmed' && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setDetailOpen(false); handleDeliver(selectedNote) }}>
                    <Truck className="h-4 w-4 mr-1" /> Marquer livré
                  </Button>
                )}
                {isSuperAdmin && (selectedNote.status === 'draft' || selectedNote.status === 'cancelled') && (
                  <Button size="sm" variant="destructive" onClick={() => { setDetailOpen(false); confirmDelete(selectedNote.id) }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DELETE DIALOG                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le bon de livraison</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce bon de livraison ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
