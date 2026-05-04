'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  ArrowLeft, CheckCircle2, XCircle, Trophy, Star, Printer, ShoppingCart,
  Truck, Clock, PackageCheck, TrendingDown, Shield, CreditCard, BarChart3,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavStore } from '@/lib/stores'
import { printDocument, fmtMoney as fmtMoneyP, fmtDate as fmtDateP } from '@/lib/print-utils'

// ── Types ──────────────────────────────────────────────

interface ComparisonProduct {
  id: string
  reference: string
  designation: string
}

interface QuotePrice {
  quoteId: string
  quoteNumber: string
  supplierId: string
  supplierName: string
  supplierRating: number
  unitPrice: number | null
  quantity: number
  tvaRate: number
  totalHT: number
  availability: string | null
  deliveryDelay: number | null
  discount: number | null
  hasProduct: boolean
}

interface ProductComparison {
  productId: string
  product: ComparisonProduct | null
  targetPrice: number | null
  maxPrice: number | null
  requestedQty: number
  quotePrices: QuotePrice[]
  bestPrice: number | null
  bestQuoteId: string | null
}

interface QuoteScores {
  price: number
  delivery: number
  coverage: number
  rating: number
  payment: number
  total: number
}

interface QuoteScore {
  quoteId: string
  quoteNumber: string
  supplierId: string
  supplierName: string
  supplierCode: string
  supplierRating: number
  status: string
  deliveryDelay: number
  deliveryFrequency: string | null
  paymentTerms: string
  validUntil: string | null
  totalHT: number
  totalTVA: number
  totalTTC: number
  selectedForPO: boolean
  coveredProducts: number
  totalProducts: number
  unmatchedProductIds: string[]
  scores: QuoteScores
}

interface ComparisonData {
  priceRequest: {
    id: string
    number: string
    title: string
    status: string
    validUntil: string | null
    notes: string | null
    createdAt: string
  }
  productComparison: ProductComparison[]
  quoteScores: QuoteScore[]
  winner: QuoteScore | null
}

// ── Helpers ────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(new Date(d), 'dd/MM/yyyy', { locale: fr })
}

function fmtMoney(n: number) {
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })
}

function renderStars(rating: number) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={cn('h-3.5 w-3.5', i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300')}
      />
    )
  }
  return <span className="inline-flex gap-0.5">{stars}</span>
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-semibold', color)}>{value}/100</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color === 'text-green-600' ? 'bg-green-500' : color === 'text-amber-600' ? 'bg-amber-500' : color === 'text-red-600' ? 'bg-red-500' : 'bg-blue-500')} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function AvailabilityBadge({ availability }: { availability: string | null }) {
  if (!availability) return <span className="text-xs text-muted-foreground">—</span>
  const isAvailable = availability.toLowerCase().includes('stock') || availability.toLowerCase().includes('dispo') || availability.toLowerCase().includes('immédiat')
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', isAvailable ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
      {availability}
    </Badge>
  )
}

// ── Component ──────────────────────────────────────────

interface PriceComparisonViewProps {
  priceRequestId: string
}

