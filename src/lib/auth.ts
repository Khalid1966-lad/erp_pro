import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export interface AuthUser {
  userId: string
  email: string
  role: string
  name: string
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
      name: payload.name
    }
  } catch {
    return null
  }
}

export function createToken(payload: Record<string, string>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url')
  const secret = process.env.JWT_SECRET || 'erp-secret-key-change-in-production'
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
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
  if (user.role === 'admin') return true

  const rolePermissions: Record<string, string[]> = {
    direction: ['dashboard:read', 'reports:read', 'settings:read'],
    commercial: ['clients:read', 'clients:write', 'products:read', 'quotes:read', 'quotes:write', 'sales_orders:read', 'sales_orders:write', 'invoices:read', 'invoices:write', 'credit_notes:read', 'credit_notes:write'],
    buyer: ['suppliers:read', 'suppliers:write', 'purchase_orders:read', 'purchase_orders:write', 'receptions:read', 'receptions:write', 'products:read'],
    storekeeper: ['products:read', 'stock:read', 'stock:write', 'preparations:read', 'preparations:write', 'receptions:read'],
    prod_manager: ['production:read', 'production:write', 'work_orders:read', 'work_orders:write', 'bom:read', 'bom:write', 'routing:read', 'routing:write', 'workstations:read', 'workstations:write'],
    operator: ['work_orders:read', 'production:read'],
    accountant: ['invoices:read', 'invoices:write', 'payments:read', 'payments:write', 'accounting:read', 'accounting:write', 'credit_notes:read', 'credit_notes:write', 'bank:read', 'bank:write', 'cash:read', 'cash:write'],
    cashier: ['cash:read', 'cash:write', 'payments:read', 'payments:write']
  }

  const perms = rolePermissions[user.role] || []
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
