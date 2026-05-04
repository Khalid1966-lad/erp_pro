import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'

// GET /api/employee-functions — List all functions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const dropdown = searchParams.get('dropdown') === 'true'

    if (dropdown) {
      const functions = await db.employeeFunction.findMany({
        where: { isActive: true },
        select: { id: true, name: true, description: true, isCustom: true, isActive: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ functions })
    }

    const functions = await db.employeeFunction.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    })

    const formatted = functions.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      isCustom: f.isCustom,
      isActive: f.isActive,
      employeeCount: f._count.employees,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }))

    return NextResponse.json({ functions: formatted })
  } catch (error) {
    console.error('Employee functions list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/employee-functions — Create function
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    // Check uniqueness
    const existing = await db.employeeFunction.findUnique({
      where: { name: name.trim() },
    })
    if (existing) {
      return NextResponse.json({ error: 'Cette fonction existe déjà' }, { status: 409 })
    }

    const fn = await db.employeeFunction.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isCustom: true,
      },
    })

    await auditLog(auth.userId, 'create', 'EmployeeFunction', fn.id, null, fn)

    return NextResponse.json({
      id: fn.id,
      name: fn.name,
      description: fn.description,
      isCustom: fn.isCustom,
      isActive: fn.isActive,
      createdAt: fn.createdAt,
      updatedAt: fn.updatedAt,
    }, { status: 201 })
  } catch (error) {
    console.error('Employee function create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/employee-functions — Update function
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { id, name, description, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.employeeFunction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fonction introuvable' }, { status: 404 })
    }

    // Cannot modify predefined function names
    if (name && !existing.isCustom) {
      return NextResponse.json(
        { error: 'Impossible de modifier le nom d\'une fonction prédéfinie' },
        { status: 400 },
      )
    }

    // If name is being changed, check uniqueness
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.employeeFunction.findUnique({
        where: { name: name.trim() },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'Cette fonction existe déjà' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await db.employeeFunction.update({
      where: { id },
      data: updateData,
    })

    await auditLog(auth.userId, 'update', 'EmployeeFunction', id, existing, updated)

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isCustom: updated.isCustom,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
  } catch (error) {
    console.error('Employee function update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/employee-functions?id= — Delete function (custom only, no assigned employees)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.employeeFunction.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fonction introuvable' }, { status: 404 })
    }

    if (!existing.isCustom) {
      return NextResponse.json(
        { error: 'Les fonctions prédéfinies ne peuvent pas être supprimées' },
        { status: 400 },
      )
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer une fonction attribuée à des employés' },
        { status: 400 },
      )
    }

    await db.employeeFunction.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'EmployeeFunction', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Employee function delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
