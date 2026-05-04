import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import zlib from 'zlib'

export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════
// GET /api/backup/[id]/download — Download backup as .json.gz
// ═══════════════════════════════════════════════════════════════
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Admin or super_admin only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — administrateur requis' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Import db inside handler as required
    const { db } = await import('@/lib/db')

    // Find backup by ID
    const backup = await db.backup.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        appVersion: true,
        createdAt: true,
        dataCompressed: true,
      },
    })

    if (!backup) {
      return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 })
    }

    // Decode base64 → raw gzip binary (keep compressed for download)
    const gzipBuffer = Buffer.from(backup.dataCompressed, 'base64')

    // Generate filename with date
    const date = backup.createdAt
      ? new Date(backup.createdAt).toISOString().slice(0, 10)
      : 'unknown'
    const labelSlug = (backup.label || 'auto').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `gema-erp-backup-${labelSlug}-${date}.json.gz`

    return new Response(gzipBuffer, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(gzipBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('[Backup] Download error:', error)
    return NextResponse.json({ error: 'Erreur lors du téléchargement de la sauvegarde' }, { status: 500 })
  }
}
