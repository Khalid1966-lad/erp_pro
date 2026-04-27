import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasPermission } from '@/lib/auth'
import { syncAllClientBalances, syncClientBalance } from '@/lib/client-balance'

export const maxDuration = 60

/**
 * POST /api/clients/sync-balances
 *
 * Sync all client balances and nbImpayes from actual transaction data.
 * Body (optional): { clientId?: string } — to sync a single client instead of all.
 *
 * Admin-only endpoint.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'admin')) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { clientId } = body as { clientId?: string }

    if (clientId) {
      // Sync single client
      const result = await syncClientBalance(clientId)
      return NextResponse.json({
        success: true,
        message: `Solde du client synchronisé`,
        clientId,
        balance: result.balance,
        nbImpayes: result.nbImpayes,
      })
    }

    // Sync all clients
    const result = await syncAllClientBalances()
    return NextResponse.json({
      success: true,
      message: `Synchronisation terminée: ${result.updated} clients mis à jour sur ${result.total}`,
      ...result,
    })
  } catch (error) {
    console.error('Client balance sync error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la synchronisation' }, { status: 500 })
  }
}
