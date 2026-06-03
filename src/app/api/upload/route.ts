import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hasPermission } from '@/lib/auth'

// POST - Upload company logo (stores base64 in settings table)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'settings:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const allowedTypes = ['image/avif', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Type non supporté. Utilisez PNG, JPEG, WebP, AVIF ou SVG.' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 2 Mo)' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Upsert settings
    await db.setting.upsert({
      where: { key: 'company_logo_base64' },
      update: { value: base64 },
      create: { key: 'company_logo_base64', value: base64 },
    })
    await db.setting.upsert({
      where: { key: 'company_logo_content_type' },
      update: { value: file.type },
      create: { key: 'company_logo_content_type', value: file.type },
    })

    return NextResponse.json({
      success: true,
      size: bytes.byteLength,
      contentType: file.type,
    })
  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Remove custom company logo
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (!hasPermission(auth, 'settings:write')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    await db.setting.deleteMany({
      where: { key: { in: ['company_logo_base64', 'company_logo_content_type'] } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logo delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
