import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const bankAccountSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  iban: z.string().min(1, 'L\'IBAN est requis'),
  bic: z.string().optional(),
})

const bankTransactionSchema = z.object({
  bankAccountId: z.string(),
  date: z.string().datetime(),
  label: z.string().min(1, 'Le libellé est requis'),
  amount: z.number(),
  reference: z.string().optional(),
  isReconciled: z.boolean().default(false),
  reconciledWith: z.string().optional(),
})

// GET - List bank accounts and transactions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bank:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'accounts' // accounts | transactions
    const bankAccountId = searchParams.get('bankAccountId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (view === 'transactions') {
      const where: Record<string, unknown> = {}
      if (bankAccountId) where.bankAccountId = bankAccountId

      const [transactions, total] = await Promise.all([
        db.bankTransaction.findMany({
          where,
          include: {
            bankAccount: { select: { id: true, name: true, iban: true } },
          },
          orderBy: { date: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.bankTransaction.count({ where }),
      ])

      return NextResponse.json({ transactions, total, page, limit })
    }

    // List accounts
    const accounts = await db.bankAccount.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { bankTransactions: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Bank list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create bank account or transaction
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bank:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { entityType } = body

    // Create bank account
    if (entityType === 'account') {
      const { name, iban, bic } = bankAccountSchema.parse(body)

      const account = await db.bankAccount.create({
        data: { name, iban, bic },
      })

      await auditLog(auth.userId, 'create', 'BankAccount', account.id, null, account)
      return NextResponse.json(account, { status: 201 })
    }

    // Create bank transaction
    const data = bankTransactionSchema.parse(body)

    const account = await db.bankAccount.findUnique({
      where: { id: data.bankAccountId },
    })
    if (!account) {
      return NextResponse.json({ error: 'Compte bancaire introuvable' }, { status: 404 })
    }

    if (!account.isActive) {
      return NextResponse.json({ error: 'Ce compte est désactivé' }, { status: 400 })
    }

    const [transaction] = await db.$transaction([
      db.bankTransaction.create({
        data: {
          bankAccountId: data.bankAccountId,
          date: new Date(data.date),
          label: data.label,
          amount: data.amount,
          reference: data.reference,
          isReconciled: data.isReconciled,
          reconciledWith: data.reconciledWith,
        },
        include: { bankAccount: true },
      }),
      db.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: { increment: data.amount } },
      }),
    ])

    await auditLog(auth.userId, 'create', 'BankTransaction', transaction.id, null, transaction)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Bank create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update bank account or transaction
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bank:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, entityType, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Update bank account
    if (entityType === 'account') {
      const existing = await db.bankAccount.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: 'Compte bancaire introuvable' }, { status: 404 })
      }

      const data = bankAccountSchema.partial().parse(updateData)
      const account = await db.bankAccount.update({ where: { id }, data })

      await auditLog(auth.userId, 'update', 'BankAccount', id, existing, account)
      return NextResponse.json(account)
    }

    // Update bank transaction
    const existing = await db.bankTransaction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })
    }

    const data = bankTransactionSchema.partial().omit({ bankAccountId: true }).parse(updateData)

    // If amount changed, adjust balance within a transaction
    if (updateData.amount !== undefined && updateData.amount !== existing.amount) {
      const diff = updateData.amount - existing.amount
      const [transaction] = await db.$transaction([
        db.bankTransaction.update({
          where: { id },
          data: {
            ...data,
            date: data.date ? new Date(data.date) : undefined,
          },
          include: { bankAccount: true },
        }),
        db.bankAccount.update({
          where: { id: existing.bankAccountId },
          data: { balance: { increment: diff } },
        }),
      ])

      await auditLog(auth.userId, 'update', 'BankTransaction', id, existing, transaction)
      return NextResponse.json(transaction)
    }

    const transaction = await db.bankTransaction.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
      include: { bankAccount: true },
    })

    await auditLog(auth.userId, 'update', 'BankTransaction', id, existing, transaction)
    return NextResponse.json(transaction)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Bank update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete bank account or transaction
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'bank:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const entityType = searchParams.get('entityType') || 'transaction'

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    if (entityType === 'account') {
      const existing = await db.bankAccount.findUnique({
        where: { id },
        include: { bankTransactions: true },
      })
      if (!existing) {
        return NextResponse.json({ error: 'Compte bancaire introuvable' }, { status: 404 })
      }

      if (existing.bankTransactions.length > 0) {
        return NextResponse.json({ error: 'Impossible de supprimer un compte avec des transactions' }, { status: 400 })
      }

      await db.bankAccount.delete({ where: { id } })
      await auditLog(auth.userId, 'delete', 'BankAccount', id, existing, null)
      return NextResponse.json({ success: true })
    }

    const existing = await db.bankTransaction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })
    }

    // Reverse balance and delete transaction atomically
    await db.$transaction([
      db.bankAccount.update({
        where: { id: existing.bankAccountId },
        data: { balance: { decrement: existing.amount } },
      }),
      db.bankTransaction.delete({ where: { id } }),
    ])
    await auditLog(auth.userId, 'delete', 'BankTransaction', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bank delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
