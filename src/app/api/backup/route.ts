import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  exportDatabase,
  computeSchemaHash,
  createBackupData,
  trimBackups,
} from '@/lib/backup'

// Allow up to 2 minutes for backup creation on Vercel
export const maxDuration = 120

// ═══════════════════════════════════════════════════════════════
// GET /api/backup — List all backups
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Admin or super_admin only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — administrateur requis' }, { status: 403 })
  }

  try {
    // Import db inside handler as required
    const { db } = await import('@/lib/db')

    const backups = await db.backup.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        appVersion: true,
        schemaHash: true,
        originalSize: true,
        compressedSize: true,
        tablesInfo: true,
        isValid: true,
        createdBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json(backups)
  } catch (error) {
    console.error('[Backup] List error:', error)
    return NextResponse.json({ error: 'Erreur lors du chargement des sauvegardes' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/backup — Create a new backup
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Admin or super_admin only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — administrateur requis' }, { status: 403 })
  }

  try {
    // Import db inside handler as required
    const { db } = await import('@/lib/db')

    // Parse optional label from request body
    let label: string | undefined
    try {
      const body = await req.json()
      label = body.label || undefined
    } catch {
      // No body — label stays undefined
    }

    // 1. Export all data from database
    const { data, meta } = await exportDatabase(db)

    // 2. Compute schema hash
    const schemaHash = await computeSchemaHash()

    // 3. Compress backup data
    const { compressed, originalSize, compressedSize } = createBackupData({ data, meta })

    // 4. Enforce max 7 backups (trim oldest)
    await trimBackups(db, 7)

    // 5. Create backup record
    const backup = await db.backup.create({
      data: {
        label,
        appVersion: meta.version,
        schemaHash,
        dataCompressed: compressed,
        originalSize,
        compressedSize,
        tablesInfo: JSON.stringify(meta.tables),
        isValid: true,
        createdBy: auth.userId,
      },
    })

    return NextResponse.json({
      success: true,
      id: backup.id,
      label: backup.label,
      appVersion: backup.appVersion,
      schemaHash: backup.schemaHash,
      originalSize: backup.originalSize,
      compressedSize: backup.compressedSize,
      tablesInfo: backup.tablesInfo,
      createdAt: backup.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error('[Backup] Create error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création de la sauvegarde' }, { status: 500 })
  }
}
