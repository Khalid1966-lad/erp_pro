import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const invoiceLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  tvaRate: z.number().default(20),
})

const invoiceSchema = z.object({
  clientId: z.string(),
  salesOrderId: z.string().optional(),
  dueDate: z.string().datetime(),
  discountRate: z.number().default(0),
  shippingCost: z.number().default(0),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne requise'),
})

const invoiceFromBLSchema = z.object({
  clientId: z.string(),
  deliveryNoteIds: z.array(z.string()).min(1, 'Au moins un BL requis'),
  dueDate: z.string().datetime(),
  discountRate: z.number().default(0),
  shippingCost: z.number().default(0),
  notes: z.string().optional(),
})

async function generateInvoiceNumber(): Promise<string> {
  const count = await db.invoice.count()
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  return `FAC-${year}${month}-${String(count + 1).padStart(4, '0')}`
}

// GET - List invoices (enhanced with deliveryNotes relation)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'invoices:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { client: { name: { contains: search } } },
      ]
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, number: true } },
          lines: { include: { product: { select: { id: true, reference: true, designation: true } } } },
          payments: true,
          creditNotes: true,
          deliveryNotes: {
            include: {
              deliveryNote: {
                select: {
                  id: true,
                  number: true,
                  date: true,
                  totalHT: true,
                  totalTVA: true,
                  totalTTC: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({ invoices, total, page, limit })
  } catch (error) {
    console.error('Invoices list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create invoice (manual OR from delivery notes)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // ─── Mode 2: Invoice from delivery notes ───
    if (body.deliveryNoteIds && Array.isArray(body.deliveryNoteIds) && body.deliveryNoteIds.length > 0) {
      const data = invoiceFromBLSchema.parse(body)

      // Fetch all delivery notes with lines and products
      const deliveryNotes = await db.deliveryNote.findMany({
        where: { id: { in: data.deliveryNoteIds } },
        include: {
          client: true,
          salesOrder: { select: { id: true, number: true } },
          lines: {
            include: { product: { select: { id: true, reference: true, designation: true } } },
          },
        },
      })

      if (deliveryNotes.length !== data.deliveryNoteIds.length) {
        const foundIds = new Set(deliveryNotes.map((dn) => dn.id))
        const missing = data.deliveryNoteIds.filter((id) => !foundIds.has(id))
        return NextResponse.json(
          { error: `Bons de livraison introuvables: ${missing.join(', ')}` },
          { status: 404 }
        )
      }

      // Verify all BLs belong to the same client
      const clientIds = new Set(deliveryNotes.map((dn) => dn.clientId))
      if (clientIds.size > 1) {
        return NextResponse.json(
          { error: 'Tous les bons de livraison doivent appartenir au même client' },
          { status: 400 }
        )
      }

      // Verify client exists
      const clientId = [...clientIds][0]
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
      }

      // Only allow invoicing of delivered or confirmed BLs
      const invalidBLs = deliveryNotes.filter(
        (dn) => dn.status !== 'delivered' && dn.status !== 'confirmed'
      )
      if (invalidBLs.length > 0) {
        return NextResponse.json(
          {
            error: `Seuls les BL livrés ou confirmés peuvent être facturés. BL non facturables: ${invalidBLs.map((dn) => dn.number).join(', ')}`,
          },
          { status: 400 }
        )
      }

      // Check that none are already invoiced
      const existingLinks = await db.invoiceDeliveryNote.findMany({
        where: { deliveryNoteId: { in: data.deliveryNoteIds } },
      })
      const alreadyInvoicedIds = new Set(existingLinks.map((l) => l.deliveryNoteId))
      const duplicates = data.deliveryNoteIds.filter((id) => alreadyInvoicedIds.has(id))
      if (duplicates.length > 0) {
        const dupNumbers = deliveryNotes
          .filter((dn) => duplicates.includes(dn.id))
          .map((dn) => dn.number)
        return NextResponse.json(
          { error: `BL déjà facturés: ${dupNumbers.join(', ')}` },
          { status: 400 }
        )
      }

      // Aggregate all BL lines into invoice lines
      let totalHT = 0
      let totalTVA = 0

      const linesData: {
        productId: string
        quantity: number
        unitPrice: number
        tvaRate: number
        totalHT: number
        deliveryNoteId: string
      }[] = []

      for (const dn of deliveryNotes) {
        for (const line of dn.lines) {
          const lineHT = line.quantity * line.unitPrice
          const lineTVA = lineHT * (line.tvaRate / 100)
          totalHT += lineHT
          totalTVA += lineTVA
          linesData.push({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            tvaRate: line.tvaRate,
            totalHT: lineHT,
            deliveryNoteId: dn.id,
          })
        }
      }

      const discountRate = data.discountRate || 0
      const shippingCost = data.shippingCost || 0
      const discountedHT = totalHT * (1 - discountRate / 100)
      const finalTotalHT = discountedHT + shippingCost
      const finalTotalTVA = totalTVA * (1 - discountRate / 100)
      const finalTotalTTC = finalTotalHT + finalTotalTVA

      // Determine salesOrderId: if all BLs share the same SO
      const salesOrderIds = deliveryNotes
        .map((dn) => dn.salesOrderId)
        .filter((id): id is string => id !== null)
      const uniqueSOIds = new Set(salesOrderIds)
      const salesOrderId = uniqueSOIds.size === 1 ? [...uniqueSOIds][0] : null

      const number = await generateInvoiceNumber()

      const invoice = await db.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            number,
            clientId,
            salesOrderId,
            status: 'draft',
            dueDate: new Date(data.dueDate),
            discountRate,
            shippingCost,
            notes: data.notes || null,
            totalHT: finalTotalHT,
            totalTVA: finalTotalTVA,
            totalTTC: finalTotalTTC,
            lines: {
              create: linesData.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                tvaRate: l.tvaRate,
                totalHT: l.totalHT,
              })),
            },
            deliveryNotes: {
              create: data.deliveryNoteIds.map((dnId) => ({
                deliveryNoteId: dnId,
              })),
            },
          },
          include: {
            client: true,
            lines: { include: { product: true } },
            deliveryNotes: {
              include: {
                deliveryNote: {
                  select: {
                    id: true,
                    number: true,
                    date: true,
                    totalHT: true,
                    totalTVA: true,
                    totalTTC: true,
                    status: true,
                  },
                },
              },
            },
          },
        })

        return inv
      })

      await auditLog(auth.userId, 'create', 'Invoice', invoice.id, null, invoice)
      return NextResponse.json(invoice, { status: 201 })
    }

    // ─── Mode 1: Standard manual invoice ───
    const data = invoiceSchema.parse(body)

    const client = await db.client.findUnique({ where: { id: data.clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const productIds = data.lines.map((l) => l.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs produits introuvables' }, { status: 404 })
    }

    let totalHT = 0
    let totalTVA = 0

    const linesData = data.lines.map((line) => {
      const lineHT = line.quantity * line.unitPrice
      const lineTVA = lineHT * (line.tvaRate / 100)
      totalHT += lineHT
      totalTVA += lineTVA
      return {
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
        totalHT: lineHT,
      }
    })

    const discountedHT = totalHT * (1 - data.discountRate / 100)
    const finalTotalHT = discountedHT + data.shippingCost
    const finalTotalTVA = totalTVA * (1 - data.discountRate / 100)

    const number = await generateInvoiceNumber()

    const invoice = await db.invoice.create({
      data: {
        number,
        clientId: data.clientId,
        salesOrderId: data.salesOrderId || null,
        status: 'draft',
        dueDate: new Date(data.dueDate),
        discountRate: data.discountRate,
        shippingCost: data.shippingCost,
        notes: data.notes,
        totalHT: finalTotalHT,
        totalTVA: finalTotalTVA,
        totalTTC: finalTotalHT + finalTotalTVA,
        lines: { create: linesData },
      },
      include: {
        client: true,
        lines: { include: { product: true } },
        deliveryNotes: {
          include: {
            deliveryNote: {
              select: {
                id: true,
                number: true,
                date: true,
                totalHT: true,
                totalTVA: true,
                totalTTC: true,
                status: true,
              },
            },
          },
        },
      },
    })

    await auditLog(auth.userId, 'create', 'Invoice', invoice.id, null, invoice)
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Invoice create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update invoice / Validate
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { client: true, lines: { include: { product: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    // Validate invoice - create accounting entries (double-entry)
    if (action === 'validate') {
      if (existing.status !== 'draft') {
        return NextResponse.json({ error: 'Seule une facture en brouillon peut être validée' }, { status: 400 })
      }

      // Get settings for account codes
      const clientAccountSetting = await db.setting.findUnique({ where: { key: 'account_client' } })
      const revenueAccountSetting = await db.setting.findUnique({ where: { key: 'account_revenue' } })
      const tvaAccountSetting = await db.setting.findUnique({ where: { key: 'account_tva_collected' } })

      const clientAccount = clientAccountSetting?.value || '411000'
      const revenueAccount = revenueAccountSetting?.value || '706000'
      const tvaAccount = tvaAccountSetting?.value || '445710'

      // The existing.totalHT is ALREADY the discounted amount, don't discount again
      const finalTotalHT = existing.totalHT + existing.shippingCost

      // Create accounting entries
      await db.accountingEntry.createMany({
        data: [
          // Debit: Client account (receivable)
          {
            label: `Facture ${existing.number} - Client`,
            account: clientAccount,
            debit: existing.totalTTC,
            credit: 0,
            documentRef: existing.number,
          },
          // Credit: Revenue account
          {
            label: `Facture ${existing.number} - Ventes`,
            account: revenueAccount,
            debit: 0,
            credit: finalTotalHT,
            documentRef: existing.number,
          },
          // Credit: TVA collected
          {
            label: `Facture ${existing.number} - TVA collectée`,
            account: tvaAccount,
            debit: 0,
            credit: existing.totalTTC - finalTotalHT,
            documentRef: existing.number,
          },
        ],
      })

      // Update client balance
      await db.client.update({
        where: { id: existing.clientId },
        data: { balance: { increment: existing.totalTTC } },
      })

      const invoice = await db.invoice.update({
        where: { id },
        data: { status: 'validated' },
        include: {
          client: true,
          lines: { include: { product: true } },
          deliveryNotes: {
            include: {
              deliveryNote: {
                select: {
                  id: true,
                  number: true,
                  date: true,
                  totalHT: true,
                  totalTVA: true,
                  totalTTC: true,
                  status: true,
                },
              },
            },
          },
        },
      })

      await auditLog(auth.userId, 'validate', 'Invoice', id, existing, invoice)
      return NextResponse.json(invoice)
    }

    // Send invoice
    if (action === 'send') {
      if (existing.status !== 'validated') {
        return NextResponse.json({ error: 'La facture doit être validée' }, { status: 400 })
      }
      const invoice = await db.invoice.update({
        where: { id },
        data: { status: 'sent' },
        include: {
          client: true,
          lines: { include: { product: true } },
          deliveryNotes: {
            include: {
              deliveryNote: {
                select: {
                  id: true,
                  number: true,
                  date: true,
                  totalHT: true,
                  totalTVA: true,
                  totalTTC: true,
                  status: true,
                },
              },
            },
          },
        },
      })
      await auditLog(auth.userId, 'send', 'Invoice', id, existing, invoice)
      return NextResponse.json(invoice)
    }

    // Mark as paid
    if (action === 'pay') {
      const invoice = await db.invoice.update({
        where: { id },
        data: { status: 'paid', paymentDate: new Date() },
        include: {
          client: true,
          lines: { include: { product: true } },
          deliveryNotes: {
            include: {
              deliveryNote: {
                select: {
                  id: true,
                  number: true,
                  date: true,
                  totalHT: true,
                  totalTVA: true,
                  totalTTC: true,
                  status: true,
                },
              },
            },
          },
        },
      })
      await auditLog(auth.userId, 'pay', 'Invoice', id, existing, invoice)
      return NextResponse.json(invoice)
    }

    // Cancel invoice
    if (action === 'cancel') {
      if (existing.status === 'paid') {
        return NextResponse.json({ error: 'Impossible d\'annuler une facture payée' }, { status: 400 })
      }

      // Reverse accounting entries if validated
      if (existing.status === 'validated' || existing.status === 'sent') {
        const clientAccountSetting = await db.setting.findUnique({ where: { key: 'account_client' } })
        const revenueAccountSetting = await db.setting.findUnique({ where: { key: 'account_revenue' } })
        const tvaAccountSetting = await db.setting.findUnique({ where: { key: 'account_tva_collected' } })

        const clientAccount = clientAccountSetting?.value || '411000'
        const revenueAccount = revenueAccountSetting?.value || '706000'
        const tvaAccount = tvaAccountSetting?.value || '445710'

        await db.accountingEntry.createMany({
          data: [
            {
              label: `Annulation Facture ${existing.number} - Client`,
              account: clientAccount,
              debit: 0,
              credit: existing.totalTTC,
              documentRef: `ANN-${existing.number}`,
            },
            {
              label: `Annulation Facture ${existing.number} - Ventes`,
              account: revenueAccount,
              debit: existing.totalHT,
              credit: 0,
              documentRef: `ANN-${existing.number}`,
            },
            {
              label: `Annulation Facture ${existing.number} - TVA`,
              account: tvaAccount,
              debit: existing.totalTVA,
              credit: 0,
              documentRef: `ANN-${existing.number}`,
            },
          ],
        })

        // Reverse client balance
        await db.client.update({
          where: { id: existing.clientId },
          data: { balance: { decrement: existing.totalTTC } },
        })
      }

      const invoice = await db.invoice.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          client: true,
          lines: { include: { product: true } },
          deliveryNotes: {
            include: {
              deliveryNote: {
                select: {
                  id: true,
                  number: true,
                  date: true,
                  totalHT: true,
                  totalTVA: true,
                  totalTTC: true,
                  status: true,
                },
              },
            },
          },
        },
      })
      await auditLog(auth.userId, 'cancel', 'Invoice', id, existing, invoice)
      return NextResponse.json(invoice)
    }

    // Simple update
    const invoice = await db.invoice.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        lines: { include: { product: true } },
        deliveryNotes: {
          include: {
            deliveryNote: {
              select: {
                id: true,
                number: true,
                date: true,
                totalHT: true,
                totalTVA: true,
                totalTTC: true,
                status: true,
              },
            },
          },
        },
      },
    })

    await auditLog(auth.userId, 'update', 'Invoice', id, existing, invoice)
    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete invoice
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'invoices:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { payments: true, creditNotes: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Seule une facture en brouillon peut être supprimée' }, { status: 400 })
    }

    if (existing.payments.length > 0 || existing.creditNotes.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer une facture avec des paiements ou avoirs' }, { status: 400 })
    }

    // Delete junction records first, then lines, then invoice
    await db.invoiceDeliveryNote.deleteMany({ where: { invoiceId: id } })
    await db.invoiceLine.deleteMany({ where: { invoiceId: id } })
    await db.invoice.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Invoice', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invoice delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
