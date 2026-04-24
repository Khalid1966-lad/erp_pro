import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { validateBackupFile, restoreDatabase } from '@/lib/backup'

// ═══════════════════════════════════════════════════════════════
// POST /api/backup/restore — Upload and restore a backup
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Admin or super_admin only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — administrateur requis' }, { status: 403 })
  }

  try {
    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant — veuillez fournir un fichier .json.gz' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.json.gz')) {
      return NextResponse.json(
        { error: 'Format de fichier invalide — seul .json.gz est accepté' },
        { status: 400 }
      )
    }

    // Read file into buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Step 1: Validate the backup file
    const validation = await validateBackupFile(fileBuffer)

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        message: 'Fichier de sauvegarde invalide',
        errors: validation.errors,
        warnings: validation.warnings,
      }, { status: 400 })
    }

    // Step 2: Decompress and extract data for restore
    const zlib = await import('zlib')
    const jsonBuffer = zlib.gunzipSync(fileBuffer)
    const parsed = JSON.parse(jsonBuffer.toString('utf-8'))
    const data: Record<string, any[]> = parsed.data

    // Step 3: Restore database
    // Import db inside handler as required
    const { db } = await import('@/lib/db')
    await restoreDatabase(db, data)

    return NextResponse.json({
      success: true,
      message: 'Restauration terminée avec succès',
      meta: validation.meta,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    })
  } catch (error) {
    console.error('[Backup] Restore error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la restauration', details: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
