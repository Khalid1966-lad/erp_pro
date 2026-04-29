import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

export const maxDuration = 30

// ─── Validation schemas ───────────────────────────────────────────────

const paymentLineSchema = z.object({
  invoiceId: z.string().optional(),
  supplierInvoiceId: z.string().optional(),
  amount: z.number().min(0.01),
})

const paymentSchema = z.object({
  type: z.enum(['client_payment', 'supplier_payment', 'cash_in', 'cash_out']),
  amount: z.number().min(0.01),
  method: z.enum(['cash', 'check', 'bank_transfer', 'card', 'effet']),
  reference: z.string().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
  bankAccountId: z.string().optional(),
  cashRegisterId: z.string().optional(),
  lines: z.array(paymentLineSchema).min(1, 'Au moins une facture à payer'),
})

const paymentUpdateSchema = z.object({
  notes: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().datetime().optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────

function generateReference(type: string, count: number): string {
  const padded = String(count + 1).padStart(4, '0')
  if (type === 'client_payment') return `PAY-CLI-${padded}`
  if (type === 'supplier_payment') return `PAY-FRS-${padded}`
  return `PAY-${padded}`
}

/** Convert number to alphabetic code: 0→A, 25→Z, 26→AA, 27→AB, ... */
function numberToAlphaCode(n: number): string {
  let code = ''
  let num = n
  do {
    code = String.fromCharCode(65 + (num % 26)) + code
    num = Math.floor(num / 26) - 1
  } while (num >= 0)
  return code
}

/** Generate a payment code within a Prisma transaction */
async function generatePaymentCode(tx: any): Promise<{ code: string; codeYear: number }> {
  const year = new Date().getFullYear()
  const counter = await tx.paymentCodeCounter.upsert({
    where: { year },
    update: { counter: { increment: 1 } },
    create: { year, counter: 0 },
  })
  return { code: numberToAlphaCode(counter.counter), codeYear: year }
}

// ─── GET ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get('invoiceId') || ''
    const clientId = searchParams.get('clientId') || ''
    const supplierId = searchParams.get('supplierId') || ''
    const type = searchParams.get('type') || ''
    const method = searchParams.get('method') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (invoiceId) where.invoiceId = invoiceId
    if (type) where.type = type
    if (method) where.method = method

    // Filter by clientId via paymentLines linked to client invoices
    // Filter by supplierId via paymentLines linked to supplier invoices
    let clientIdFilter: string | null = clientId || null
    let supplierIdFilter: string | null = supplierId || null

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where: clientIdFilter
          ? {
              ...where,
              paymentLines: {
                some: {
                  invoice: { clientId: clientIdFilter },
                },
              },
            }
          : supplierIdFilter
            ? {
                ...where,
                paymentLines: {
                  some: {
                    supplierInvoice: { supplierId: supplierIdFilter },
                  },
                },
              }
            : where,
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              client: { select: { id: true, name: true } },
            },
          },
          bankAccount: {
            select: { id: true, name: true },
          },
          cashRegister: {
            select: { id: true, name: true },
          },
          effetsCheques: true,
          paymentLines: {
            include: {
              invoice: {
                select: {
                  id: true,
                  number: true,
                  totalTTC: true,
                  amountPaid: true,
                  status: true,
                  client: { select: { id: true, name: true } },
                },
              },
              supplierInvoice: {
                select: {
                  id: true,
                  number: true,
                  totalTTC: true,
                  amountPaid: true,
                  status: true,
                  supplier: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payment.count({
        where: clientIdFilter
          ? {
              ...where,
              paymentLines: {
                some: {
                  invoice: { clientId: clientIdFilter },
                },
              },
            }
          : supplierIdFilter
            ? {
                ...where,
                paymentLines: {
                  some: {
                    supplierInvoice: { supplierId: supplierIdFilter },
                  },
                },
              }
            : where,
      }),
    ])

    return NextResponse.json({ payments, total, page, limit })
  } catch (error) {
    console.error('Payments list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = paymentSchema.parse(body)

    // ── Validation: bank/cash rules ──
    if (data.method === 'cash') {
      if (data.cashRegisterId && data.bankAccountId) {
        return NextResponse.json({ error: 'Impossible de spécifier à la fois un compte bancaire et une caisse' }, { status: 400 })
      }
    } else {
      if (data.cashRegisterId && data.bankAccountId) {
        return NextResponse.json({ error: 'Impossible de spécifier à la fois un compte bancaire et une caisse' }, { status: 400 })
      }
    }

    const paymentDate = data.date ? new Date(data.date) : new Date()

    // ── Load accounting settings ──
    const [bankSetting, clientSetting, cashSetting, supplierSetting] = await Promise.all([
      db.setting.findUnique({ where: { key: 'account_bank' } }),
      db.setting.findUnique({ where: { key: 'account_client' } }),
      db.setting.findUnique({ where: { key: 'account_cash' } }),
      db.setting.findUnique({ where: { key: 'account_supplier' } }),
    ])

    const bankAccount = bankSetting?.value || '512000'
    const clientAccount = clientSetting?.value || '411000'
    const cashAccount = cashSetting?.value || '530000'
    const supplierAccount = supplierSetting?.value || '401000'

    // ──────────────────────────────────────────────────────────────
    // client_payment
    // ──────────────────────────────────────────────────────────────
    if (data.type === 'client_payment') {
      // Validate every line targets a client invoice
      for (const line of data.lines) {
        if (!line.invoiceId) {
          return NextResponse.json({ error: 'Chaque ligne doit indiquer une facture client (invoiceId)' }, { status: 400 })
        }
        if (line.supplierInvoiceId) {
          return NextResponse.json({ error: 'Un paiement client ne peut pas être lié à une facture fournisseur' }, { status: 400 })
        }
      }

      // Load all referenced invoices and verify same client
      const invoiceIds = data.lines.map(l => l.invoiceId!).filter(Boolean)
      const invoices = await db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, clientId: true, totalTTC: true, amountPaid: true, status: true, number: true, client: { select: { id: true, name: true } } },
      })

      if (invoices.length !== invoiceIds.length) {
        const foundIds = new Set(invoices.map(i => i.id))
        const missing = invoiceIds.filter(id => !foundIds.has(id))
        return NextResponse.json({ error: `Facture(s) introuvable(s): ${missing.join(', ')}` }, { status: 404 })
      }

      const uniqueClients = new Set(invoices.map(i => i.clientId))
      if (uniqueClients.size > 1) {
        return NextResponse.json({ error: 'Toutes les factures doivent appartenir au même client' }, { status: 400 })
      }

      const clientId = invoices[0].clientId

      // Validate amounts ≤ remaining balance
      for (const line of data.lines) {
        const inv = invoices.find(i => i.id === line.invoiceId)
        if (!inv) continue
        const remaining = inv.totalTTC - inv.amountPaid
        if (line.amount > remaining + 0.001) { // small epsilon for float comparison
          return NextResponse.json({
            error: `Le montant de la ligne (${line.amount}) dépasse le solde restant de la facture ${inv.number} (${remaining.toFixed(2)})`,
          }, { status: 400 })
        }
      }

      // Validate sum === payment amount
      const linesTotal = data.lines.reduce((s, l) => s + l.amount, 0)
      if (Math.abs(linesTotal - data.amount) > 0.001) {
        return NextResponse.json({
          error: `Le total des lignes (${linesTotal.toFixed(2)}) ne correspond pas au montant du paiement (${data.amount.toFixed(2)})`,
        }, { status: 400 })
      }

      // Generate reference
      const count = await db.payment.count({ where: { type: 'client_payment' } })
      const reference = data.reference || generateReference('client_payment', count)

      // Execute everything in a transaction
      const payment = await db.$transaction(async (tx) => {
        // Generate alphabetic payment code (A, B, C, ..., AA, AB, ...)
        const paymentCode = await generatePaymentCode(tx)

        // Create Payment
        const created = await tx.payment.create({
          data: {
            invoiceId: invoiceIds[0] || null, // backward compat
            type: data.type,
            amount: data.amount,
            method: data.method,
            reference,
            code: paymentCode.code,
            codeYear: paymentCode.codeYear,
            date: paymentDate,
            notes: data.notes,
            bankAccountId: data.bankAccountId || null,
            cashRegisterId: data.cashRegisterId || null,
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
            paymentLines: {
              include: {
                invoice: {
                  select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, client: { select: { id: true, name: true } } },
                },
                supplierInvoice: {
                  select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, supplier: { select: { id: true, name: true } } },
                },
              },
            },
          },
        })

        // Create PaymentLines
        await tx.paymentLine.createMany({
          data: data.lines.map(line => ({
            paymentId: created.id,
            invoiceId: line.invoiceId || null,
            supplierInvoiceId: line.supplierInvoiceId || null,
            amount: line.amount,
          })),
        })

        // Update each Invoice.amountPaid
        for (const line of data.lines) {
          if (!line.invoiceId) continue
          await tx.invoice.update({
            where: { id: line.invoiceId },
            data: { amountPaid: { increment: line.amount } },
          })
        }

        // Re-read invoices to determine new statuses
        const updatedInvoices = await tx.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, totalTTC: true, amountPaid: true },
        })

        for (const inv of updatedInvoices) {
          if (inv.amountPaid >= inv.totalTTC - 0.001) {
            await tx.invoice.update({
              where: { id: inv.id },
              data: { status: 'paid', paymentDate },
            })
          } else if (inv.amountPaid > 0.001) {
            await tx.invoice.update({
              where: { id: inv.id },
              data: { status: 'partially_paid' },
            })
          }
        }

        // Create accounting entries: Debit bank/cash, Credit client account
        const debitAccount = data.method === 'cash' ? cashAccount : bankAccount
        await tx.accountingEntry.createMany({
          data: [
            {
              label: `Paiement client ${invoices[0].client?.name || ''} - ${invoices.map(i => i.number).join(', ')}`,
              account: debitAccount,
              debit: data.amount,
              credit: 0,
              documentRef: created.id,
            },
            {
              label: `Paiement client - ${invoices[0].client?.name || 'Client'}`,
              account: clientAccount,
              debit: 0,
              credit: data.amount,
              documentRef: created.id,
            },
          ],
        })

        // Update bank/cash balance (increment — money in)
        if (data.method === 'cash') {
          const cashReg = data.cashRegisterId
            ? await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } })
            : await tx.cashRegister.findFirst({ where: { isActive: true } })
          if (cashReg) {
            await tx.cashRegister.update({
              where: { id: cashReg.id },
              data: { balance: { increment: data.amount } },
            })
          }
        } else {
          const bank = data.bankAccountId
            ? await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } })
            : await tx.bankAccount.findFirst({ where: { isActive: true } })
          if (bank) {
            await tx.bankAccount.update({
              where: { id: bank.id },
              data: { balance: { increment: data.amount } },
            })
          }
        }

        // Update client balance (decrement — client owes less)
        await tx.client.update({
          where: { id: clientId },
          data: { balance: { decrement: data.amount } },
        })

        return created
      })

      await auditLog(auth.userId, 'create', 'Payment', payment.id, null, payment)
      return NextResponse.json(payment, { status: 201 })
    }

    // ──────────────────────────────────────────────────────────────
    // supplier_payment
    // ──────────────────────────────────────────────────────────────
    if (data.type === 'supplier_payment') {
      // Validate every line targets a supplier invoice
      for (const line of data.lines) {
        if (!line.supplierInvoiceId) {
          return NextResponse.json({ error: 'Chaque ligne doit indiquer une facture fournisseur (supplierInvoiceId)' }, { status: 400 })
        }
        if (line.invoiceId) {
          return NextResponse.json({ error: 'Un paiement fournisseur ne peut pas être lié à une facture client' }, { status: 400 })
        }
      }

      // Load all referenced supplier invoices and verify same supplier
      const supplierInvoiceIds = data.lines.map(l => l.supplierInvoiceId!).filter(Boolean)
      const supplierInvoices = await db.supplierInvoice.findMany({
        where: { id: { in: supplierInvoiceIds } },
        select: { id: true, supplierId: true, totalTTC: true, amountPaid: true, status: true, number: true, supplier: { select: { id: true, name: true } } },
      })

      if (supplierInvoices.length !== supplierInvoiceIds.length) {
        const foundIds = new Set(supplierInvoices.map(i => i.id))
        const missing = supplierInvoiceIds.filter(id => !foundIds.has(id))
        return NextResponse.json({ error: `Facture(s) fournisseur(s) introuvable(s): ${missing.join(', ')}` }, { status: 404 })
      }

      const uniqueSuppliers = new Set(supplierInvoices.map(i => i.supplierId))
      if (uniqueSuppliers.size > 1) {
        return NextResponse.json({ error: 'Toutes les factures doivent appartenir au même fournisseur' }, { status: 400 })
      }

      const supplierId = supplierInvoices[0].supplierId

      // Validate amounts ≤ remaining balance
      for (const line of data.lines) {
        const si = supplierInvoices.find(i => i.id === line.supplierInvoiceId)
        if (!si) continue
        const remaining = si.totalTTC - si.amountPaid
        if (line.amount > remaining + 0.001) {
          return NextResponse.json({
            error: `Le montant de la ligne (${line.amount}) dépasse le solde restant de la facture ${si.number} (${remaining.toFixed(2)})`,
          }, { status: 400 })
        }
      }

      // Validate sum === payment amount
      const linesTotal = data.lines.reduce((s, l) => s + l.amount, 0)
      if (Math.abs(linesTotal - data.amount) > 0.001) {
        return NextResponse.json({
          error: `Le total des lignes (${linesTotal.toFixed(2)}) ne correspond pas au montant du paiement (${data.amount.toFixed(2)})`,
        }, { status: 400 })
      }

      // Generate reference
      const count = await db.payment.count({ where: { type: 'supplier_payment' } })
      const reference = data.reference || generateReference('supplier_payment', count)

      // Execute everything in a transaction
      const payment = await db.$transaction(async (tx) => {
        // Generate alphabetic payment code
        const paymentCode = await generatePaymentCode(tx)

        // Create Payment (invoiceId = null for supplier payments)
        const created = await tx.payment.create({
          data: {
            invoiceId: null,
            type: data.type,
            amount: data.amount,
            method: data.method,
            reference,
            code: paymentCode.code,
            codeYear: paymentCode.codeYear,
            date: paymentDate,
            notes: data.notes,
            bankAccountId: data.bankAccountId || null,
            cashRegisterId: data.cashRegisterId || null,
          },
          include: {
            paymentLines: {
              include: {
                invoice: {
                  select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, client: { select: { id: true, name: true } } },
                },
                supplierInvoice: {
                  select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, supplier: { select: { id: true, name: true } } },
                },
              },
            },
          },
        })

        // Create PaymentLines
        await tx.paymentLine.createMany({
          data: data.lines.map(line => ({
            paymentId: created.id,
            invoiceId: line.invoiceId || null,
            supplierInvoiceId: line.supplierInvoiceId || null,
            amount: line.amount,
          })),
        })

        // Update each SupplierInvoice.amountPaid
        for (const line of data.lines) {
          if (!line.supplierInvoiceId) continue
          await tx.supplierInvoice.update({
            where: { id: line.supplierInvoiceId },
            data: { amountPaid: { increment: line.amount } },
          })
        }

        // Re-read supplier invoices to determine new statuses
        const updatedInvoices = await tx.supplierInvoice.findMany({
          where: { id: { in: supplierInvoiceIds } },
          select: { id: true, totalTTC: true, amountPaid: true },
        })

        for (const si of updatedInvoices) {
          if (si.amountPaid >= si.totalTTC - 0.001) {
            await tx.supplierInvoice.update({
              where: { id: si.id },
              data: { status: 'paid', paymentDate },
            })
          } else if (si.amountPaid > 0.001) {
            await tx.supplierInvoice.update({
              where: { id: si.id },
              data: { status: 'partially_paid' },
            })
          }
        }

        // Create accounting entries: Credit bank/cash, Debit supplier account
        const creditAccount = data.method === 'cash' ? cashAccount : bankAccount
        await tx.accountingEntry.createMany({
          data: [
            {
              label: `Paiement fournisseur ${supplierInvoices[0].supplier?.name || ''} - ${supplierInvoices.map(i => i.number).join(', ')}`,
              account: supplierAccount,
              debit: data.amount,
              credit: 0,
              documentRef: created.id,
            },
            {
              label: `Paiement fournisseur - ${supplierInvoices[0].supplier?.name || 'Fournisseur'}`,
              account: creditAccount,
              debit: 0,
              credit: data.amount,
              documentRef: created.id,
            },
          ],
        })

        // Update bank/cash balance (decrement — we're paying out)
        if (data.method === 'cash') {
          const cashReg = data.cashRegisterId
            ? await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } })
            : await tx.cashRegister.findFirst({ where: { isActive: true } })
          if (cashReg) {
            await tx.cashRegister.update({
              where: { id: cashReg.id },
              data: { balance: { decrement: data.amount } },
            })
          }
        } else {
          const bank = data.bankAccountId
            ? await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } })
            : await tx.bankAccount.findFirst({ where: { isActive: true } })
          if (bank) {
            await tx.bankAccount.update({
              where: { id: bank.id },
              data: { balance: { decrement: data.amount } },
            })
          }
        }

        // Update supplier balance (increment — we owe less)
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balance: { increment: data.amount } },
        })

        return created
      })

      await auditLog(auth.userId, 'create', 'Payment', payment.id, null, payment)
      return NextResponse.json(payment, { status: 201 })
    }

    // ──────────────────────────────────────────────────────────────
    // cash_in / cash_out
    // ──────────────────────────────────────────────────────────────
    if (data.type === 'cash_in' || data.type === 'cash_out') {
      const count = await db.payment.count({ where: { type: data.type } })
      const reference = data.reference || `PAY-${data.type === 'cash_in' ? 'ENT' : 'SOR'}-${String(count + 1).padStart(4, '0')}`

      const payment = await db.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            invoiceId: null,
            type: data.type,
            amount: data.amount,
            method: data.method,
            reference,
            date: paymentDate,
            notes: data.notes,
            bankAccountId: data.bankAccountId || null,
            cashRegisterId: data.cashRegisterId || null,
          },
          include: {
            paymentLines: true,
          },
        })

        const debitAccount = data.method === 'cash' ? cashAccount : bankAccount

        if (data.type === 'cash_in') {
          await tx.accountingEntry.create({
            data: {
              label: `Encaissement ${reference || 'caisse'}`,
              account: debitAccount,
              debit: data.amount,
              credit: 0,
              documentRef: created.id,
            },
          })

          // Increment cash register / bank balance
          if (data.method === 'cash') {
            const cashReg = data.cashRegisterId
              ? await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } })
              : await tx.cashRegister.findFirst({ where: { isActive: true } })
            if (cashReg) {
              await tx.cashRegister.update({
                where: { id: cashReg.id },
                data: { balance: { increment: data.amount } },
              })
            }
          } else {
            const bank = data.bankAccountId
              ? await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } })
              : await tx.bankAccount.findFirst({ where: { isActive: true } })
            if (bank) {
              await tx.bankAccount.update({
                where: { id: bank.id },
                data: { balance: { increment: data.amount } },
              })
            }
          }
        } else {
          // cash_out
          await tx.accountingEntry.create({
            data: {
              label: `Décaissement ${reference || 'caisse'}`,
              account: debitAccount,
              debit: 0,
              credit: data.amount,
              documentRef: created.id,
            },
          })

          // Decrement cash register / bank balance
          if (data.method === 'cash') {
            const cashReg = data.cashRegisterId
              ? await tx.cashRegister.findUnique({ where: { id: data.cashRegisterId } })
              : await tx.cashRegister.findFirst({ where: { isActive: true } })
            if (cashReg) {
              await tx.cashRegister.update({
                where: { id: cashReg.id },
                data: { balance: { decrement: data.amount } },
              })
            }
          } else {
            const bank = data.bankAccountId
              ? await tx.bankAccount.findUnique({ where: { id: data.bankAccountId } })
              : await tx.bankAccount.findFirst({ where: { isActive: true } })
            if (bank) {
              await tx.bankAccount.update({
                where: { id: bank.id },
                data: { balance: { decrement: data.amount } },
              })
            }
          }
        }

        return created
      })

      await auditLog(auth.userId, 'create', 'Payment', payment.id, null, payment)
      return NextResponse.json(payment, { status: 201 })
    }

    return NextResponse.json({ error: 'Type de paiement non supporté' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Payment create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────

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

    const data = paymentUpdateSchema.parse(updateData)
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
        paymentLines: {
          include: {
            invoice: {
              select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, client: { select: { id: true, name: true } } },
            },
            supplierInvoice: {
              select: { id: true, number: true, totalTTC: true, amountPaid: true, status: true, supplier: { select: { id: true, name: true } } },
            },
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

// ─── DELETE ────────────────────────────────────────────────────────────

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

    // Load full payment with all relations
    const existing = await db.payment.findUnique({
      where: { id },
      include: {
        invoice: { select: { clientId: true, status: true, totalTTC: true, amountPaid: true } },
        paymentLines: {
          include: {
            invoice: { select: { id: true, clientId: true, totalTTC: true, amountPaid: true, status: true } },
            supplierInvoice: { select: { id: true, supplierId: true, totalTTC: true, amountPaid: true, status: true } },
          },
        },
        effetsCheques: { select: { id: true } },
        bankAccount: { select: { id: true } },
        cashRegister: { select: { id: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // ── client_payment reversal ──
      if (existing.type === 'client_payment') {
        // Revert each invoice's amountPaid and status
        for (const line of existing.paymentLines) {
          if (line.invoiceId && line.invoice) {
            await tx.invoice.update({
              where: { id: line.invoiceId },
              data: { amountPaid: { decrement: line.amount } },
            })

            // Re-read to determine correct status after decrement
            const updated = await tx.invoice.findUnique({
              where: { id: line.invoiceId },
              select: { amountPaid: true, totalTTC: true, status: true },
            })

            if (updated) {
              if (updated.amountPaid <= 0.001) {
                // Fully reversed — go back to validated
                await tx.invoice.update({
                  where: { id: line.invoiceId },
                  data: { status: 'validated', paymentDate: null },
                })
              } else if (updated.amountPaid < updated.totalTTC - 0.001) {
                // Still partially paid
                if (updated.status === 'paid') {
                  await tx.invoice.update({
                    where: { id: line.invoiceId },
                    data: { status: 'partially_paid', paymentDate: null },
                  })
                }
              }
            }
          }
        }

        // Increment client balance (client owes more now)
        if (existing.paymentLines.length > 0 && existing.paymentLines[0].invoice) {
          await tx.client.update({
            where: { id: existing.paymentLines[0].invoice.clientId },
            data: { balance: { increment: existing.amount } },
          })
        }

        // Decrement bank/cash balance (money goes back out)
        if (existing.method === 'cash' && existing.cashRegisterId) {
          await tx.cashRegister.update({
            where: { id: existing.cashRegisterId },
            data: { balance: { decrement: existing.amount } },
          })
        } else if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { balance: { decrement: existing.amount } },
          })
        }
      }

      // ── supplier_payment reversal ──
      if (existing.type === 'supplier_payment') {
        // Revert each supplier invoice's amountPaid and status
        for (const line of existing.paymentLines) {
          if (line.supplierInvoiceId && line.supplierInvoice) {
            await tx.supplierInvoice.update({
              where: { id: line.supplierInvoiceId },
              data: { amountPaid: { decrement: line.amount } },
            })

            // Re-read to determine correct status after decrement
            const updated = await tx.supplierInvoice.findUnique({
              where: { id: line.supplierInvoiceId },
              select: { amountPaid: true, totalTTC: true, status: true },
            })

            if (updated) {
              if (updated.amountPaid <= 0.001) {
                // Fully reversed — go back to verified
                await tx.supplierInvoice.update({
                  where: { id: line.supplierInvoiceId },
                  data: { status: 'verified', paymentDate: null },
                })
              } else if (updated.amountPaid < updated.totalTTC - 0.001) {
                // Still partially paid
                if (updated.status === 'paid') {
                  await tx.supplierInvoice.update({
                    where: { id: line.supplierInvoiceId },
                    data: { status: 'partially_paid', paymentDate: null },
                  })
                }
              }
            }
          }
        }

        // Decrement supplier balance (we owe more now)
        if (existing.paymentLines.length > 0 && existing.paymentLines[0].supplierInvoice) {
          await tx.supplier.update({
            where: { id: existing.paymentLines[0].supplierInvoice.supplierId },
            data: { balance: { decrement: existing.amount } },
          })
        }

        // Increment bank/cash balance (money comes back in)
        if (existing.method === 'cash' && existing.cashRegisterId) {
          await tx.cashRegister.update({
            where: { id: existing.cashRegisterId },
            data: { balance: { increment: existing.amount } },
          })
        } else if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { balance: { increment: existing.amount } },
          })
        }
      }

      // ── cash_in / cash_out reversal ──
      if (existing.type === 'cash_in') {
        if (existing.method === 'cash' && existing.cashRegisterId) {
          await tx.cashRegister.update({
            where: { id: existing.cashRegisterId },
            data: { balance: { decrement: existing.amount } },
          })
        } else if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { balance: { decrement: existing.amount } },
          })
        }
      }

      if (existing.type === 'cash_out') {
        if (existing.method === 'cash' && existing.cashRegisterId) {
          await tx.cashRegister.update({
            where: { id: existing.cashRegisterId },
            data: { balance: { increment: existing.amount } },
          })
        } else if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { balance: { increment: existing.amount } },
          })
        }
      }

      // Delete associated EffetCheques (they cascade on payment delete, but we do it explicitly for clarity)
      if (existing.effetsCheques.length > 0) {
        await tx.effetCheque.deleteMany({
          where: { paymentId: existing.id },
        })
      }

      // Delete accounting entries for this payment
      await tx.accountingEntry.deleteMany({
        where: { documentRef: existing.id },
      })

      // Delete PaymentLines (cascade handles this, but explicit for safety)
      await tx.paymentLine.deleteMany({
        where: { paymentId: existing.id },
      })

      // Finally delete the payment
      await tx.payment.delete({
        where: { id: existing.id },
      })
    })

    await auditLog(auth.userId, 'delete', 'Payment', id, existing, null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payment delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
