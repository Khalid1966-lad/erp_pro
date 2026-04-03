import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import path from 'path'

// Serve the custom company logo from disk
export async function GET() {
  try {
    const uploadDir = path.join(process.cwd(), 'upload')

    // Try multiple extensions in priority order
    const extensions = ['avif', 'png', 'webp', 'jpg', 'jpeg', 'svg']
    let logoPath: string | null = null
    let contentType = ''

    for (const ext of extensions) {
      const candidate = path.join(uploadDir, `company-logo.${ext}`)
      if (existsSync(candidate)) {
        logoPath = candidate
        const mimeMap: Record<string, string> = {
          avif: 'image/avif',
          png: 'image/png',
          webp: 'image/webp',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          svg: 'image/svg+xml',
        }
        contentType = mimeMap[ext] || 'application/octet-stream'
        break
      }
    }

    if (!logoPath) {
      return NextResponse.json({ error: 'Aucun logo personnalisé' }, { status: 404 })
    }

    const buffer = await readFile(logoPath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('Error serving logo:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
