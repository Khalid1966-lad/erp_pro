'use client'

import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { printDocument, fmtMoney, fmtDate, type PrintOptions } from '@/lib/print-utils'
import { numberToFrenchWords } from '@/lib/number-to-words'
import { Loader2, Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'

// ─── Document type definitions ─────────────────────────────────

interface ProductLine {
  id: string
  product?: { reference?: string | null; designation?: string | null } | null
  quantity: number
  unitPrice: number
  tvaRate: number
  totalHT: number
  discount?: number | null
  quantityPrepared?: number | null
  salesOrderLine?: { quantity: number; quantityDelivered?: number | null } | null
}

interface BaseDoc {
  id: string
  number: string
  date: string
  status: string
  totalHT: number
  totalTVA: number
  totalTTC: number
  notes?: string | null
  lines: ProductLine[]
}

interface QuoteDoc extends BaseDoc {
  type: 'quote'
  client: { name: string; ice?: string | null }
  validUntil?: string | null
  discountRate: number
  shippingCost: number
}

interface OrderDoc extends BaseDoc {
  type: 'order'
  client: { name: string; ice?: string | null }
  quote?: { number: string } | null
  deliveryDate?: string | null
}

interface DeliveryNoteDoc extends BaseDoc {
  type: 'deliveryNote'
  client: { name: string; ice?: string | null }
  salesOrder?: { number: string } | null
  deliveryDate?: string | null
  transporteur?: string | null
}

interface InvoiceDoc extends BaseDoc {
  type: 'invoice'
  client: { name: string; ice?: string | null }
  salesOrder?: { number: string } | null
  dueDate: string
  paymentDate?: string | null
  discountRate: number
  shippingCost: number
  payments?: Array<{ id: string; amount: number; method: string; reference?: string | null; date: string }>
  creditNotes?: Array<{ id: string; number: string; totalTTC: number }>
}

interface CreditNoteDoc extends BaseDoc {
  type: 'creditNote'
  client: { name: string; ice?: string | null }
  invoice?: { number: string } | null
  reason?: string | null
}

type DocType = 'quote' | 'order' | 'deliveryNote' | 'invoice' | 'creditNote'
type FullDoc = QuoteDoc | OrderDoc | DeliveryNoteDoc | InvoiceDoc | CreditNoteDoc

// ─── Config ───────────────────────────────────────────────────

const DOC_CONFIG: Record<DocType, { title: string; apiBase: string; label: string }> = {
  quote: { title: 'DEVIS', apiBase: '/quotes', label: 'Devis' },
  order: { title: 'BON DE COMMANDE', apiBase: '/sales-orders', label: 'Commande' },
  deliveryNote: { title: 'BON DE LIVRAISON', apiBase: '/delivery-notes', label: 'Bon de Livraison' },
  invoice: { title: 'FACTURE', apiBase: '/invoices', label: 'Facture' },
  creditNote: { title: 'AVOIR', apiBase: '/credit-notes', label: 'Avoir' },
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  validated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  sent: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  applied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_preparation: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  prepared: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  partially_delivered: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

// ─── Component ────────────────────────────────────────────────

interface DocDetailDialogProps {
  docType: DocType
  docId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocDetailDialog({ docType, docId, open, onOpenChange }: DocDetailDialogProps) {
  const [doc, setDoc] = useState<FullDoc | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDoc = useCallback(async () => {
    if (!docId) return
    const config = DOC_CONFIG[docType]
    setLoading(true)
    try {
      const data = await api.get<FullDoc>(`${config.apiBase}/${docId}`)
      setDoc(data)
    } catch {
      setDoc(null)
    } finally {
      setLoading(false)
    }
  }, [docType, docId])

  // Fetch when dialog opens with a new doc
  const prevKeyRef = useRef<string | null>(null)
  const currentKey = `${docType}:${docId}`
  if (open && docId && prevKeyRef.current !== currentKey) {
    prevKeyRef.current = currentKey
    // Intentionally fire fetch synchronously during render to satisfy linter
    void fetchDoc()
  }
  if (!open && prevKeyRef.current !== null) {
    prevKeyRef.current = null
    setDoc(null)
    setLoading(false)
  }

  const buildPrintOptions = (): PrintOptions | null => {
    if (!doc) return null
    const config = DOC_CONFIG[docType]

    switch (docType) {
      case 'quote': {
        const d = doc as QuoteDoc
        return {
          title: config.title,
          docNumber: d.number,
          infoGrid: [
            { label: 'Client', value: d.client.name },
            { label: 'Date', value: fmtDate(d.date) },
            { label: 'Validité', value: fmtDate(d.validUntil || '') },
            { label: 'Remise', value: `${d.discountRate}%` },
          ],
          columns: [
            { label: 'Produit' },
            { label: 'Qté', align: 'right' },
            { label: 'P.U. HT', align: 'right' },
            { label: 'Remise', align: 'right' },
            { label: 'Total HT', align: 'right' },
          ],
          rows: d.lines.map(l => [
            { value: `${l.product?.reference || ''} - ${l.product?.designation || ''}` },
            { value: l.quantity, align: 'right' },
            { value: fmtMoney(l.unitPrice), align: 'right' },
            { value: `${l.discount || 0}%`, align: 'right' },
            { value: fmtMoney(l.totalHT || 0), align: 'right' },
          ]),
          totals: [
            ...(d.shippingCost > 0 ? [{ label: 'Frais de port', value: fmtMoney(d.shippingCost) }] : []),
            { label: 'Total HT', value: fmtMoney(d.totalHT) },
            { label: 'TVA', value: fmtMoney(d.totalTVA) },
            { label: 'Total TTC', value: fmtMoney(d.totalTTC), bold: true },
          ],
          notes: d.notes || undefined,
          amountInWords: `${numberToFrenchWords(d.totalTTC || 0)} dirhams`,
          amountInWordsLabel: 'Arrêté le présent devis à la somme de',
        }
      }

      case 'order': {
        const d = doc as OrderDoc
        return {
          title: config.title,
          docNumber: d.number,
          infoGrid: [
            { label: 'Client', value: d.client.name },
            { label: 'Date', value: fmtDate(d.date) },
            { label: 'Livraison', value: fmtDate(d.deliveryDate || '') },
            { label: 'Nb lignes', value: String(d.lines.length) },
          ],
          columns: [
            { label: 'Produit' },
            { label: 'Qté', align: 'right' },
            { label: 'Qté préparée', align: 'right' },
            { label: 'P.U. HT', align: 'right' },
            { label: 'Total HT', align: 'right' },
          ],
          rows: d.lines.map(l => [
            { value: `${l.product?.reference || ''} - ${l.product?.designation || ''}` },
            { value: l.quantity, align: 'right' },
            { value: l.quantityPrepared || 0, align: 'right' },
            { value: fmtMoney(l.unitPrice), align: 'right' },
            { value: fmtMoney(l.totalHT || (l.quantity * l.unitPrice)), align: 'right' },
          ]),
          totals: [
            { label: 'Total HT', value: fmtMoney(d.totalHT) },
            { label: 'TVA', value: fmtMoney(d.totalTVA) },
            { label: 'Total TTC', value: fmtMoney(d.totalTTC), bold: true },
          ],
          notes: d.notes || undefined,
          amountInWords: numberToFrenchWords(d.totalTTC || 0) + ' dirhams',
          amountInWordsLabel: 'Arrêté le présent bon de commande à la somme de',
        }
      }

      case 'deliveryNote': {
        const d = doc as DeliveryNoteDoc
        return {
          title: config.title,
          docNumber: d.number,
          infoGrid: [
            { label: 'Client', value: d.client.name },
            { label: 'Date création', value: fmtDate(d.date) },
            { label: 'Date livraison', value: fmtDate(d.deliveryDate || '') },
            { label: 'Transporteur', value: d.transporteur || '—' },
          ],
          columns: [
            { label: 'Produit' },
            { label: 'Qté', align: 'right' },
            { label: 'Qté livrée', align: 'right' },
            { label: 'Reste', align: 'right' },
            { label: 'P.U. HT', align: 'right' },
            { label: 'Total HT', align: 'right' },
          ],
          rows: d.lines.map(line => {
            const totalDelivered = line.salesOrderLine ? (line.salesOrderLine.quantityDelivered || 0) : line.quantity
            const remaining = line.salesOrderLine ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0)) : 0
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
            { label: 'Total HT', value: fmtMoney(d.totalHT) },
            { label: 'TVA', value: fmtMoney(d.totalTVA) },
            { label: 'Total TTC', value: fmtMoney(d.totalTTC), bold: true },
          ],
          notes: d.notes || undefined,
          amountInWords: numberToFrenchWords(d.totalTTC || 0) + ' dirhams',
          amountInWordsLabel: 'Arrêté le présent bon de livraison à la somme de',
        }
      }

      case 'invoice': {
        const d = doc as InvoiceDoc
        const discountAmount = d.totalHT * (d.discountRate / 100)
        return {
          title: config.title,
          docNumber: d.number,
          infoGrid: [
            { label: 'Client', value: d.client.name },
            { label: 'Date', value: fmtDate(d.date) },
            { label: 'Échéance', value: fmtDate(d.dueDate) },
            { label: 'Paiement', value: d.paymentDate ? fmtDate(d.paymentDate) : d.status },
          ],
          columns: [
            { label: 'Produit' },
            { label: 'Qté', align: 'right' },
            { label: 'P.U. HT', align: 'right' },
            { label: 'Remise', align: 'right' },
            { label: 'Total HT', align: 'right' },
          ],
          rows: d.lines.map(line => [
            { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
            { value: line.quantity, align: 'right' },
            { value: fmtMoney(line.unitPrice), align: 'right' },
            { value: '0%', align: 'right' },
            { value: fmtMoney(line.totalHT || 0), align: 'right' },
          ]),
          totals: [
            ...(d.discountRate > 0 ? [{ label: `Remise (${d.discountRate}%)`, value: `-${fmtMoney(discountAmount)}` }] : []),
            ...(d.shippingCost > 0 ? [{ label: 'Frais de port', value: fmtMoney(d.shippingCost) }] : []),
            { label: 'Total HT', value: fmtMoney(d.totalHT) },
            { label: 'TVA', value: fmtMoney(d.totalTVA) },
            { label: 'Total TTC', value: fmtMoney(d.totalTTC), bold: true },
          ],
          notes: d.notes || undefined,
          amountInWords: numberToFrenchWords(d.totalTTC || 0) + ' dirhams',
          amountInWordsLabel: 'Arrêté la présente facture à la somme de',
        }
      }

      case 'creditNote': {
        const d = doc as CreditNoteDoc
        return {
          title: config.title,
          docNumber: d.number,
          infoGrid: [
            { label: 'Client', value: d.client.name },
            { label: 'Facture', value: d.invoice?.number || '—' },
            { label: 'Date', value: fmtDate(d.date) },
            { label: 'Motif', value: d.reason || '—' },
          ],
          columns: [
            { label: 'Produit' },
            { label: 'Qté', align: 'right' },
            { label: 'P.U. HT', align: 'right' },
            { label: 'TVA%', align: 'right' },
            { label: 'Total HT', align: 'right' },
          ],
          rows: d.lines.map(line => [
            { value: `${line.product?.reference || ''} - ${line.product?.designation || ''}` },
            { value: line.quantity, align: 'right' },
            { value: fmtMoney(line.unitPrice), align: 'right' },
            { value: `${line.tvaRate}%`, align: 'right' },
            { value: fmtMoney(line.totalHT || 0), align: 'right' },
          ]),
          totals: [
            { label: 'Total HT', value: `-${fmtMoney(d.totalHT)}`, negative: true },
            { label: 'TVA', value: `-${fmtMoney(d.totalTVA)}`, negative: true },
            { label: 'Total TTC', value: `-${fmtMoney(d.totalTTC)}`, bold: true, negative: true },
          ],
          notes: d.notes || undefined,
          negativeTotals: true,
          amountInWords: numberToFrenchWords(d.totalTTC || 0) + ' dirhams',
          amountInWordsLabel: 'Arrêté le présent avoir à la somme de',
        }
      }
    }
    return null
  }

  const handlePrint = () => {
    const opts = buildPrintOptions()
    if (opts) printDocument(opts)
  }

  const config = doc ? DOC_CONFIG[doc.type] : null
  const statusColor = doc ? STATUS_COLORS[doc.status] || '' : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" resizable>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {config?.label || ''}
            {doc && (
              <Badge variant="outline" className={`text-xs ${statusColor}`}>
                {doc.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? 'Chargement du document...'
              : doc
                ? `${config?.title} N° ${doc.number}`
                : 'Document introuvable'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Chargement...</span>
          </div>
        ) : doc ? (
          <div className="space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {doc.type === 'quote' && (
                <>
                  <InfoItem label="Client" value={(doc as QuoteDoc).client.name} />
                  <InfoItem label="Date" value={fmtDate(doc.date)} />
                  <InfoItem label="Validité" value={fmtDate((doc as QuoteDoc).validUntil || '')} />
                  <InfoItem label="Remise" value={`${(doc as QuoteDoc).discountRate}%`} />
                </>
              )}
              {doc.type === 'order' && (
                <>
                  <InfoItem label="Client" value={(doc as OrderDoc).client.name} />
                  <InfoItem label="Date" value={fmtDate(doc.date)} />
                  <InfoItem label="Livraison" value={fmtDate((doc as OrderDoc).deliveryDate || '')} />
                  <InfoItem label="Devis lié" value={(doc as OrderDoc).quote?.number || '—'} />
                </>
              )}
              {doc.type === 'deliveryNote' && (
                <>
                  <InfoItem label="Client" value={(doc as DeliveryNoteDoc).client.name} />
                  <InfoItem label="Date" value={fmtDate(doc.date)} />
                  <InfoItem label="Livraison" value={fmtDate((doc as DeliveryNoteDoc).deliveryDate || '')} />
                  <InfoItem label="Transporteur" value={(doc as DeliveryNoteDoc).transporteur || '—'} />
                </>
              )}
              {doc.type === 'invoice' && (
                <>
                  <InfoItem label="Client" value={(doc as InvoiceDoc).client.name} />
                  <InfoItem label="Date" value={fmtDate(doc.date)} />
                  <InfoItem label="Échéance" value={fmtDate((doc as InvoiceDoc).dueDate)} />
                  <InfoItem label="Paiement" value={(doc as InvoiceDoc).paymentDate ? fmtDate((doc as InvoiceDoc).paymentDate!) : doc.status} />
                </>
              )}
              {doc.type === 'creditNote' && (
                <>
                  <InfoItem label="Client" value={(doc as CreditNoteDoc).client.name} />
                  <InfoItem label="Facture" value={(doc as CreditNoteDoc).invoice?.number || '—'} />
                  <InfoItem label="Date" value={fmtDate(doc.date)} />
                  <InfoItem label="Motif" value={(doc as CreditNoteDoc).reason || '—'} />
                </>
              )}
            </div>

            <Separator />

            {/* Lines table */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produit</TableHead>
                    <TableHead className="text-xs text-right">Qté</TableHead>
                    {doc.type === 'deliveryNote' && (
                      <>
                        <TableHead className="text-xs text-right">Qté livrée</TableHead>
                        <TableHead className="text-xs text-right">Reste</TableHead>
                      </>
                    )}
                    {doc.type === 'order' && (
                      <TableHead className="text-xs text-right">Préparée</TableHead>
                    )}
                    <TableHead className="text-xs text-right">P.U. HT</TableHead>
                    {(doc.type === 'creditNote') && (
                      <TableHead className="text-xs text-right">TVA%</TableHead>
                    )}
                    {(doc.type === 'quote' || doc.type === 'invoice') && (
                      <TableHead className="text-xs text-right">Remise</TableHead>
                    )}
                    <TableHead className="text-xs text-right">Total HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-xs">
                        <span className="font-mono text-muted-foreground">{line.product?.reference || ''}</span>
                        <br />
                        <span className="font-medium">{line.product?.designation || ''}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">{line.quantity}</TableCell>
                      {doc.type === 'deliveryNote' && (
                        <>
                          <TableCell className="text-xs text-right">
                            {line.salesOrderLine ? (line.salesOrderLine.quantityDelivered || 0) : line.quantity}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {line.salesOrderLine
                              ? Math.max(0, line.salesOrderLine.quantity - (line.salesOrderLine.quantityDelivered || 0))
                              : 0}
                          </TableCell>
                        </>
                      )}
                      {doc.type === 'order' && (
                        <TableCell className="text-xs text-right">{line.quantityPrepared || 0}</TableCell>
                      )}
                      <TableCell className="text-xs text-right">{fmtMoney(line.unitPrice)}</TableCell>
                      {doc.type === 'creditNote' && (
                        <TableCell className="text-xs text-right">{line.tvaRate}%</TableCell>
                      )}
                      {(doc.type === 'quote' || doc.type === 'invoice') && (
                        <TableCell className="text-xs text-right">{line.discount || 0}%</TableCell>
                      )}
                      <TableCell className="text-xs text-right font-medium">{fmtMoney(line.totalHT || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1">
                {doc.type === 'invoice' && (doc as InvoiceDoc).discountRate > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Remise ({(doc as InvoiceDoc).discountRate}%)</span>
                    <span>-{fmtMoney(doc.totalHT * (doc as InvoiceDoc).discountRate / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Total HT</span>
                  <span className={doc.type === 'creditNote' ? 'text-red-600' : ''}>{doc.type === 'creditNote' ? '-' : ''}{fmtMoney(doc.totalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TVA</span>
                  <span className={doc.type === 'creditNote' ? 'text-red-600' : ''}>{doc.type === 'creditNote' ? '-' : ''}{fmtMoney(doc.totalTVA)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span>Total TTC</span>
                  <span className={doc.type === 'creditNote' ? 'text-red-700' : 'text-primary'}>
                    {doc.type === 'creditNote' ? '-' : ''}{fmtMoney(doc.totalTTC)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount in words */}
            <div className="text-xs text-muted-foreground italic text-right">
              Arrêté le présent {config?.label?.toLowerCase() || 'document'} à la somme de :{' '}
              <span className="font-medium text-foreground">
                {numberToFrenchWords(doc.totalTTC || 0)} dirhams
              </span>
            </div>

            {/* Notes */}
            {doc.notes && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-xs">{doc.notes}</p>
              </div>
            )}

            {/* Payments info for invoices */}
            {doc.type === 'invoice' && (doc as InvoiceDoc).payments && (doc as InvoiceDoc).payments!.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Règlements associés</p>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableBody>
                      {(doc as InvoiceDoc).payments!.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{fmtDate(p.date)}</TableCell>
                          <TableCell className="text-xs">{p.reference || '—'}</TableCell>
                          <TableCell className="text-xs">{p.method}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-green-600">{fmtMoney(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <X className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Document introuvable</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!doc || loading}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-component ────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium truncate">{value || '—'}</p>
    </div>
  )
}
