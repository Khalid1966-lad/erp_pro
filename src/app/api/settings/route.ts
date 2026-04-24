import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission, auditLog } from '@/lib/auth'
import { z } from 'zod'

// GET - List settings + audit log list
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'settings:read')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') || 'settings' // settings | audit_log
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId') || ''
    const entity = searchParams.get('entity') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    if (view === 'audit_log') {
      const where: Record<string, unknown> = {}
      if (userId) where.userId = userId
      if (entity) where.entity = entity
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate)
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate)
      }

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.auditLog.count({ where }),
      ])

      return NextResponse.json({ logs, total, page, limit })
    }

    // Settings list
    const settings = await db.setting.findMany({
      orderBy: { key: 'asc' },
    })

    // Convert to key-value map
    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    return NextResponse.json({ settings, settingsMap })
  } catch (error) {
    console.error('Settings list error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create or update setting
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { key, value } = z.object({
      key: z.string().min(1),
      value: z.string(),
    }).parse(body)

    const existing = await db.setting.findUnique({ where: { key } })

    let setting
    if (existing) {
      setting = await db.setting.update({
        where: { key },
        data: { value },
      })
      await auditLog(auth.userId, 'update', 'Setting', key, { value: existing.value }, { value })
    } else {
      setting = await db.setting.create({
        data: { key, value },
      })
      await auditLog(auth.userId, 'create', 'Setting', key, null, { value })
    }

    return NextResponse.json(setting, { status: existing ? 200 : 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Settings create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update setting (admin only)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé - administrateur requis' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { settings } = z.object({
      settings: z.record(z.string(), z.string()),
    }).parse(body)

    // Batch update settings
    for (const [key, value] of Object.entries(settings)) {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    await auditLog(auth.userId, 'batch_update', 'Setting', undefined, null, settings)

    // Return updated settings
    const allSettings = await db.setting.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json({ settings: allSettings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 })
    }
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete setting (admin only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé - administrateur requis' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Clé requise' }, { status: 400 })
    }

    const existing = await db.setting.findUnique({ where: { key } })
    if (!existing) {
      return NextResponse.json({ error: 'Paramètre introuvable' }, { status: 404 })
    }

    await db.setting.delete({ where: { key } })
    await auditLog(auth.userId, 'delete', 'Setting', key, existing, null)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
