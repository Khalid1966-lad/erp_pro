import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

// Parse .env file manually
const envContent = readFileSync('.env', 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIndex = trimmed.indexOf('=')
  if (eqIndex === -1) continue
  const key = trimmed.substring(0, eqIndex).trim()
  let val = trimmed.substring(eqIndex + 1).trim()
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
  envVars[key] = val
}

const db = new PrismaClient({
  datasources: {
    db: {
      url: envVars.DATABASE_URL || envVars.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
})

async function importClients() {
  const wb = XLSX.readFile('upload/Table REQ_ListeClients.xlsx')
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  console.log(`📋 ${rows.length} lignes à importer`)

  function mapStatut(statut: string) {
    const s = statut.trim().toUpperCase()
    switch (s) {
      case 'SOCIETE':
        return { formeJuridique: 'SARL' as const, categorie: 'PME' as const, statut: 'prospect' as const }
      case 'REVENDEUR':
        return { formeJuridique: 'SARL' as const, categorie: 'revendeur' as const, statut: 'prospect' as const }
      case 'PARTICULIER':
        return { formeJuridique: 'Autre' as const, categorie: 'particulier' as const, statut: 'prospect' as const }
      default:
        return { formeJuridique: 'SARL' as const, categorie: 'PME' as const, statut: 'prospect' as const }
    }
  }

  function generateIce(index: number, name: string): string {
    const prefix = name.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase().padEnd(2, 'X')
    const digits = String(index + 1000000000000).padStart(13, '0')
    return prefix + digits
  }

  const existingClients = await db.client.findMany({ select: { ice: true } })
  const existingIces = new Set(existingClients.map(c => c.ice))
  console.log(`⚠️  ${existingIces.size} clients existent déjà en base`)

  let imported = 0
  let skipped = 0
  let errors: { row: number; name: string; reason: string }[] = []

  const BATCH_SIZE = 50

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const createData: any[] = []

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j]
      const rowNum = i + j + 1
      const raisonSociale = (row['Raison Sociale'] || '').trim()
      const statutJuridique = (row['Statut Juridique'] || '').trim()

      if (!raisonSociale) {
        skipped++
        errors.push({ row: rowNum, name: '(vide)', reason: 'Raison Sociale vide' })
        continue
      }

      let ice = generateIce(i + j, raisonSociale)
      let iceAttempts = 0
      while (existingIces.has(ice) && iceAttempts < 100) {
        ice = generateIce(i + j + iceAttempts * 1000, raisonSociale)
        iceAttempts++
      }
      if (existingIces.has(ice)) {
        skipped++
        errors.push({ row: rowNum, name: raisonSociale, reason: 'ICE unique impossible' })
        continue
      }
      existingIces.add(ice)

      const mapped = mapStatut(statutJuridique)

      createData.push({
        name: raisonSociale,
        raisonSociale,
        ice,
        formeJuridique: mapped.formeJuridique,
        categorie: mapped.categorie,
        statut: mapped.statut,
        country: 'Maroc',
      })
    }

    if (createData.length > 0) {
      try {
        const result = await db.client.createMany({ data: createData, skipDuplicates: true })
        imported += result.count
      } catch (err: any) {
        console.error(`Erreur batch ${i / BATCH_SIZE}:`, err.message)
        errors.push({ row: i, name: `Batch ${i / BATCH_SIZE}`, reason: err.message })
      }
    }

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= rows.length) {
      process.stdout.write(`\r   Progression: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`)
    }
  }

  console.log('\n\n════════════════════════════════════════')
  console.log("📊 BILAN D'IMPORT")
  console.log('════════════════════════════════════════')
  console.log(`✅ Importés  : ${imported}`)
  console.log(`⏭️  Ignorés   : ${skipped}`)
  console.log(`❌ Erreurs   : ${errors.length}`)
  console.log(`📂 Total fichier: ${rows.length}`)

  if (errors.length > 0) {
    console.log('\nDétail des erreurs:')
    for (const e of errors.slice(0, 20)) {
      console.log(`  Ligne ${e.row}: ${e.name} — ${e.reason}`)
    }
    if (errors.length > 20) console.log(`  ... et ${errors.length - 20} autres`)
  }

  const afterImport = await db.client.findMany({
    select: { categorie: true, statut: true, formeJuridique: true }
  })

  const catStats: Record<string, number> = {}
  const statutStats: Record<string, number> = {}
  const fjStats: Record<string, number> = {}

  for (const c of afterImport) {
    catStats[c.categorie] = (catStats[c.categorie] || 0) + 1
    statutStats[c.statut] = (statutStats[c.statut] || 0) + 1
    fjStats[c.formeJuridique] = (fjStats[c.formeJuridique] || 0) + 1
  }

  console.log('\n📊 Répartition par catégorie:')
  for (const [k, v] of Object.entries(catStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }
  console.log('\n📊 Répartition par statut:')
  for (const [k, v] of Object.entries(statutStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }
  console.log('\n📊 Répartition par forme juridique:')
  for (const [k, v] of Object.entries(fjStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }

  console.log('\n════════════════════════════════════════')
  console.log(`🎉 Total clients en base: ${afterImport.length}`)
}

importClients()
  .catch(console.error)
  .finally(() => db.$disconnect())
