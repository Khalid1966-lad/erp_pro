import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'
import { z } from 'zod'

// All available permissions organized by module
export const ALL_PERMISSIONS: Record<string, { label: string; permissions: string[] }> = {
  'Tableau de bord': { label: 'Tableau de bord', permissions: ['dashboard:read'] },
  'Rapports': { label: 'Rapports', permissions: ['reports:read'] },
  'Paramètres': { label: 'Paramètres', permissions: ['settings:read', 'settings:write'] },
  'Clients': { label: 'Clients', permissions: ['clients:read', 'clients:write'] },
  'Produits': { label: 'Produits', permissions: ['products:read', 'products:write'] },
  'Devis': { label: 'Devis', permissions: ['quotes:read', 'quotes:write'] },
  'Commandes clients': { label: 'Commandes clients', permissions: ['sales_orders:read', 'sales_orders:write'] },
  'Bons de livraison': { label: 'Bons de livraison', permissions: ['delivery_notes:read', 'delivery_notes:write'] },
  'Préparations': { label: 'Préparations', permissions: ['preparations:read', 'preparations:write'] },
  'Factures clients': { label: 'Factures clients', permissions: ['invoices:read', 'invoices:write'] },
  'Avoirs clients': { label: 'Avoirs clients', permissions: ['credit_notes:read', 'credit_notes:write'] },
  'Retours clients': { label: 'Retours clients', permissions: ['customer_returns:read', 'customer_returns:write'] },
  'Fournisseurs': { label: 'Fournisseurs', permissions: ['suppliers:read', 'suppliers:write'] },
  'Commandes fournisseurs': { label: 'Commandes fournisseurs', permissions: ['purchase_orders:read', 'purchase_orders:write'] },
  'Réceptions': { label: 'Réceptions', permissions: ['receptions:read', 'receptions:write'] },
  'Devis fournisseurs': { label: 'Devis fournisseurs', permissions: ['supplier_quotes:read', 'supplier_quotes:write'] },
  'Factures fournisseurs': { label: 'Factures fournisseurs', permissions: ['supplier_invoices:read', 'supplier_invoices:write'] },
  'Avoirs fournisseurs': { label: 'Avoirs fournisseurs', permissions: ['supplier_credit_notes:read', 'supplier_credit_notes:write'] },
  'Retours fournisseurs': { label: 'Retours fournisseurs', permissions: ['supplier_returns:read', 'supplier_returns:write'] },
  'Demandes de prix': { label: 'Demandes de prix', permissions: ['price_requests:read', 'price_requests:write'] },
  'Stock': { label: 'Stock', permissions: ['stock:read', 'stock:write'] },
  'Production': { label: 'Production', permissions: ['production:read', 'production:write'] },
  'Ordres de fabrication': { label: 'Ordres de fabrication', permissions: ['work_orders:read', 'work_orders:write'] },
  'Nomenclatures': { label: 'Nomenclatures', permissions: ['bom:read', 'bom:write'] },
  'Gammes': { label: 'Gammes', permissions: ['routing:read', 'routing:write'] },
  'Postes de travail': { label: 'Postes de travail', permissions: ['workstations:read', 'workstations:write'] },
  'Paiements': { label: 'Paiements', permissions: ['payments:read', 'payments:write'] },
  'Banque': { label: 'Banque', permissions: ['bank:read', 'bank:write'] },
  'Caisse': { label: 'Caisse', permissions: ['cash:read', 'cash:write'] },
  'Comptabilité': { label: 'Comptabilité', permissions: ['accounting:read', 'accounting:write'] },
  'Effets & Chèques': { label: 'Effets & Chèques', permissions: ['effets_cheques:read', 'effets_cheques:write'] },
}

// Flatten for easy lookup
export const ALL_PERMISSION_FLAT: string[] = Object.values(ALL_PERMISSIONS).flatMap(m => m.permissions)

const roleSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').regex(/^[a-z_]+$/, 'Le nom doit être en minuscules (lettres et _ seulement)'),
  label: z.string().min(1, 'Le libellé est requis'),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

// GET - List all roles with their permissions
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const roles = await db.role.findMany({
      include: {
        permissions: { select: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { label: 'asc' },
    })

    const formatted = roles.map(r => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      permissions: r.permissions.map(p => p.permission),
      userCount: r._count.users,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json({ roles: formatted })
  } catch (error) {
    console.error('Roles list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create a new role
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = roleSchema.parse(body)

    // Validate all permissions are known
    const invalidPerms = data.permissions.filter(p => !ALL_PERMISSION_FLAT.includes(p))
    if (invalidPerms.length > 0) {
      return NextResponse.json({ error: 'Permissions invalides', details: invalidPerms }, { status: 400 })
    }

    // Check uniqueness
    const existing = await db.role.findUnique({ where: { name: data.name } })
    if (existing) {
      return NextResponse.json({ error: 'Ce rôle existe déjà' }, { status: 409 })
    }

    const role = await db.role.create({
      data: {
        name: data.name,
        label: data.label,
        description: data.description,
        permissions: {
          create: data.permissions.map(p => ({ permission: p })),
        },
      },
      include: { permissions: { select: { permission: true } } },
    })

    await auditLog(auth.userId, 'create', 'Role', role.id, null, role)

    return NextResponse.json({
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map(p => p.permission),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Role create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update a role (permissions or label)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, label, description, permissions, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 })
    }

    // Validate permissions if provided
    if (permissions && Array.isArray(permissions)) {
      const invalidPerms = permissions.filter((p: string) => !ALL_PERMISSION_FLAT.includes(p))
      if (invalidPerms.length > 0) {
        return NextResponse.json({ error: 'Permissions invalides', details: invalidPerms }, { status: 400 })
      }
    }

    // Update role
    const updateData: Record<string, unknown> = {}
    if (label !== undefined) updateData.label = label
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    if (Object.keys(updateData).length > 0) {
      await db.role.update({ where: { id }, data: updateData })
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing and recreate
      await db.rolePermission.deleteMany({ where: { roleId: id } })
      if (permissions.length > 0) {
        await db.rolePermission.createMany({
          data: permissions.map((p: string) => ({ roleId: id, permission: p })),
        })
      }
    }

    const updated = await db.role.findUnique({
      where: { id },
      include: { permissions: { select: { permission: true } } },
    })

    await auditLog(auth.userId, 'update', 'Role', id, existing, updated)

    return NextResponse.json({
      id: updated!.id,
      name: updated!.name,
      label: updated!.label,
      description: updated!.description,
      isSystem: updated!.isSystem,
      isActive: updated!.isActive,
      permissions: updated!.permissions.map(p => p.permission),
    })
  } catch (error) {
    console.error('Role update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete a custom role (not system roles)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 })
    }

    if (existing.isSystem) {
      return NextResponse.json({ error: 'Les rôles système ne peuvent pas être supprimés' }, { status: 400 })
    }

    if (existing._count.users > 0) {
      return NextResponse.json({ error: 'Impossible de supprimer un rôle attribué à des utilisateurs' }, { status: 400 })
    }

    await db.role.delete({ where: { id } })
    await auditLog(auth.userId, 'delete', 'Role', id, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Role delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
