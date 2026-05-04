import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET - Distinct familles for filter dropdown
export async function GET(req: Request) {
  const auth = await requireAuth(req as never)
  if (auth instanceof NextResponse) return auth

  try {
    const familles = await db.product.findMany({
      where: { famille: { not: null } },
      select: { famille: true },
      distinct: ['famille'],
      orderBy: { famille: 'asc' },
    })
    return NextResponse.json({
      familles: familles.map(f => f.famille).filter(Boolean) as string[]
    })
  } catch (error) {
    console.error('Familles fetch error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
