import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

// ═══════════════════════════════════════════════════════════════
// DELETE /api/backup/[id] — Delete a backup
// ═══════════════════════════════════════════════════════════════
export async function DELETE(
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

    // Check if backup exists
    const existing = await db.backup.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 })
    }

    // Delete the backup
    await db.backup.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Sauvegarde supprimée' })
  } catch (error) {
    console.error('[Backup] Delete error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression de la sauvegarde' }, { status: 500 })
  }
}
