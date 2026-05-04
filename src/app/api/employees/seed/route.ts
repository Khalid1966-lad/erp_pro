import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const PREDEFINED_FUNCTIONS = [
  'Commercial',
  'Chef de production',
  'Opérateur de production',
  'Magasinier',
  'Responsable qualité',
  'Comptable',
  'Caissier',
  'Agent de sécurité',
  'Chauffeur',
  'Chef d\'atelier',
  'Technicien de maintenance',
  'Responsable logistique',
  'Directeur usine',
  'Responsable achats',
  'Secrétaire',
  'Manutentionnaire',
  'Contrôleur qualité',
  'Chef d\'équipe',
  'Électricien',
  'Mécanicien',
  'Préparateur de commandes',
  'Conducteur de ligne',
  'Agent d\'entretien',
]

// POST /api/employees/seed — Seed predefined employee functions (super_admin only, idempotent)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    let created = 0
    let skipped = 0

    for (const name of PREDEFINED_FUNCTIONS) {
      const existing = await db.employeeFunction.findUnique({
        where: { name },
      })
      if (existing) {
        skipped++
        continue
      }

      await db.employeeFunction.create({
        data: {
          name,
          isCustom: false,
          isActive: true,
        },
      })
      created++
    }

    return NextResponse.json({
      message: `Fonctions employés initialisées: ${created} créées, ${skipped} existantes`,
      created,
      skipped,
      total: PREDEFINED_FUNCTIONS.length,
    })
  } catch (error) {
    console.error('Seed employee functions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
