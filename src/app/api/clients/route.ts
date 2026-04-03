import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { clientCreateSchema } from '@/lib/validations/client'
import { Prisma } from '@prisma/client'

// GET /api/clients — List with pagination and filters
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:read') && !hasPermission(auth, 'clients:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))
    const statut = searchParams.get('statut')
    const categorie = searchParams.get('categorie')
    const formeJuridique = searchParams.get('formeJuridique')
    const ville = searchParams.get('ville')
    const typeSociete = searchParams.get('typeSociete')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: Prisma.ClientWhereInput = {
      isDeleted: false,
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { nomCommercial: { contains: search, mode: 'insensitive' } },
        { ice: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { ville: { contains: search, mode: 'insensitive' } },
        { telephone: { contains: search } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filters
    if (statut) where.statut = statut as Prisma.EnumStatutClientFilter
    if (categorie) where.categorie = categorie as Prisma.EnumCategorieClientFilter
    if (formeJuridique) where.formeJuridique = formeJuridique as Prisma.EnumFormeJuridiqueFilter
    if (typeSociete) where.typeSociete = typeSociete
    if (ville) where.ville = { contains: ville, mode: 'insensitive' }

    // Build orderBy
    const validSortFields = [
      'createdAt', 'updatedAt', 'raisonSociale', 'ville', 'ice',
      'caTotalHT', 'nbCommandes', 'balance', 'statut', 'categorie',
      'name',
    ]
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const orderBy: Prisma.ClientOrderByWithRelationInput = {
      [orderByField]: sortOrder === 'asc' ? 'asc' : 'desc',
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          raisonSociale: true,
          nomCommercial: true,
          ice: true,
          email: true,
          telephone: true,
          gsm: true,
          ville: true,
          formeJuridique: true,
          typeSociete: true,
          statut: true,
          categorie: true,
          balance: true,
          seuilCredit: true,
          caTotalHT: true,
          nbCommandes: true,
          conditionsPaiement: true,
          alerteImpaye: true,
          nbImpayes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.client.count({ where }),
    ])

    // Summary stats
    const stats = await db.client.groupBy({
      by: ['statut'],
      where: { isDeleted: false },
      _count: { id: true },
    })

    const statutCounts: Record<string, number> = {}
    for (const s of stats) {
      statutCounts[s.statut] = s._count.id
    }

    return NextResponse.json({
      clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statutCounts,
    })
  } catch (error) {
    console.error('Clients list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/clients — Create client
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'client:create') && !hasPermission(auth, 'clients:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = clientCreateSchema.parse(body)

    // Check ICE uniqueness
    const existingIce = await db.client.findUnique({ where: { ice: data.ice } })
    if (existingIce) {
      return NextResponse.json(
        { error: 'Un client avec cet ICE existe déjà', field: 'ice' },
        { status: 409 }
      )
    }

    // Check email uniqueness
    if (data.email) {
      const existingEmail = await db.client.findUnique({ where: { email: data.email } })
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Un client avec cet email existe déjà', field: 'email' },
          { status: 409 }
        )
      }
    }

    // Map date strings to Date objects
    const createData: Record<string, unknown> = { ...data }
    if (data.dateCreation) createData.dateCreation = new Date(data.dateCreation)

    // Auto-populate legacy fields from new Moroccan fields
    if (!createData.name && createData.raisonSociale) {
      createData.name = createData.raisonSociale
    }
    if (!createData.address && createData.adresse) {
      createData.address = createData.adresse
    }
    if (!createData.city && createData.ville) {
      createData.city = createData.ville
    }
    if (!createData.postalCode && createData.codePostal) {
      createData.postalCode = createData.codePostal
    }
    if (!createData.phone && createData.telephone) {
      createData.phone = createData.telephone
    }
    if (!createData.creditLimit && createData.seuilCredit) {
      createData.creditLimit = createData.seuilCredit
    }
    if (!createData.paymentTerms && createData.conditionsPaiement) {
      createData.paymentTerms = createData.conditionsPaiement
    }

    const client = await db.client.create({
      data: {
        ...createData,
        createdBy: auth.userId,
      },
    })

    await auditLog(auth.userId, 'create', 'Client', client.id, null, client)

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    const zodErr = error as { errors?: Array<{ message: string; path: (string | number)[] }> }
    if (zodErr.errors && zodErr.errors.length > 0) {
      return NextResponse.json(
        { error: 'Données invalides', details: zodErr.errors },
        { status: 400 }
      )
    }
    console.error('Client create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
