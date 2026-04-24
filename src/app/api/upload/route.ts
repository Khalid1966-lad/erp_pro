import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

// DELETE - Remove company logo from database
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    // Remove all logo-related settings from database
    await db.setting.deleteMany({
      where: { key: { in: ['company_logo_base64', 'company_logo_content_type', 'company_logo_url'] } }
    })

    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    console.error('Logo delete error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check — only admins can upload
    const authUser = await getUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/avif', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type non supporté. Utilisez PNG, JPEG, WebP, AVIF ou SVG.' },
        { status: 400 }
      )
    }

    // Max 500 KB raw upload
    const MAX_SIZE = 500 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 500 Ko)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Convert to AVIF using sharp for compression
    let finalBuffer: Buffer
    let finalContentType = 'image/avif'
    let finalExt = 'avif'

    try {
      const sharp = (await import('sharp')).default

      finalBuffer = await sharp(buffer)
        .resize(400, 400, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .avif({
          quality: 85,
          effort: 6,
          chromaSubsampling: '4:2:0',
        })
        .toBuffer()
    } catch (sharpErr) {
      console.error('Sharp AVIF failed, trying PNG:', sharpErr)
      // Fallback: convert to PNG instead
      try {
        const sharp = (await import('sharp')).default
        finalBuffer = await sharp(buffer)
          .resize(400, 400, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png({ quality: 100 })
          .toBuffer()
        finalContentType = 'image/png'
        finalExt = 'png'
      } catch {
        // Sharp completely unavailable, save original as-is
        finalBuffer = buffer
        finalContentType = file.type
        finalExt = file.type.split('/')[1] === 'svg+xml' ? 'svg' : file.type.split('/')[1]
      }
    }

    // Convert to base64 for database storage
    const base64 = finalBuffer.toString('base64')

    // Save to database (not filesystem — Vercel filesystem is ephemeral)
    await db.setting.upsert({
      where: { key: 'company_logo_base64' },
      update: { value: base64 },
      create: { key: 'company_logo_base64', value: base64 },
    })

    await db.setting.upsert({
      where: { key: 'company_logo_content_type' },
      update: { value: finalContentType },
      create: { key: 'company_logo_content_type', value: finalContentType },
    })

    await db.setting.upsert({
      where: { key: 'company_logo_url' },
      update: { value: '/api/logo' },
      create: { key: 'company_logo_url', value: '/api/logo' },
    })

    return NextResponse.json({
      success: true,
      url: '/api/logo',
      size: finalBuffer.length,
      format: finalExt,
      originalSize: buffer.length,
      compressionRatio: Math.round((1 - finalBuffer.length / buffer.length) * 100),
    })
  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: 'Erreur lors du téléchargement' }, { status: 500 })
  }
}
