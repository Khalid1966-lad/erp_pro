import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Serve the custom company logo from database (not filesystem)
// This works on Vercel where the filesystem is ephemeral
export async function GET() {
  try {
    // Fetch logo data from database
    const settings = await db.setting.findMany({
      where: { key: { in: ['company_logo_base64', 'company_logo_content_type'] } }
    })

    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }

    const base64 = settingsMap['company_logo_base64']
    const contentType = settingsMap['company_logo_content_type'] || 'image/avif'

    if (!base64) {
      return NextResponse.json({ error: 'Aucun logo personnalisé' }, { status: 404 })
    }

    // Decode base64 to binary
    const buffer = Buffer.from(base64, 'base64')

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
