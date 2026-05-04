import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const DEFAULT_ROLES = [
  {
    name: 'direction',
    label: 'Direction',
    description: 'Accès lecture au tableau de bord, rapports et paramètres',
    isSystem: true,
    permissions: ['dashboard:read', 'reports:read', 'settings:read', 'clients:read', 'delivery_notes:read'],
  },
  {
    name: 'commercial',
    label: 'Commercial',
    description: 'Gestion complète des ventes: devis, commandes, factures, livraisons',
    isSystem: true,
    permissions: [
      'clients:read', 'clients:write', 'products:read', 'quotes:read', 'quotes:write',
      'sales_orders:read', 'sales_orders:write', 'invoices:read', 'invoices:write',
      'credit_notes:read', 'credit_notes:write', 'delivery_notes:read', 'delivery_notes:write',
    ],
  },
  {
    name: 'buyer',
    label: 'Acheteur',
    description: 'Gestion des achats: fournisseurs, commandes, réceptions',
    isSystem: true,
    permissions: ['suppliers:read', 'suppliers:write', 'purchase_orders:read', 'purchase_orders:write', 'receptions:read', 'receptions:write', 'products:read', 'clients:read'],
  },
  {
    name: 'storekeeper',
    label: 'Magasinier',
    description: 'Gestion du stock et des préparations de commandes',
    isSystem: true,
    permissions: ['products:read', 'stock:read', 'stock:write', 'preparations:read', 'preparations:write', 'receptions:read', 'clients:read', 'delivery_notes:read', 'delivery_notes:write'],
  },
  {
    name: 'prod_manager',
    label: 'Resp. Production',
    description: 'Gestion de la production: ordres de fabrication, nomenclatures, gammes',
    isSystem: true,
    permissions: ['production:read', 'production:write', 'work_orders:read', 'work_orders:write', 'bom:read', 'bom:write', 'routing:read', 'routing:write', 'workstations:read', 'workstations:write', 'clients:read'],
  },
  {
    name: 'operator',
    label: 'Opérateur',
    description: 'Consultation des ordres de fabrication et production',
    isSystem: true,
    permissions: ['work_orders:read', 'production:read'],
  },
  {
    name: 'accountant',
    label: 'Comptable',
    description: 'Gestion comptable: factures, paiements, banque, caisse, comptabilité',
    isSystem: true,
    permissions: [
      'invoices:read', 'invoices:write', 'payments:read', 'payments:write',
      'accounting:read', 'accounting:write', 'credit_notes:read', 'credit_notes:write',
      'bank:read', 'bank:write', 'cash:read', 'cash:write', 'clients:read',
    ],
  },
  {
    name: 'cashier',
    label: 'Caissier',
    description: 'Gestion de la caisse et des paiements',
    isSystem: true,
    permissions: ['cash:read', 'cash:write', 'payments:read', 'payments:write', 'clients:read'],
  },
]

// POST /api/roles/seed — Seed default roles (super_admin only, idempotent)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    let created = 0
    let skipped = 0

    for (const roleData of DEFAULT_ROLES) {
      const existing = await db.role.findUnique({ where: { name: roleData.name } })
      if (existing) {
        skipped++
        continue
      }

      await db.role.create({
        data: {
          name: roleData.name,
          label: roleData.label,
          description: roleData.description,
          isSystem: roleData.isSystem,
          permissions: {
            create: roleData.permissions.map(p => ({ permission: p })),
          },
        },
      })
      created++
    }

    // Also assign existing users to their matching roles
    const usersWithoutRole = await db.user.findMany({
      where: {
        roleId: null,
        role: { notIn: ['super_admin', 'admin'] },
      },
    })

    let assigned = 0
    for (const user of usersWithoutRole) {
      const role = await db.role.findFirst({ where: { name: user.role, isActive: true } })
      if (role) {
        await db.user.update({ where: { id: user.id }, data: { roleId: role.id } })
        assigned++
      }
    }

    return NextResponse.json({
      message: `Rôles initialisés: ${created} créés, ${skipped} existants, ${assigned} utilisateurs liés`,
      created,
      skipped,
      assigned,
    })
  } catch (error) {
    console.error('Seed roles error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
