import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const accountingEntrySchema = z.object({
  date: z.string().datetime().optional(),
  label: z.string().min(1, 'Le libellé est requis'),
  account: z.string().min(1, 'Le compte est requis'),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  documentRef: z.string().optional(),
})

const batchEntrySchema = z.object({
  entries: z.array(accountingEntrySchema).min(2, 'Au moins 2 écritures requises (partie double)'),
  description: z.string().optional(),
})

// GET - List accounting entries
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'accounting:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const account = searchParams.get('account') || ''
    const documentRef = searchParams.get('documentRef') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (account) where.account = { contains: account }
    if (documentRef) where.documentRef = { contains: documentRef }
    if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate)
    }

    const [entries, total] = await Promise.all([
      db.accountingEntry.findMany({
        where,
        orderBy: { date: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.accountingEntry.count({ where }),
    ])

    // Calculate totals
    const totals = await db.accountingEntry.aggregate({
      _sum: { debit: true, credit: true },
    })

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      totals: {
        totalDebit: totals._sum.debit || 0,
        totalCredit: totals._sum.credit || 0,
        balance: (totals._sum.debit || 0) - (totals._sum.credit || 0),
      },
    })
  } catch (error) {
    console.error('Accounting entries list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create accounting entry or batch
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'accounting:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { batch } = body // batch = true for double-entry

    if (batch) {
      // Batch create - double-entry accounting
      const data = batchEntrySchema.parse(body)

      // Verify balanced entries (debit = credit)
      const totalDebit = data.entries.reduce((sum, e) => sum + e.debit, 0)
      const totalCredit = data.entries.reduce((sum, e) => sum + e.credit, 0)

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json({
          error: 'Les écritures ne sont pas équilibrées',
          details: { totalDebit, totalCredit, difference: totalDebit - totalCredit },
        }, { status: 400 })
      }

      const entries = await db.accountingEntry.createMany({
        data: data.entries.map((e) => ({
          date: e.date ? new Date(e.date) : new Date(),
          label: e.label,
          account: e.account,
          debit: e.debit,
          credit: e.credit,
          documentRef: e.documentRef,
        })),
      })

      await auditLog(auth.userId, 'create_batch', 'AccountingEntry', undefined, null, {
        description: data.description,
        count: entries.count,
        totalDebit,
        totalCredit,
      })

      return NextResponse.json({ success: true, count: entries.count }, { status: 201 })
    }

    // Single entry create
    const data = accountingEntrySchema.parse(body)

    const entry = await db.accountingEntry.create({
      data: {
        date: data.date ? new Date(data.date) : new Date(),
        label: data.label,
        account: data.account,
        debit: data.debit,
        credit: data.credit,
        documentRef: data.documentRef,
      },
    })

    await auditLog(auth.userId, 'create', 'AccountingEntry', entry.id, null, entry)
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Accounting entry create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete accounting entry
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'accounting:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.accountingEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Écriture comptable introuvable' }, { status: 404 })
    }

    await db.accountingEntry.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'AccountingEntry', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accounting entry delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
