import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

const cashRegisterSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  minBalance: z.number().default(0),
})

const cashMovementSchema = z.object({
  cashRegisterId: z.string(),
  type: z.enum(['in', 'out']),
  amount: z.number().min(0.01),
  paymentMethod: z.string().default('espèces'),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// GET - List cash registers and movements
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'cash:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'registers' // registers | movements
    const cashRegisterId = searchParams.get('cashRegisterId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (view === 'movements') {
      const where: Record<string, unknown> = {}
      if (cashRegisterId) where.cashRegisterId = cashRegisterId

      const [movements, total] = await Promise.all([
        db.cashMovement.findMany({
          where,
          include: {
            cashRegister: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.cashMovement.count({ where }),
      ])

      return NextResponse.json({ movements, total, page, limit })
    }

    // List registers
    const registers = await db.cashRegister.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { cashMovements: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ registers })
  } catch (error) {
    console.error('Cash list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create cash register or movement
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'cash:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { entityType } = body

    // Create cash register
    if (entityType === 'register') {
      const { name, description, minBalance } = cashRegisterSchema.parse(body)

      const register = await db.cashRegister.create({
        data: { name, description, minBalance },
      })

      await auditLog(auth.userId, 'create', 'CashRegister', register.id, null, register)
      return NextResponse.json(register, { status: 201 })
    }

    // Create cash movement
    const data = cashMovementSchema.parse(body)

    const register = await db.cashRegister.findUnique({
      where: { id: data.cashRegisterId },
    })
    if (!register) {
      return NextResponse.json({ error: 'Caisse introuvable' }, { status: 404 })
    }

    if (!register.isActive) {
      return NextResponse.json({ error: 'Cette caisse est désactivée' }, { status: 400 })
    }

    // Check balance for out movements
    if (data.type === 'out' && register.balance < data.amount) {
      return NextResponse.json({
        error: `Solde insuffisant (solde: ${register.balance})`,
      }, { status: 400 })
    }

    // Create movement and update register balance
    const balanceChange = data.type === 'in' ? data.amount : -data.amount

    const [movement] = await db.$transaction([
      db.cashMovement.create({
        data: {
          cashRegisterId: data.cashRegisterId,
          type: data.type,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reference: data.reference,
          notes: data.notes,
        },
        include: { cashRegister: true },
      }),
      db.cashRegister.update({
        where: { id: data.cashRegisterId },
        data: { balance: { increment: balanceChange } },
      }),
    ])

    await auditLog(auth.userId, 'create', 'CashMovement', movement.id, null, movement)
    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Cash create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update cash register
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'cash:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.cashRegister.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Caisse introuvable' }, { status: 404 })
    }

    const data = cashRegisterSchema.partial().parse(updateData)
    const register = await db.cashRegister.update({ where: { id }, data })

    await auditLog(auth.userId, 'update', 'CashRegister', id, existing, register)
    return NextResponse.json(register)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Cash update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete cash register
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'cash:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.cashRegister.findUnique({
      where: { id },
      include: { cashMovements: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Caisse introuvable' }, { status: 404 })
    }

    if (existing.cashMovements.length > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer une caisse avec des mouvements' }, { status: 400 })
    }

    await db.cashRegister.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'CashRegister', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cash delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
