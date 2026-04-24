'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Building2, Star,
  FileText, ShoppingCart, Warehouse, RotateCcw, ArrowLeftRight, Receipt, Package,
  Inbox,
} from 'lucide-react'

// ───────────────────── Types ─────────────────────
interface SupplierDetailProps {
  supplier: {
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
    notes: string | null
  }
  onBack: () => void
  onEdit: () => void
  onDelete: (id: string) => void
}

// ── Document types for mini-tables ──
interface QuoteRow { id: string; number: string; date: string; status: string; totalTTC: number }
interface OrderRow { id: string; number: string; date: string; status: string; totalTTC: number }
interface ReceptionRow { id: string; number: string; date: string; lines?: Array<{ qualityCheck: string }> }
interface ReturnRow { id: string; number: string; date: string; status: string; totalTTC: number }
interface CreditNoteRow { id: string; number: string; date: string; status: string; totalTTC: number }
interface InvoiceRow { id: string; number: string; date: string; status: string; totalTTC: number; amountPaid: number }

// ───────────────────── Helpers ─────────────────────
function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

// ── Status configs per document type ──
const quoteStatusConfig: Record<string, { label: string; className: string }> = {
  received:  { label: 'Reçu',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  accepted:  { label: 'Accepté', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  rejected:  { label: 'Rejeté',  className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  expired:   { label: 'Expiré',  className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
}

const orderStatusConfig: Record<string, { label: string; className: string }> = {
  draft:               { label: 'Brouillon',             className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent:                { label: 'Envoyée',               className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  partially_received:  { label: 'Partiellement reçue',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  received:            { label: 'Reçue',                 className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled:           { label: 'Annulée',               className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const qualityConfig: Record<string, { label: string; className: string }> = {
  conforme:      { label: 'Conforme',      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  non_conforme:  { label: 'Non conforme',  className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  partiel:       { label: 'Partiel',       className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
}

const returnStatusConfig: Record<string, { label: string; className: string }> = {
  draft:              { label: 'Brouillon',             className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  sent:               { label: 'Envoyé',                className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  received_by_supplier:{ label: 'Reçu par fournisseur', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  credited:           { label: 'Avoir émis',            className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cancelled:          { label: 'Annulé',                className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const creditNoteStatusConfig: Record<string, { label: string; className: string }> = {
  received:           { label: 'Reçu',                  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  applied:            { label: 'Appliqué',              className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  partially_applied:  { label: 'Partiellement appliqué', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  cancelled:          { label: 'Annulé',                className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  received:        { label: 'Reçue',               className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  verified:        { label: 'Vérifiée',             className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  paid:            { label: 'Payée',               className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  partially_paid:  { label: 'Partiellement payée', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  overdue:         { label: 'En retard',            className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled:       { label: 'Annulée',              className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

function StatusBadge({ status, config }: { status: string; config: Record<string, { label: string; className: string }> }) {
  const cfg = config[status]
  if (!cfg) return <Badge variant="outline">{status}</Badge>
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

// ── Info Row ──
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  )
}

// ── Empty State ──
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Tab Skeleton ──
function TabSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-28" />
          <div className="flex-1" />
        </div>
      ))}
    </div>
  )
}

// ── Tab Table Wrapper ──
function TabCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Custom hook for fetching tab data ──
function useTabData<T>(endpoint: string, field: string, supplierId: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      try {
        setLoading(true)
        const res = await api.get<Record<string, unknown>>(`${endpoint}?supplierId=${supplierId}`)
        if (!cancelled) {
          setData((res[field] as T[]) || [])
        }
      } catch {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [endpoint, field, supplierId])

  return { data, loading }
}

// ═══════════════════════════════════════════════════════════════
//  SUPPLIER DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
export default function SupplierDetailView({ supplier, onBack, onEdit, onDelete }: SupplierDetailProps) {
  // Tab data
  const quotes = useTabData<QuoteRow>('/supplier-quotes', 'supplierQuotes', supplier.id)
  const orders = useTabData<OrderRow>('/purchase-orders', 'orders', supplier.id)
  const receptions = useTabData<ReceptionRow>('/receptions', 'receptions', supplier.id)
  const returns = useTabData<ReturnRow>('/supplier-returns', 'supplierReturns', supplier.id)
  const creditNotes = useTabData<CreditNoteRow>('/supplier-credit-notes', 'supplierCreditNotes', supplier.id)
  const invoices = useTabData<InvoiceRow>('/supplier-invoices', 'supplierInvoices', supplier.id)

  const fullAddress = [supplier.address, supplier.city, supplier.postalCode, supplier.country]
    .filter(Boolean)
    .join(', ')

  // Determine overall quality for reception row
  function getReceptionQuality(row: ReceptionRow) {
    if (!row.lines || row.lines.length === 0) return 'conforme'
    const hasNonConforme = row.lines.some((l) => l.qualityCheck === 'non_conforme')
    const allConforme = row.lines.every((l) => l.qualityCheck === 'conforme')
    if (hasNonConforme) return 'non_conforme'
    if (allConforme) return 'conforme'
    return 'partiel'
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{supplier.name}</h2>
              <Badge variant="outline" className="font-mono text-xs">{supplier.code}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Fiche fournisseur</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer <strong>{supplier.name}</strong> ?
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(supplier.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm font-medium truncate">{supplier.phone || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{supplier.email || '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-50 text-orange-600 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Adresse</p>
              <p className="text-sm font-medium truncate">{fullAddress || '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="text-xs sm:text-sm">
            <Building2 className="h-4 w-4 mr-1 hidden sm:inline" />
            Informations
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
            Devis Fournisseurs
            {quotes.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{quotes.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm">
            <ShoppingCart className="h-4 w-4 mr-1 hidden sm:inline" />
            Commandes
            {orders.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{orders.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="receptions" className="text-xs sm:text-sm">
            <Warehouse className="h-4 w-4 mr-1 hidden sm:inline" />
            Réceptions
            {receptions.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{receptions.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="returns" className="text-xs sm:text-sm">
            <RotateCcw className="h-4 w-4 mr-1 hidden sm:inline" />
            Bons de Retour
            {returns.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{returns.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="credit-notes" className="text-xs sm:text-sm">
            <ArrowLeftRight className="h-4 w-4 mr-1 hidden sm:inline" />
            Avoirs
            {creditNotes.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{creditNotes.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs sm:text-sm">
            <Receipt className="h-4 w-4 mr-1 hidden sm:inline" />
            Factures
            {invoices.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{invoices.data.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Informations ── */}
        <TabsContent value="info">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Code" value={supplier.code} />
                  <InfoRow label="Raison sociale" value={supplier.name} />
                  <InfoRow label="SIRET" value={supplier.siret} />
                  <InfoRow label="Email" value={supplier.email} />
                  <InfoRow label="Téléphone" value={supplier.phone} />
                  <InfoRow label="Adresse" value={supplier.address} />
                </div>
                <div>
                  <InfoRow label="Ville" value={supplier.city} />
                  <InfoRow label="Code postal" value={supplier.postalCode} />
                  <InfoRow label="Pays" value={supplier.country} />
                  <InfoRow label="Délai de livraison" value={`${supplier.deliveryDelay} jours`} />
                  <InfoRow label="Conditions de paiement" value={supplier.paymentTerms} />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
                    <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">Note</span>
                    <Stars rating={supplier.rating} />
                  </div>
                  <InfoRow label="Notes" value={supplier.notes} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Devis Fournisseurs ── */}
        <TabsContent value="quotes">
          {quotes.loading ? (
            <TabSkeleton />
          ) : quotes.data.length === 0 ? (
            <EmptyState icon={FileText} message="Aucun devis fournisseur pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.data.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium font-mono text-sm">{q.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(q.date)}</TableCell>
                      <TableCell><StatusBadge status={q.status} config={quoteStatusConfig} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(q.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>

        {/* ── Tab: Commandes Fournisseurs ── */}
        <TabsContent value="orders">
          {orders.loading ? (
            <TabSkeleton />
          ) : orders.data.length === 0 ? (
            <EmptyState icon={ShoppingCart} message="Aucune commande fournisseur pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium font-mono text-sm">{o.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(o.date)}</TableCell>
                      <TableCell><StatusBadge status={o.status} config={orderStatusConfig} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(o.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>

        {/* ── Tab: Réceptions ── */}
        <TabsContent value="receptions">
          {receptions.loading ? (
            <TabSkeleton />
          ) : receptions.data.length === 0 ? (
            <EmptyState icon={Warehouse} message="Aucune réception pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Contrôle qualité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receptions.data.map((r) => {
                    const quality = getReceptionQuality(r)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium font-mono text-sm">{r.number}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{fmtDate(r.date)}</TableCell>
                        <TableCell>
                          <StatusBadge status={quality} config={qualityConfig} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>

        {/* ── Tab: Bons de Retour ── */}
        <TabsContent value="returns">
          {returns.loading ? (
            <TabSkeleton />
          ) : returns.data.length === 0 ? (
            <EmptyState icon={RotateCcw} message="Aucun bon de retour pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium font-mono text-sm">{r.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(r.date)}</TableCell>
                      <TableCell><StatusBadge status={r.status} config={returnStatusConfig} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(r.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>

        {/* ── Tab: Avoirs Fournisseurs ── */}
        <TabsContent value="credit-notes">
          {creditNotes.loading ? (
            <TabSkeleton />
          ) : creditNotes.data.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} message="Aucun avoir fournisseur pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.data.map((cn) => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-medium font-mono text-sm">{cn.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(cn.date)}</TableCell>
                      <TableCell><StatusBadge status={cn.status} config={creditNoteStatusConfig} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(cn.totalTTC)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>

        {/* ── Tab: Factures Fournisseurs ── */}
        <TabsContent value="invoices">
          {invoices.loading ? (
            <TabSkeleton />
          ) : invoices.data.length === 0 ? (
            <EmptyState icon={Receipt} message="Aucune facture fournisseur pour ce fournisseur" />
          ) : (
            <TabCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Payé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium font-mono text-sm">{inv.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{fmtDate(inv.date)}</TableCell>
                      <TableCell><StatusBadge status={inv.status} config={invoiceStatusConfig} /></TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(inv.totalTTC)}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <span className={inv.amountPaid > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                          {fmtMoney(inv.amountPaid)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