export default function PriceComparisonView({ priceRequestId }: PriceComparisonViewProps) {
  const { setCurrentView } = useNavStore()
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [transforming, setTransforming] = useState(false)
  const [selectingQuote, setSelectingQuote] = useState<string | null>(null)

  const fetchComparison = useCallback(async () => {
    try {
      setLoading(true)
      const result = await api.get<ComparisonData>(`/price-requests/${priceRequestId}/comparison`)
      setData(result)
      // Auto-select winner
      if (result.winner) {
        setSelectedQuoteId(result.winner.quoteId)
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement du comparateur')
    } finally {
      setLoading(false)
    }
  }, [priceRequestId])

  useEffect(() => { fetchComparison() }, [fetchComparison])

  const handleSelectQuote = async (quoteId: string) => {
    try {
      setSelectingQuote(quoteId)
      await api.put('/supplier-quotes', { id: quoteId, selectedForPO: true })
      toast.success('Fournisseur sélectionné')
      fetchComparison()
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sélection')
    } finally {
      setSelectingQuote(null)
    }
  }

  const handleTransformToPO = async () => {
    if (!selectedQuoteId) return
    try {
      setTransforming(true)
      const result = await api.post(`/supplier-quotes/${selectedQuoteId}/transform`, {})
      toast.success(`Commande ${result.number} créée avec succès depuis le devis`)
      setCurrentView('purchase-orders')
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la transformation')
    } finally {
      setTransforming(false)
    }
  }

  const handlePrint = () => {
    if (!data) return
    const pr = data.priceRequest
    const quotes = data.quoteScores

    // Build supplier columns
    const columns: Array<{ label: string; align?: string }> = [
      { label: 'Produit' },
      { label: 'Qté', align: 'right' },
    ]
    if (pr.notes) {
      columns.push({ label: 'Prix cible', align: 'right' })
    }
    for (const q of quotes) {
      columns.push({ label: q.supplierName, align: 'right' })
    }

    // Build rows
    const rows = data.productComparison.map((pc) => {
      const row: Array<{ value: string | number; align?: string; bold?: boolean }> = [
        { value: `${pc.product?.reference || '—'} — ${pc.product?.designation || ''}` },
        { value: pc.requestedQty, align: 'right' },
      ]
      if (pr.notes) {
        row.push({ value: pc.targetPrice ? fmtMoneyP(pc.targetPrice) : '—', align: 'right' })
      }
      for (const q of quotes) {
        const qp = pc.quotePrices.find((p) => p.quoteId === q.quoteId)
        if (qp && qp.hasProduct) {
          const isBest = qp.quoteId === pc.bestQuoteId
          row.push({ value: `${fmtMoneyP(qp.unitPrice || 0)}${isBest ? ' ✓' : ''}`, align: 'right', bold: isBest })
        } else {
          row.push({ value: 'N/D', align: 'right' })
        }
      }
      return row
    })

    // Totals row
    const totalsRow: Array<{ value: string | number; align?: string; bold?: boolean }> = [
      { value: 'TOTAL', bold: true },
      { value: '', align: 'right' },
    ]
    if (pr.notes) {
      totalsRow.push({ value: '', align: 'right' })
    }
    for (const q of quotes) {
      const isWinner = data.winner?.quoteId === q.quoteId
      totalsRow.push({ value: fmtMoneyP(q.totalTTC) + (isWinner ? ' ★' : ''), align: 'right', bold: isWinner })
    }

    // Build scores summary as sub-section
    let scoresHtml = `<div style="margin-top:20px;font-size:11px;font-weight:600;color:#374151;border-top:1px solid #e5e7eb;padding-top:8px;">Évaluation des fournisseurs</div>`
    scoresHtml += `<table style="width:100%;border-collapse:collapse;margin-top:4px;"><thead><tr>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:left;font-size:10px;background:#f3f4f6;">Fournisseur</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">Prix</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">Délai</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">Couverture</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">Note</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">Paiement</th>`
    scoresHtml += `<th style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:10px;background:#f3f4f6;">SCORE TOTAL</th>`
    scoresHtml += `</tr></thead><tbody>`
    for (const q of quotes) {
      const isWinner = data.winner?.quoteId === q.quoteId
      scoresHtml += `<tr${isWinner ? ' style="background:#dcfce7;"' : ''}>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;font-size:11px;font-weight:${isWinner ? '700' : '400'};">${q.supplierName}${isWinner ? ' ★' : ''}</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:11px;">${q.scores.price}</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:11px;">${q.scores.delivery}</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:11px;">${q.scores.coverage}%</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:11px;">${q.scores.rating}</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:11px;">${q.scores.payment}</td>`
      scoresHtml += `<td style="border:1px solid #d1d5db;padding:4px 8px;text-align:center;font-size:12px;font-weight:700;${isWinner ? 'color:#166534;' : ''}">${q.scores.total}/100</td>`
      scoresHtml += `</tr>`
    }
    scoresHtml += `</tbody></table>`

    printDocument({
      title: 'COMPARATIF DE PRIX',
      docNumber: pr.number,
      infoGrid: [
        { label: 'Titre', value: pr.title, colspan: 2 },
        { label: 'Nb. fournisseurs', value: String(quotes.length) },
        { label: 'Nb. produits', value: String(data.productComparison.length) },
      ],
      columns,
      rows: [...rows, totalsRow],
      totals: [],
      subSections: scoresHtml,
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!data || data.quoteScores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BarChart3 className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Aucun devis à comparer</p>
        <p className="text-sm mt-1">Vous devez d&apos;abord créer des devis fournisseurs liés à cette demande de prix.</p>
        <Button variant="outline" className="mt-4" onClick={() => setCurrentView('supplier-quotes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Aller aux devis fournisseurs
        </Button>
      </div>
    )
  }

  const pr = data.priceRequest
  const quotes = data.quoteScores
  const winner = data.winner

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setCurrentView('price-requests')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Comparatif — {pr.number}
            </h2>
            <p className="text-sm text-muted-foreground">{pr.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          {selectedQuoteId && (
            <Button onClick={handleTransformToPO} disabled={transforming}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {transforming ? 'Création...' : 'Créer commande'}
            </Button>
          )}
        </div>
      </div>

      {/* Winner Banner */}
      {winner && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40">
              <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-800 dark:text-green-300">
                Meilleure offre : {winner.supplierName}
              </div>
              <div className="text-sm text-green-700 dark:text-green-400 flex items-center gap-4 mt-0.5">
                <span>Score : <strong>{winner.scores.total}/100</strong></span>
                <span>Total TTC : <strong>{fmtMoney(winner.totalTTC)}</strong></span>
                <span>Délai : <strong>{winner.deliveryDelay} jours</strong></span>
                <span>Couverture : <strong>{winner.coveredProducts}/{winner.totalProducts} produits</strong></span>
              </div>
            </div>
            {!winner.selectedForPO && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={selectingQuote === winner.quoteId}
                onClick={() => handleSelectQuote(winner.quoteId)}
              >
                {selectingQuote === winner.quoteId ? 'Sélection...' : 'Sélectionner'}
              </Button>
            )}
            {winner.selectedForPO && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Sélectionné
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Supplier Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quotes.map((q) => {
          const isSelected = selectedQuoteId === q.quoteId
          return (
            <Card
              key={q.quoteId}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50',
                q.selectedForPO && 'border-green-400'
              )}
              onClick={() => setSelectedQuoteId(q.quoteId)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{q.supplierName}</CardTitle>
                  <div className="flex items-center gap-1">
                    {q.selectedForPO && (
                      <Badge className="bg-green-100 text-green-700 text-[10px] dark:bg-green-900 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Sélectionné
                      </Badge>
                    )}
                    {winner?.quoteId === q.quoteId && (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] dark:bg-amber-900 dark:text-amber-300">
                        <Trophy className="h-3 w-3 mr-0.5" />
                        Meilleur
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">{renderStars(q.supplierRating)}</div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted/60 p-2">
                    <span className="text-muted-foreground">N° Devis</span>
                    <p className="font-mono font-medium">{q.quoteNumber}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-2">
                    <span className="text-muted-foreground">Total TTC</span>
                    <p className="font-semibold">{fmtMoney(q.totalTTC)}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-2">
                    <span className="text-muted-foreground">Délai livraison</span>
                    <p className="font-medium">{q.deliveryDelay} jours</p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-2">
                    <span className="text-muted-foreground">Paiement</span>
                    <p className="font-medium">{q.paymentTerms || '—'}</p>
                  </div>
                </div>

                {q.deliveryFrequency && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Fréquence : </span>
                    <span>{q.deliveryFrequency}</span>
                  </div>
                )}

                {/* Coverage */}
                <div className="text-xs">
                  <span className="text-muted-foreground">Couverture : </span>
                  <span className={cn('font-semibold', q.coveredProducts === q.totalProducts ? 'text-green-600' : 'text-amber-600')}>
                    {q.coveredProducts}/{q.totalProducts} produits
                  </span>
                  {q.coveredProducts < q.totalProducts && (
                    <span className="text-amber-500 ml-1">({q.totalProducts - q.coveredProducts} manquant(s))</span>
                  )}
                </div>

                {/* Scores */}
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold">Score global</span>
                    <span className={cn('font-bold text-sm',
                      q.scores.total >= 75 ? 'text-green-600' :
                      q.scores.total >= 50 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {q.scores.total}/100
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all',
                        q.scores.total >= 75 ? 'bg-green-500' :
                        q.scores.total >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${q.scores.total}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                    <ScoreBar value={q.scores.price} label="Prix" color={q.scores.price >= 75 ? 'text-green-600' : q.scores.price >= 50 ? 'text-amber-600' : 'text-red-600'} />
                    <ScoreBar value={q.scores.delivery} label="Délai" color={q.scores.delivery >= 75 ? 'text-green-600' : q.scores.delivery >= 50 ? 'text-amber-600' : 'text-red-600'} />
                  </div>
                </div>

                {/* Select button */}
                {!q.selectedForPO && (
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="w-full"
                    disabled={selectingQuote === q.quoteId}
                    onClick={(e) => { e.stopPropagation(); handleSelectQuote(q.quoteId) }}
                  >
                    {selectingQuote === q.quoteId ? 'Sélection...' : 'Sélectionner ce fournisseur'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Product Comparison Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PackageCheck className="h-4 w-4" />
            Comparaison par produit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[180px]">Produit</TableHead>
                  <TableHead className="text-right w-20">Qté</TableHead>
                  <TableHead className="text-right w-24">Prix cible</TableHead>
                  <TableHead className="text-right w-24">Prix max</TableHead>
                  {quotes.map((q) => (
                    <TableHead key={q.quoteId} className={cn('text-right min-w-[160px]', q.quoteId === selectedQuoteId && 'bg-primary/5')}>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground">{q.supplierName}</span>
                        <span className="font-mono text-[10px]">{q.quoteNumber}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.productComparison.map((pc, idx) => (
                  <TableRow key={pc.productId}>
                    <TableCell className="sticky left-0 bg-background">
                      <div className="font-medium text-xs">
                        <span className="font-mono text-muted-foreground mr-1">{pc.product?.reference || ''}</span>
                        {pc.product?.designation || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs">{pc.requestedQty}</TableCell>
                    <TableCell className="text-right text-xs">
                      {pc.targetPrice ? fmtMoney(pc.targetPrice) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {pc.maxPrice ? fmtMoney(pc.maxPrice) : '—'}
                    </TableCell>
                    {quotes.map((q) => {
                      const qp = pc.quotePrices.find((p) => p.quoteId === q.quoteId)
                      const isBest = pc.bestQuoteId === q.quoteId
                      const isOverMax = pc.maxPrice && qp?.unitPrice ? qp.unitPrice > pc.maxPrice : false
                      if (!qp || !qp.hasProduct) {
                        return (
                          <TableCell key={q.quoteId} className="text-right">
                            <span className="text-xs text-muted-foreground italic">Non proposé</span>
                          </TableCell>
                        )
                      }
                      return (
                        <TableCell key={q.quoteId} className={cn('text-right', isBest && 'bg-green-50 dark:bg-green-950/20')}>
                          <div className={cn('text-xs font-semibold', isBest ? 'text-green-700 dark:text-green-400' : '', isOverMax && 'text-red-600')}>
                            {fmtMoney(qp.unitPrice || 0)}
                          </div>
                          {isBest && (
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Meilleur prix</span>
                          )}
                          {qp.discount && qp.discount > 0 && (
                            <div className="text-[10px] text-green-600">-{qp.discount}%</div>
                          )}
                          <div className="mt-0.5">
                            <AvailabilityBadge availability={qp.availability} />
                          </div>
                          {qp.deliveryDelay != null && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                              <Clock className="h-2.5 w-2.5" />{qp.deliveryDelay}j
                            </div>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Scores Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Détail du scoring
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Prix (40%)</TableHead>
                  <TableHead className="text-right">Délai (20%)</TableHead>
                  <TableHead className="text-right">Couverture (15%)</TableHead>
                  <TableHead className="text-right">Note (10%)</TableHead>
                  <TableHead className="text-right">Paiement (15%)</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const isWinner = winner?.quoteId === q.quoteId
                  return (
                    <TableRow key={q.quoteId} className={isWinner ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                          <span className={cn('font-medium text-sm', isWinner && 'text-green-700 dark:text-green-400')}>{q.supplierName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{q.scores.price}</TableCell>
                      <TableCell className="text-right text-sm">{q.scores.delivery}</TableCell>
                      <TableCell className="text-right text-sm">{q.scores.coverage}%</TableCell>
                      <TableCell className="text-right text-sm">{q.scores.rating}</TableCell>
                      <TableCell className="text-right text-sm">{q.scores.payment}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn('text-sm font-bold',
                          q.scores.total >= 75 ? 'text-green-600' :
                          q.scores.total >= 50 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {q.scores.total}/100
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t text-xs text-muted-foreground">
            Pondération : Prix 40% • Délai 20% • Couverture 15% • Note fournisseur 10% • Conditions paiement 15%
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
