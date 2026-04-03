import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env', 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  let k = t.substring(0, i).trim(), v = t.substring(i + 1).trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  envVars[k] = v
}

const db = new PrismaClient({
  datasources: { db: { url: envVars.DATABASE_URL || envVars.DIRECT_URL } },
})

async function backfill() {
  const wb = XLSX.readFile('upload/Table REQ_ListeClients.xlsx')
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  const typeMap = new Map<string, string>()
  for (const row of rows) {
    const name = (row['Raison Sociale'] || '').trim().toUpperCase()
    const type = (row['Statut Juridique'] || '').trim().toUpperCase() || 'SOCIETE'
    if (name) typeMap.set(name, type)
  }

  const clients = await db.client.findMany({ select: { id: true, raisonSociale: true, name: true } })

  // Build CASE WHEN SQL for single batch update
  const cases: string[] = []
  const ids: string[] = []
  let updated = 0, notFound = 0

  for (const client of clients) {
    const searchKey = (client.raisonSociale || client.name || '').trim().toUpperCase()
    const excelType = typeMap.get(searchKey)
    if (!excelType) { notFound++; continue }
    cases.push(`WHEN '${client.id}' THEN '${excelType}'`)
    ids.push(`'${client.id}'`)
    updated++
  }

  if (ids.length > 0) {
    // Split into chunks of 200 to avoid query size limits
    const chunkSize = 200
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunkIds = ids.slice(i, i + chunkSize)
      const chunkCases = cases.slice(i, i + chunkSize)
      const sql = `
        UPDATE "Client" SET "typeSociete" = CASE id
          ${chunkCases.join('\n          ')}
        END
        WHERE id IN (${chunkIds.join(',')})
      `
      await db.$executeRawUnsafe(sql)
      process.stdout.write(`\r   ${Math.min(i + chunkSize, ids.length)}/${ids.length}`)
    }
  }

  console.log(`\n✅ Mis à jour: ${updated} | Non trouvés: ${notFound}`)

  const result: any[] = await db.$queryRaw`SELECT "typeSociete", COUNT(*)::int as count FROM "Client" GROUP BY "typeSociete" ORDER BY count DESC`
  console.log('\n📊 Distribution:')
  for (const r of result) console.log(`  ${r.typeSociete}: ${r.count}`)
  console.log(`🎉 Total: ${result.reduce((s: number, r: any) => s + r.count, 0)}`)
}

backfill().catch(console.error).finally(() => db.$disconnect())
