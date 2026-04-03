import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // Auth check — only admins can upload
    const authUser = await getUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    if (authUser.role !== 'admin') {
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

    // Max 5 MB raw upload
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Try to compress with sharp (available in the project)
    let finalBuffer: Buffer
    let finalExt = 'avif'

    try {
      // Dynamic import to avoid issues if sharp isn't available
      const sharp = (await import('sharp')).default

      finalBuffer = await sharp(buffer)
        .resize(400, 400, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .avif({
          quality: 85,
          effort: 6, // compression effort (0-9)
          chromaSubsampling: '4:2:0',
        })
        .toBuffer()
    } catch {
      // Sharp not available or format not supported — save as-is
      finalBuffer = buffer

      // Determine extension from original type
      const extMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/avif': 'avif',
      }
      finalExt = extMap[file.type] || 'png'
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'upload')
    await mkdir(uploadDir, { recursive: true })

    // Save to disk
    const logoPath = path.join(uploadDir, `company-logo.${finalExt}`)
    await writeFile(logoPath, finalBuffer)

    // Update setting in database
    await db.setting.upsert({
      where: { key: 'company_logo_url' },
      update: { value: `/api/logo` },
      create: { key: 'company_logo_url', value: `/api/logo` },
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
