import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, auditLog } from '@/lib/auth'

const MAX_AVATAR_SIZE_BYTES = 500 * 1024 // 500 KB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Validate a base64 data URI avatar string.
 * Returns the decoded byte size on success, or an error NextResponse.
 */
function validateAvatarDataUri(avatarUrl: string): number | NextResponse {
  // Must be a data URI
  if (!avatarUrl.startsWith('data:image/')) {
    return NextResponse.json(
      { error: "Format invalide — l'avatar doit être une image au format data URI (data:image/...)" },
      { status: 400 }
    )
  }

  // Extract the MIME type from the data URI (e.g. "data:image/jpeg;base64,...")
  const mimeMatch = avatarUrl.match(/^data:(image\/[a-z]+);base64,/)
  if (!mimeMatch) {
    return NextResponse.json(
      { error: "Format data URI invalide — type MIME manquant" },
      { status: 400 }
    )
  }

  const mimeType = mimeMatch[1]

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Type d'image non autorisé (${mimeType}). Formats acceptés : JPEG, PNG, WebP` },
      { status: 400 }
    )
  }

  // Extract the base64 payload after the comma
  const base64Prefix = `data:${mimeType};base64,`
  const base64Data = avatarUrl.slice(base64Prefix.length)

  if (!base64Data) {
    return NextResponse.json(
      { error: "Data URI vide — aucune donnée image trouvée" },
      { status: 400 }
    )
  }

  // Decode to get the actual byte size
  let byteSize: number
  try {
    byteSize = Buffer.byteLength(base64Data, 'base64')
  } catch {
    return NextResponse.json(
      { error: "Données base64 invalides" },
      { status: 400 }
    )
  }

  if (byteSize > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Image trop volumineuse (${Math.round(byteSize / 1024)} Ko). Taille maximale : 500 Ko` },
      { status: 400 }
    )
  }

  return byteSize
}

// PUT /api/users/avatar — Upload or update user avatar
// Body: { userId?: string, avatarUrl: string }
//   - If userId is omitted, updates the authenticated user's own avatar
//   - If userId is provided, only super_admin can update another user's avatar
//   - avatarUrl must be a base64 data URI (data:image/jpeg;base64,...)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { userId: targetUserId, avatarUrl } = body

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json(
        { error: "avatarUrl est requis et doit être une chaîne (data URI base64)" },
        { status: 400 }
      )
    }

    // Determine target user — self by default, or a specific user if super_admin
    const isSelfUpdate = !targetUserId || targetUserId === auth.userId
    const targetId = targetUserId || auth.userId

    // Authorization: only self or super_admin
    if (!isSelfUpdate && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès refusé — vous ne pouvez modifier que votre propre avatar' },
        { status: 403 }
      )
    }

    // Validate the avatar data URI
    const validationResult = validateAvatarDataUri(avatarUrl)
    if (validationResult instanceof NextResponse) return validationResult

    // Verify the target user exists
    const targetUser = await db.user.findUnique({ where: { id: targetId } })
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Update the avatar
    await db.user.update({
      where: { id: targetId },
      data: { avatarUrl },
    })

    await auditLog(
      auth.userId,
      isSelfUpdate ? 'update_avatar' : 'update_user_avatar',
      'User',
      targetId,
      { avatarUrl: targetUser.avatarUrl || null },
      { avatarUrl }
    )

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/users/avatar — Remove user avatar
// Body: { userId?: string }
//   - If userId is omitted, removes the authenticated user's own avatar
//   - If userId is provided, only super_admin can remove another user's avatar
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { userId: targetUserId } = body

    // Determine target user
    const isSelfUpdate = !targetUserId || targetUserId === auth.userId
    const targetId = targetUserId || auth.userId

    // Authorization: only self or super_admin
    if (!isSelfUpdate && auth.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès refusé — vous ne pouvez modifier que votre propre avatar' },
        { status: 403 }
      )
    }

    // Verify the target user exists
    const targetUser = await db.user.findUnique({ where: { id: targetId } })
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Remove the avatar
    await db.user.update({
      where: { id: targetId },
      data: { avatarUrl: null },
    })

    await auditLog(
      auth.userId,
      isSelfUpdate ? 'delete_avatar' : 'delete_user_avatar',
      'User',
      targetId,
      { avatarUrl: targetUser.avatarUrl || null },
      { avatarUrl: null }
    )

    return NextResponse.json({ message: 'Avatar supprimé' })
  } catch (error) {
    console.error('Avatar delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
