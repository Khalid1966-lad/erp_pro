import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const paymentSchema = z.object({
  invoiceId: z.string().optional(),
  type: z.enum(['client_payment', 'supplier_payment', 'cash_in', 'cash_out']),
  amount: z.number().min(0.01),
  method: z.enum(['cash', 'check', 'bank_transfer', 'card']),
  reference: z.string().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
})

// GET - List payments
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get('invoiceId') || ''
    const type = searchParams.get('type') || ''
    const method = searchParams.get('method') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (invoiceId) where.invoiceId = invoiceId
    if (type) where.type = type
    if (method) where.method = method

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({ payments, total, page, limit })
  } catch (error) {
    console.error('Payments list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create payment + accounting entries
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = paymentSchema.parse(body)

    // If linked to an invoice, verify it exists
    if (data.invoiceId) {
      const invoice = await db.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { client: true },
      })
      if (!invoice) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
      }
    }

    // Get settings for account codes
    const bankAccountSetting = await db.setting.findUnique({ where: { key: 'account_bank' } })
    const clientAccountSetting = await db.setting.findUnique({ where: { key: 'account_client' } })
    const cashAccountSetting = await db.setting.findUnique({ where: { key: 'account_cash' } })

    const bankAccount = bankAccountSetting?.value || '512000'
    const clientAccount = clientAccountSetting?.value || '411000'
    const cashAccount = cashAccountSetting?.value || '530000'

    const paymentDate = data.date ? new Date(data.date) : new Date()

    // Process payment creation with all side effects in a single transaction
    const payment = await db.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          invoiceId: data.invoiceId || null,
          type: data.type,
          amount: data.amount,
          method: data.method,
          reference: data.reference,
          date: paymentDate,
          notes: data.notes,
        },
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              clientId: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      })

      // Create accounting entries and update balances
      if (data.type === 'client_payment') {
        // Client payment: Debit bank/cash, Credit client account
        const debitAccount = data.method === 'cash' ? cashAccount : bankAccount

        await tx.accountingEntry.createMany({
          data: [
            {
              label: `Paiement ${createdPayment.invoice?.number || data.reference || 'client'}`,
              account: debitAccount,
              debit: data.amount,
              credit: 0,
              documentRef: createdPayment.id,
            },
            {
              label: `Paiement client - ${createdPayment.invoice?.client?.name || 'Client'}`,
              account: clientAccount,
              debit: 0,
              credit: data.amount,
              documentRef: createdPayment.id,
            },
          ],
        })

        // Update the actual financial account balance based on payment method
        if (data.method === 'cash') {
          const cashRegister = await tx.cashRegister.findFirst({ where: { isActive: true } })
          if (cashRegister) {
            await tx.cashRegister.update({
              where: { id: cashRegister.id },
              data: { balance: { increment: data.amount } },
            })
          }
        } else if (data.method === 'bank_transfer' || data.method === 'check' || data.method === 'card') {
          const bankAcct = await tx.bankAccount.findFirst({ where: { isActive: true } })
          if (bankAcct) {
            await tx.bankAccount.update({
              where: { id: bankAcct.id },
              data: { balance: { increment: data.amount } },
            })
          }
        }

        // Update client balance
        if (createdPayment.invoice?.clientId) {
          await tx.client.update({
            where: { id: createdPayment.invoice.clientId },
            data: { balance: { decrement: data.amount } },
          })
        }

        // Update invoice status if fully paid
        if (data.invoiceId) {
          const invoicePayments = await tx.payment.findMany({
            where: { invoiceId: data.invoiceId },
          })
          const totalPaid = invoicePayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

          const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } })
          if (invoice && totalPaid >= invoice.totalTTC) {
            await tx.invoice.update({
              where: { id: data.invoiceId },
              data: { status: 'paid', paymentDate: paymentDate },
            })
          }
        }
      } else if (data.type === 'cash_in') {
        await tx.accountingEntry.create({
          data: {
            label: `Encaissement ${data.reference || 'caisse'}`,
            account: cashAccount,
            debit: data.amount,
            credit: 0,
            documentRef: createdPayment.id,
          },
        })
      } else if (data.type === 'cash_out') {
        await tx.accountingEntry.create({
          data: {
            label: `Décaissement ${data.reference || 'caisse'}`,
            account: cashAccount,
            debit: 0,
            credit: data.amount,
            documentRef: createdPayment.id,
          },
        })
      }

      return createdPayment
    })

    await auditLog(auth.userId, 'create', 'Payment', payment.id, null, payment)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Payment create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update payment
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }

    const data = paymentSchema.partial().parse(updateData)
    const payment = await db.payment.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    })

    await auditLog(auth.userId, 'update', 'Payment', id, existing, payment)
    return NextResponse.json(payment)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Payment update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete payment
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.payment.findUnique({
      where: { id },
      include: { invoice: { select: { clientId: true, status: true, totalTTC: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }

    // Reverse client balance if it was a client payment
    if (existing.type === 'client_payment' && existing.invoice?.clientId) {
      await db.client.update({
        where: { id: existing.invoice.clientId },
        data: { balance: { increment: existing.amount } },
      })

      // Update invoice status back if needed
      if (existing.invoiceId && existing.invoice?.status === 'paid') {
        await db.invoice.update({
          where: { id: existing.invoiceId },
          data: { status: 'validated', paymentDate: null },
        })
      }
    }

    await db.payment.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Payment', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payment delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
