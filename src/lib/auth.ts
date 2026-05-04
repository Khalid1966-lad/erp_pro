import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export interface AuthUser {
  userId: string
  email: string
  role: string
  name: string
  permissions?: string[] // Will be populated from JWT
}

// ── Backward-compatible permission aliases ──
// Old composite permissions automatically grant access to their new individual sub-permissions
const PERMISSION_EXPANSIONS: Record<string, string[]> = {
  'stock:read': ['stock_movements:read', 'stock_alerts:read', 'inventory:read', 'stock_lots:read'],
  'stock:write': ['stock_movements:write', 'stock_alerts:write', 'inventory:write', 'stock_lots:write'],
  'production:read': ['work_orders:read', 'equipments:read', 'maintenance:read', 'quality_control:read'],
  'production:write': ['work_orders:write', 'equipments:write', 'maintenance:write', 'quality_control:write'],
  'purchase_orders:read': ['price_requests:read', 'supplier_quotes:read', 'supplier_returns:read', 'supplier_credit_notes:read', 'supplier_invoices:read'],
  'purchase_orders:write': ['price_requests:write', 'supplier_quotes:write', 'supplier_returns:write', 'supplier_credit_notes:write', 'supplier_invoices:write'],
  'delivery_notes:read': ['customer_returns:read'],
  'delivery_notes:write': ['customer_returns:write'],
  'payments:read': ['effets_cheques:read'],
  'payments:write': ['effets_cheques:write'],
  'accounting:read': ['financial_reports:read'],
  'accounting:write': ['financial_reports:write'],
  'work_orders:read': ['equipments:read', 'maintenance:read', 'quality_control:read'],
  'work_orders:write': ['equipments:write', 'maintenance:write', 'quality_control:write'],
}

/**
 * Expand permissions: old composite keys automatically include new sub-permissions.
 * e.g. if user has `stock:read`, they also get `stock_movements:read`, `stock_alerts:read`, etc.
 */
function expandPermissions(perms: string[]): string[] {
  const expanded = new Set(perms)
  for (const perm of perms) {
    const expansions = PERMISSION_EXPANSIONS[perm]
    if (expansions) {
      expansions.forEach(p => expanded.add(p))
    }
  }
  return Array.from(expanded)
}

// Hardcoded fallback permissions (used when DB is not available or for legacy roles)
const hardcodedPermissions: Record<string, string[]> = {
  direction: ['dashboard:read', 'reports:read', 'settings:read', 'clients:read', 'delivery_notes:read', 'invoices:read', 'accounting:read'],
  commercial: [
    'clients:read', 'clients:write',
    'products:read', 'quotes:read', 'quotes:write',
    'sales_orders:read', 'sales_orders:write',
    'invoices:read', 'invoices:write',
    'credit_notes:read', 'credit_notes:write',
    'delivery_notes:read', 'delivery_notes:write',
    'preparations:read', 'preparations:write',
    'customer_returns:read', 'customer_returns:write',
  ],
  buyer: ['suppliers:read', 'suppliers:write', 'purchase_orders:read', 'purchase_orders:write', 'receptions:read', 'receptions:write', 'products:read', 'clients:read', 'price_requests:read', 'price_requests:write', 'supplier_quotes:read', 'supplier_quotes:write', 'supplier_returns:read', 'supplier_returns:write', 'supplier_credit_notes:read', 'supplier_credit_notes:write', 'supplier_invoices:read', 'supplier_invoices:write'],
  storekeeper: ['products:read', 'stock:read', 'stock:write', 'stock_movements:read', 'stock_alerts:read', 'inventory:read', 'stock_lots:read', 'preparations:read', 'preparations:write', 'receptions:read', 'clients:read', 'delivery_notes:read', 'delivery_notes:write', 'customer_returns:read', 'customer_returns:write'],
  prod_manager: ['production:read', 'production:write', 'work_orders:read', 'work_orders:write', 'bom:read', 'bom:write', 'routing:read', 'routing:write', 'workstations:read', 'workstations:write', 'equipments:read', 'equipments:write', 'maintenance:read', 'maintenance:write', 'quality_control:read', 'quality_control:write', 'clients:read'],
  operator: ['work_orders:read', 'production:read', 'equipments:read', 'maintenance:read', 'quality_control:read'],
  accountant: [
    'invoices:read', 'invoices:write', 'payments:read', 'payments:write',
    'accounting:read', 'accounting:write', 'financial_reports:read', 'financial_reports:write',
    'credit_notes:read', 'credit_notes:write',
    'bank:read', 'bank:write', 'cash:read', 'cash:write',
    'effets_cheques:read', 'effets_cheques:write',
    'clients:read',
  ],
  cashier: ['cash:read', 'cash:write', 'payments:read', 'payments:write', 'effets_cheques:read', 'effets_cheques:write', 'clients:read'],
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [header, body, sig] = token.split('.')
    const secret = process.env.JWT_SECRET || 'erp-secret-key-change-in-production'
    const expectedSig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
    if (sig !== expectedSig) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      permissions: payload.permissions || undefined,
    }
  } catch {
    return null
  }
}

export function createToken(payload: Record<string, string | string[]>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url')
  const secret = process.env.JWT_SECRET || 'erp-secret-key-change-in-production'
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

// Fetch permissions for a role from DB (expanded for backward compatibility)
export async function getPermissionsForUser(userId: string, roleName: string): Promise<string[]> {
  // Super admin and admin have all permissions
  if (roleName === 'super_admin' || roleName === 'admin') {
    return ['*']
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { roleId: true, roleObj: { include: { permissions: { select: { permission: true } } } } },
    })
    const dbPerms = user?.roleObj?.permissions.map(p => p.permission) || []
    if (dbPerms.length > 0) return expandPermissions(dbPerms)
  } catch {
    // DB query failed, fall through to hardcoded
  }

  // Fallback: hardcoded permissions (already expanded)
  const fallback = hardcodedPermissions[roleName] || []
  return expandPermissions(fallback)
}

export async function getUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

export async function requireAuth(req: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  return user
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  // Super admin has all permissions
  if (user.role === 'super_admin') return true
  // Admin has all permissions
  if (user.role === 'admin') return true

  // Get permissions from JWT (loaded from DB at login time) or fallback to hardcoded
  const rawPerms = user.permissions || hardcodedPermissions[user.role] || []

  // Expand permissions for backward compatibility
  const perms = expandPermissions(rawPerms)

  // Wildcard means all permissions
  if (perms.includes('*')) return true

  return perms.includes(permission) || perms.includes(permission.replace(':write', ':read'))
}

export async function auditLog(userId: string, action: string, entity: string, entityId?: string, oldValues?: unknown, newValues?: unknown) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null
      }
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
