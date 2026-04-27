import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { validateBackupFile, restoreDatabase, type RestoreProgress } from '@/lib/backup'

// Allow up to 5 minutes for restore on Vercel
export const maxDuration = 300

// ═══════════════════════════════════════════════════════════════
// POST /api/backup/restore — Upload and restore via SSE streaming
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  // Admin or super_admin only
  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    const errBody = JSON.stringify({ step: 'error', message: 'Accès refusé — administrateur requis' })
    return new Response(errBody, { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  // Parse multipart form data first (before creating the stream)
  let fileBuffer: Buffer
  let fileName: string
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      const errBody = JSON.stringify({ step: 'error', message: 'Fichier manquant — veuillez fournir un fichier .json.gz' })
      return new Response(errBody, { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    if (!file.name.endsWith('.json.gz')) {
      const errBody = JSON.stringify({ step: 'error', message: 'Format de fichier invalide — seul .json.gz est accepté' })
      return new Response(errBody, { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    fileBuffer = Buffer.from(await file.arrayBuffer())
    fileName = file.name
  } catch (error) {
    console.error('[Backup] Restore: parse error:', error)
    const errBody = JSON.stringify({ step: 'error', message: 'Erreur de lecture du fichier' })
    return new Response(errBody, { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  // ─── SSE Streaming Response ───
  const encoder = new TextEncoder()

  const send = (progress: RestoreProgress & { fileName?: string; warnings?: string[] }) => {
    return encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Validate
        controller.enqueue(send({
          step: 'validating',
          message: `Validation de "${fileName}"...`,
        }))

        const validation = await validateBackupFile(fileBuffer)

        if (!validation.valid) {
          controller.enqueue(send({
            step: 'error',
            message: `Fichier invalide — ${validation.errors.join(' ; ')}`,
          }))
          controller.close()
          return
        }

        controller.enqueue(send({
          step: 'validating',
          message: `Fichier valide — ${validation.meta?.totalRows ?? 0} lignes dans ${validation.meta?.totalTables ?? 0} tables`,
          fileName,
          warnings: validation.warnings,
        }))

        // Step 2: Decompress and extract data
        const zlib = await import('zlib')
        const jsonBuffer = zlib.gunzipSync(fileBuffer)
        const parsed = JSON.parse(jsonBuffer.toString('utf-8'))
        const data: Record<string, any[]> = parsed.data

        // Step 3: Restore database with progress
        const { db } = await import('@/lib/db')

        await restoreDatabase(db, data, (progress: RestoreProgress) => {
          controller.enqueue(send(progress))
        })

        // Step 4: Done
        controller.enqueue(send({
          step: 'done',
          message: 'Restauration terminée avec succès !',
        }))

        controller.close()
      } catch (error) {
        console.error('[Backup] Restore error:', error)
        const message = error instanceof Error ? error.message : 'Erreur inconnue'
        controller.enqueue(send({ step: 'error', message }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
