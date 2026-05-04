import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog, hasPermission } from '@/lib/auth'
import { z } from 'zod'

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  matricule: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  photoUrl: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  cinNumber: z.string().optional(),
  cnssNumber: z.string().optional(),
  dateEmbauche: z.string().optional(),
  dateDepart: z.string().optional(),
  fonctionId: z.string().optional(),
  department: z.string().optional(),
  salaryBase: z.number().optional(),
  notes: z.string().optional(),
})

// GET /api/employees — List employees
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'employees:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const fonctionId = searchParams.get('fonctionId')
    const isActiveParam = searchParams.get('isActive')
    const dropdown = searchParams.get('dropdown') === 'true'
    const commercial = searchParams.get('commercial') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Build where clause
    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { matricule: { contains: search } },
        { email: { contains: search } },
      ]
    }

    if (fonctionId) {
      where.fonctionId = fonctionId
    }

    if (isActiveParam !== null && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true'
    }

    // Commercial filter: only active employees whose function name contains "commercial"
    if (commercial) {
      where.isActive = true
      where.fonction = {
        name: { contains: 'commercial', mode: 'insensitive' },
      }
    }

    // Dropdown / Commercial mode: lightweight response
    if (dropdown || commercial) {
      const employees = await db.employee.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fonction: { select: { name: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      const formatted = employees.map(e => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        fonction: e.fonction ? { name: e.fonction.name } : null,
      }))

      return NextResponse.json(formatted)
    }

    // Full paginated response
    const skip = (page - 1) * limit

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          fonction: { select: { id: true, name: true } },
          _count: { select: { clientAssignments: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
    ])

    const formatted = employees.map(e => ({
      id: e.id,
      matricule: e.matricule,
      firstName: e.firstName,
      lastName: e.lastName,
      dateOfBirth: e.dateOfBirth,
      gender: e.gender,
      photoUrl: e.photoUrl,
      phone: e.phone,
      email: e.email,
      address: e.address,
      city: e.city,
      postalCode: e.postalCode,
      cinNumber: e.cinNumber,
      cnssNumber: e.cnssNumber,
      dateEmbauche: e.dateEmbauche,
      dateDepart: e.dateDepart,
      fonction: e.fonction,
      department: e.department,
      salaryBase: e.salaryBase,
      notes: e.notes,
      isActive: e.isActive,
      clientAssignmentCount: e._count.clientAssignments,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }))

    return NextResponse.json({
      employees: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Employees list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/employees — Create employee
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'employees:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createEmployeeSchema.parse(body)

    // If fonctionId provided, verify it exists and is active
    if (data.fonctionId) {
      const fonc = await db.employeeFunction.findUnique({
        where: { id: data.fonctionId },
      })
      if (!fonc || !fonc.isActive) {
        return NextResponse.json({ error: 'Fonction invalide ou inactive' }, { status: 400 })
      }
    }

    const employee = await db.employee.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        matricule: data.matricule?.trim() || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender?.trim() || null,
        photoUrl: data.photoUrl?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        cinNumber: data.cinNumber?.trim() || null,
        cnssNumber: data.cnssNumber?.trim() || null,
        dateEmbauche: data.dateEmbauche ? new Date(data.dateEmbauche) : null,
        dateDepart: data.dateDepart ? new Date(data.dateDepart) : null,
        fonctionId: data.fonctionId || null,
        department: data.department?.trim() || null,
        salaryBase: data.salaryBase ?? null,
        notes: data.notes?.trim() || null,
        createdBy: auth.userId,
        updatedBy: auth.userId,
      },
      include: {
        fonction: { select: { id: true, name: true } },
      },
    })

    await auditLog(auth.userId, 'create', 'Employee', employee.id, null, employee)

    return NextResponse.json({
      id: employee.id,
      matricule: employee.matricule,
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: employee.dateOfBirth,
      gender: employee.gender,
      photoUrl: employee.photoUrl,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      city: employee.city,
      postalCode: employee.postalCode,
      cinNumber: employee.cinNumber,
      cnssNumber: employee.cnssNumber,
      dateEmbauche: employee.dateEmbauche,
      dateDepart: employee.dateDepart,
      fonction: employee.fonction,
      department: employee.department,
      salaryBase: employee.salaryBase,
      notes: employee.notes,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Employee create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/employees — Update employee
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'employees:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    // If fonctionId provided, verify it exists and is active
    if (fields.fonctionId) {
      const fonc = await db.employeeFunction.findUnique({
        where: { id: fields.fonctionId },
      })
      if (!fonc || !fonc.isActive) {
        return NextResponse.json({ error: 'Fonction invalide ou inactive' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = { updatedBy: auth.userId }

    if (fields.firstName !== undefined) updateData.firstName = fields.firstName.trim()
    if (fields.lastName !== undefined) updateData.lastName = fields.lastName.trim()
    if (fields.matricule !== undefined) updateData.matricule = fields.matricule?.trim() || null
    if (fields.dateOfBirth !== undefined) updateData.dateOfBirth = fields.dateOfBirth ? new Date(fields.dateOfBirth) : null
    if (fields.gender !== undefined) updateData.gender = fields.gender?.trim() || null
    if (fields.photoUrl !== undefined) updateData.photoUrl = fields.photoUrl?.trim() || null
    if (fields.phone !== undefined) updateData.phone = fields.phone?.trim() || null
    if (fields.email !== undefined) updateData.email = fields.email?.trim() || null
    if (fields.address !== undefined) updateData.address = fields.address?.trim() || null
    if (fields.city !== undefined) updateData.city = fields.city?.trim() || null
    if (fields.postalCode !== undefined) updateData.postalCode = fields.postalCode?.trim() || null
    if (fields.cinNumber !== undefined) updateData.cinNumber = fields.cinNumber?.trim() || null
    if (fields.cnssNumber !== undefined) updateData.cnssNumber = fields.cnssNumber?.trim() || null
    if (fields.dateEmbauche !== undefined) updateData.dateEmbauche = fields.dateEmbauche ? new Date(fields.dateEmbauche) : null
    if (fields.dateDepart !== undefined) updateData.dateDepart = fields.dateDepart ? new Date(fields.dateDepart) : null
    if (fields.fonctionId !== undefined) updateData.fonctionId = fields.fonctionId || null
    if (fields.department !== undefined) updateData.department = fields.department?.trim() || null
    if (fields.salaryBase !== undefined) updateData.salaryBase = fields.salaryBase ?? null
    if (fields.notes !== undefined) updateData.notes = fields.notes?.trim() || null
    if (fields.isActive !== undefined) updateData.isActive = fields.isActive

    const updated = await db.employee.update({
      where: { id },
      data: updateData,
      include: {
        fonction: { select: { id: true, name: true } },
      },
    })

    await auditLog(auth.userId, 'update', 'Employee', id, existing, updated)

    return NextResponse.json({
      id: updated.id,
      matricule: updated.matricule,
      firstName: updated.firstName,
      lastName: updated.lastName,
      dateOfBirth: updated.dateOfBirth,
      gender: updated.gender,
      photoUrl: updated.photoUrl,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      city: updated.city,
      postalCode: updated.postalCode,
      cinNumber: updated.cinNumber,
      cnssNumber: updated.cnssNumber,
      dateEmbauche: updated.dateEmbauche,
      dateDepart: updated.dateDepart,
      fonction: updated.fonction,
      department: updated.department,
      salaryBase: updated.salaryBase,
      notes: updated.notes,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    })
  } catch (error) {
    console.error('Employee update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/employees?id= — Soft delete (set isActive: false)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé. Seul le super administrateur peut supprimer.' }, { status: 403 })
  }
  if (!hasPermission(auth, 'employees:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Employé introuvable' }, { status: 404 })
    }

    if (!existing.isActive) {
      return NextResponse.json({ error: 'Cet employé est déjà désactivé' }, { status: 400 })
    }

    const updated = await db.employee.update({
      where: { id },
      data: {
        isActive: false,
        dateDepart: existing.dateDepart || new Date(),
        updatedBy: auth.userId,
      },
    })

    await auditLog(auth.userId, 'delete', 'Employee', id, existing, updated)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Employee delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
