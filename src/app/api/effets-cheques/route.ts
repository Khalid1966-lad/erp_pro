import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  paymentId: z.string().min(1),
  bankAccountId: z.string().optional(),
  type: z.enum(['cheque', 'effet']),
  numero: z.string().min(1),
  montant: z.number().positive(),
  beneficiaire: z.string().optional(),
  banqueEmettrice: z.string().optional(),
  dateEmission: z.string().datetime().optional(),
  dateEcheance: z.string().datetime().optional(),
  notes: z.string().optional(),
})

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['remettre_banque', 'valider', 'rejeter']),
  bankAccountId: z.string().optional(),
  dateRemiseBanque: z.string().datetime().optional(),
  dateValidation: z.string().datetime().optional(),
  dateRejet: z.string().datetime().optional(),
  causeRejet: z.string().optional(),
})

// GET - List effets/cheques
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const statut = searchParams.get('statut') || ''
    const type = searchParams.get('type') || ''
    const bankAccountId = searchParams.get('bankAccountId') || ''
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (statut) where.statut = statut
    if (type) where.type = type
    if (bankAccountId) where.bankAccountId = bankAccountId

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { beneficiaire: { contains: search, mode: 'insensitive' } },
      ]
    }

    const effets = await db.effetCheque.findMany({
      where,
      include: {
        payment: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        bankAccount: {
          select: { id: true, name: true, iban: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ effets })
  } catch (error) {
    console.error('Effets list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create effet/cheque
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Verify payment exists
    const payment = await db.payment.findUnique({
      where: { id: data.paymentId },
      include: { invoice: { select: { id: true, number: true } } },
    })
    if (!payment) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }

    const effet = await db.effetCheque.create({
      data: {
        paymentId: data.paymentId,
        bankAccountId: data.bankAccountId || null,
        type: data.type,
        numero: data.numero,
        montant: data.montant,
        beneficiaire: data.beneficiaire || null,
        banqueEmettrice: data.banqueEmettrice || null,
        dateEmission: data.dateEmission ? new Date(data.dateEmission) : new Date(),
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        notes: data.notes || null,
      },
      include: {
        payment: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        bankAccount: {
          select: { id: true, name: true, iban: true },
        },
      },
    })

    await auditLog(auth.userId, 'create', 'EffetCheque', effet.id, null, effet)
    return NextResponse.json(effet, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Effet create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Status transitions
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'payments:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, action, ...rest } = actionSchema.parse(body)

    const existing = await db.effetCheque.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                clientId: true,
                status: true,
                totalTTC: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        bankAccount: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Effet introuvable' }, { status: 404 })
    }

    let updated

    if (action === 'remettre_banque') {
      if (existing.statut !== 'en_attente') {
        return NextResponse.json({ error: 'Seul un effet en instance peut être remis à la banque' }, { status: 400 })
      }
      if (!rest.bankAccountId) {
        return NextResponse.json({ error: 'Compte bancaire requis' }, { status: 400 })
      }
      updated = await db.effetCheque.update({
        where: { id },
        data: {
          statut: 'remis_banque',
          bankAccountId: rest.bankAccountId,
          dateRemiseBanque: rest.dateRemiseBanque ? new Date(rest.dateRemiseBanque) : new Date(),
        },
        include: {
          payment: {
            include: {
              invoice: {
                select: {
                  id: true,
                  number: true,
                  client: { select: { id: true, name: true } },
                },
              },
            },
          },
          bankAccount: { select: { id: true, name: true, iban: true } },
        },
      })
    } else if (action === 'valider') {
      if (existing.statut !== 'remis_banque') {
        return NextResponse.json({ error: 'Seul un effet remis à la banque peut être validé' }, { status: 400 })
      }
      updated = await db.effetCheque.update({
        where: { id },
        data: {
          statut: 'valide',
          dateValidation: rest.dateValidation ? new Date(rest.dateValidation) : new Date(),
        },
        include: {
          payment: {
            include: {
              invoice: {
                select: {
                  id: true,
                  number: true,
                  client: { select: { id: true, name: true } },
                },
              },
            },
          },
          bankAccount: { select: { id: true, name: true, iban: true } },
        },
      })
    } else if (action === 'rejeter') {
      if (existing.statut !== 'remis_banque') {
        return NextResponse.json({ error: 'Seul un effet remis à la banque peut être rejeté' }, { status: 400 })
      }

      // ─── CRITICAL BUSINESS LOGIC: Reverse payment effects ───
      updated = await db.$transaction(async (tx) => {
        // 1. Update the effet status
        const effetUpdated = await tx.effetCheque.update({
          where: { id },
          data: {
            statut: 'rejete',
            dateRejet: rest.dateRejet ? new Date(rest.dateRejet) : new Date(),
            causeRejet: rest.causeRejet || null,
          },
          include: {
            payment: {
              include: {
                invoice: {
                  select: {
                    id: true,
                    number: true,
                    clientId: true,
                    status: true,
                    totalTTC: true,
                    client: { select: { id: true, name: true } },
                  },
                },
              },
            },
            bankAccount: true,
          },
        })

        const payment = effetUpdated.payment
        const montant = effetUpdated.montant

        // 2. Reverse client balance if this was a client_payment with an invoice
        if (payment.type === 'client_payment' && payment.invoice?.clientId) {
          await tx.client.update({
            where: { id: payment.invoice.clientId },
            data: { balance: { increment: montant } },
          })

          // Check if invoice should revert from 'paid' to 'validated'
          if (payment.invoiceId && payment.invoice.status === 'paid') {
            const allPayments = await tx.payment.findMany({
              where: { invoiceId: payment.invoiceId },
            })
            const validPayments = allPayments.filter((p: { id: string }) => p.id !== payment.id)
            const totalPaid = validPayments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

            if (totalPaid < payment.invoice.totalTTC) {
              await tx.invoice.update({
                where: { id: payment.invoiceId },
                data: { status: 'validated', paymentDate: null },
              })
            }
          }
        }

        // 3. Decrement bank account balance (money never actually entered)
        if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { balance: { decrement: montant } },
          })
        }

        // 4. Create accounting entry for the rejection
        await tx.accountingEntry.create({
          data: {
            label: `Rejet ${effetUpdated.type === 'cheque' ? 'chèque' : 'effet'} n°${effetUpdated.numero} - ${rest.causeRejet || 'sans motif'}`,
            account: '512000',
            debit: 0,
            credit: montant,
            documentRef: effetUpdated.id,
          },
        })

        return effetUpdated
      })

      await auditLog(auth.userId, 'update', 'EffetCheque', id, existing, updated)
      return NextResponse.json(updated)
    }

    await auditLog(auth.userId, 'update', 'EffetCheque', id, existing, updated)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Effet update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
