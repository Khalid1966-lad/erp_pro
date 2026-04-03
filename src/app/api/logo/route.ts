import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Serve the custom company logo from disk
export async function GET() {
  try {
    const logoPath = path.join(process.cwd(), 'upload', 'company-logo.avif')

    if (!existsSync(logoPath)) {
      return NextResponse.json({ error: 'Aucun logo personnalisé' }, { status: 404 })
    }

    const buffer = await readFile(logoPath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/avif',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (error) {
    console.error('Error serving logo:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
