import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/upload — Upload company logo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/avif',
      'image/svg+xml',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non supporté. Utilisez PNG, JPEG, WebP, AVIF ou SVG.' },
        { status: 400 },
      )
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 2 Mo)' },
        { status: 400 },
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Upsert settings in database
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
      size: file.size,
      type: file.type,
      message: 'Logo enregistré avec succès',
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json({ error: 'Erreur serveur lors du téléchargement' }, { status: 500 })
  }
}

// DELETE /api/upload — Remove company logo
export async function DELETE() {
  try {
    await db.setting.deleteMany({
      where: { key: { in: ['company_logo_base64', 'company_logo_content_type'] } },
    })

    return NextResponse.json({ success: true, message: 'Logo supprimé' })
  } catch (error) {
    console.error('Error deleting logo:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la suppression' }, { status: 500 })
  }
}
