import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO - Client Excel Import/Template
// ═══════════════════════════════════════════════════════════════

// Column mapping: French header → internal field name
const COLUMN_MAP: Record<string, string> = {
  'Raison Sociale *': 'raisonSociale',
  'ICE *': 'ice',
  'Ville *': 'ville',
  'Email *': 'email',
  'Nom Commercial': 'nomCommercial',
  'Forme Juridique': 'formeJuridique',
  'Adresse': 'adresse',
  'Code Postal': 'codePostal',
  'Téléphone': 'telephone',
  'GSM': 'gsm',
  'Email Secondaire': 'emailSecondaire',
  'Site Web': 'siteWeb',
  'Conditions Paiement': 'conditionsPaiement',
  'Mode Règlement': 'modeReglementPrefere',
  'Taux TVA': 'tauxTva',
  'Régime Fiscal': 'regimeFiscal',
  'Statut': 'statut',
  'Catégorie': 'categorie',
  'Priorité': 'priorite',
  'Langue Communication': 'langueCommunication',
  'Patente': 'patente',
  'CNSS': 'cnss',
  'Identifiant Fiscal': 'identifiantFiscal',
  'Registre Commerce': 'registreCommerce',
  'Ville RC': 'villeRC',
  'Seuil Crédit': 'seuilCredit',
  'Commentaires': 'commentairesInternes',
}

const REQUIRED_FIELDS = ['raisonSociale', 'ice', 'ville', 'email']

// Valid enum values for validation
const VALID_FORME_JURIDIQUE = ['SARL', 'SA', 'SNC', 'SARLAU', 'Autre']
const VALID_STATUT = ['actif', 'inactif', 'prospect', 'client_risque', 'client_privilegie']
const VALID_CATEGORIE = ['grand_compte', 'PME', 'particulier', 'revendeur', 'export']
const VALID_MODE_REGLEMENT = ['virement', 'cheque', 'effet', 'especes']
const VALID_TAUX_TVA = ['taux_20', 'taux_10', 'taux_7', 'taux_0', 'exonere', 'autoliquidation']
const VALID_REGIME_FISCAL = ['IS', 'IR', 'reel_simplifie', 'reel_normal']
const VALID_LANGUE = ['francais', 'arabe', 'anglais']

// ─────────────────────────────────────────────
// GET /api/clients/import — Download Excel template
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    // Build headers row (French column names)
    const headers = Object.keys(COLUMN_MAP)

    // Example data rows
    const exampleRows = [
      [
        'GEMA Industries SARL',       // Raison Sociale *
        '001234567890123',             // ICE *
        'Casablanca',                  // Ville *
        'contact@gema-industries.ma',  // Email *
        'GEMA Pro',                    // Nom Commercial
        'SARL',                        // Forme Juridique
        '45, Bd Mohamed V',            // Adresse
        '20000',                       // Code Postal
        '+212522000000',               // Téléphone
        '+212661234567',               // GSM
        'comptabilite@gema.ma',        // Email Secondaire
        'https://www.gema-industries.ma', // Site Web
        '30 jours',                    // Conditions Paiement
        'virement',                    // Mode Règlement
        'taux_20',                     // Taux TVA
        'IS',                          // Régime Fiscal
        'actif',                       // Statut
        'PME',                         // Catégorie
        '3',                           // Priorité
        'francais',                    // Langue Communication
        '1234567',                     // Patente
        '987654321',                   // CNSS
        'IF123456',                    // Identifiant Fiscal
        'RC-12345',                    // Registre Commerce
        'Casablanca',                  // Ville RC
        '100000',                      // Seuil Crédit
        'Client important',            // Commentaires
      ],
      [
        'Atlas Distribution SA',       // Raison Sociale *
        '009876543210987',             // ICE *
        'Rabat',                       // Ville *
        'info@atlas-dist.ma',          // Email *
        'Atlas Dist',                  // Nom Commercial
        'SA',                          // Forme Juridique
        '12, Rue Al Adarissa',         // Adresse
        '10000',                       // Code Postal
        '+212537000000',               // Téléphone
        '+212612345678',               // GSM
        '',                            // Email Secondaire
        '',                            // Site Web
        '60 jours',                    // Conditions Paiement
        'cheque',                      // Mode Règlement
        'taux_20',                     // Taux TVA
        'IS',                          // Régime Fiscal
        'prospect',                    // Statut
        'grand_compte',                // Catégorie
        '4',                           // Priorité
        'francais',                    // Langue Communication
        '',                            // Patente
        '',                            // CNSS
        '',                            // Identifiant Fiscal
        '',                            // Registre Commerce
        '',                            // Ville RC
        '200000',                      // Seuil Crédit
        '',                            // Commentaires
      ],
    ]

    const wsData = [headers, ...exampleRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=clients-template.xlsx',
      },
    })
  } catch (error) {
    console.error('Template generation error:', error)
    return NextResponse.json({ error: 'Erreur de génération du modèle' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/clients/import — Import clients from Excel
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    if (!file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json({ error: 'Format de fichier invalide. Utilisez .xlsx ou .xls' }, { status: 400 })
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    if (rawData.length === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 })
    }

    // Build reverse mapping: internal field → French header
    const reverseMap: Record<string, string> = {}
    for (const [header, field] of Object.entries(COLUMN_MAP)) {
      reverseMap[field] = header
    }

    let imported = 0
    let skipped = 0
    const errors: Array<{ row: number; reason: string }> = []

    // Collect all ICEs to batch-check duplicates
    const allIces = rawData.map((row) => {
      const iceField = COLUMN_MAP['ICE *']
      return String(row[iceField] || row['ICE *'] || '').trim()
    })

    const existingClients = await db.client.findMany({
      where: { ice: { in: allIces } },
      select: { ice: true },
    })
    const existingIceSet = new Set(existingClients.map((c) => c.ice))

    for (let i = 0; i < rawData.length; i++) {
      const rawRow = rawData[i]
      const rowNum = i + 2 // Excel row number (1-indexed, +1 for header)

      // Map French headers to internal field names
      const mappedRow: Record<string, string> = {}
      for (const [header, value] of Object.entries(rawRow)) {
        const field = COLUMN_MAP[header.trim()]
        if (field) {
          mappedRow[field] = String(value).trim()
        }
      }

      // Also check using reverse-mapped internal field names (in case headers are already in English)
      for (const [field, header] of Object.entries(reverseMap)) {
        if (mappedRow[field] === undefined && rawRow[field] !== undefined) {
          mappedRow[field] = String(rawRow[field]).trim()
        }
      }

      // Validate required fields
      const missingFields: string[] = []
      for (const reqField of REQUIRED_FIELDS) {
        if (!mappedRow[reqField]) {
          missingFields.push(reverseMap[reqField] || reqField)
        }
      }
      if (missingFields.length > 0) {
        errors.push({ row: rowNum, reason: `Champs requis manquants: ${missingFields.join(', ')}` })
        skipped++
        continue
      }

      // Skip duplicate ICE
      if (existingIceSet.has(mappedRow.ice)) {
        errors.push({ row: rowNum, reason: `ICE ${mappedRow.ice} existe déjà — doublon ignoré` })
        skipped++
        continue
      }

      // Validate enum fields
      if (mappedRow.formeJuridique && !VALID_FORME_JURIDIQUE.includes(mappedRow.formeJuridique)) {
        errors.push({ row: rowNum, reason: `Forme juridique invalide: "${mappedRow.formeJuridique}". Valeurs: ${VALID_FORME_JURIDIQUE.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.statut && !VALID_STATUT.includes(mappedRow.statut)) {
        errors.push({ row: rowNum, reason: `Statut invalide: "${mappedRow.statut}". Valeurs: ${VALID_STATUT.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.categorie && !VALID_CATEGORIE.includes(mappedRow.categorie)) {
        errors.push({ row: rowNum, reason: `Catégorie invalide: "${mappedRow.categorie}". Valeurs: ${VALID_CATEGORIE.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.modeReglementPrefere && !VALID_MODE_REGLEMENT.includes(mappedRow.modeReglementPrefere)) {
        errors.push({ row: rowNum, reason: `Mode règlement invalide: "${mappedRow.modeReglementPrefere}". Valeurs: ${VALID_MODE_REGLEMENT.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.tauxTva && !VALID_TAUX_TVA.includes(mappedRow.tauxTva)) {
        errors.push({ row: rowNum, reason: `Taux TVA invalide: "${mappedRow.tauxTva}". Valeurs: ${VALID_TAUX_TVA.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.regimeFiscal && !VALID_REGIME_FISCAL.includes(mappedRow.regimeFiscal)) {
        errors.push({ row: rowNum, reason: `Régime fiscal invalide: "${mappedRow.regimeFiscal}". Valeurs: ${VALID_REGIME_FISCAL.join(', ')}` })
        skipped++
        continue
      }
      if (mappedRow.langueCommunication && !VALID_LANGUE.includes(mappedRow.langueCommunication)) {
        errors.push({ row: rowNum, reason: `Langue invalide: "${mappedRow.langueCommunication}". Valeurs: ${VALID_LANGUE.join(', ')}` })
        skipped++
        continue
      }

      // Validate email format
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (mappedRow.email && !emailRegex.test(mappedRow.email)) {
        errors.push({ row: rowNum, reason: `Email invalide: "${mappedRow.email}"` })
        skipped++
        continue
      }
      if (mappedRow.emailSecondaire && !emailRegex.test(mappedRow.emailSecondaire)) {
        errors.push({ row: rowNum, reason: `Email secondaire invalide: "${mappedRow.emailSecondaire}"` })
        skipped++
        continue
      }

      // Validate priorite
      if (mappedRow.priorite) {
        const prio = parseInt(mappedRow.priorite, 10)
        if (isNaN(prio) || prio < 1 || prio > 5) {
          errors.push({ row: rowNum, reason: `Priorité invalide: "${mappedRow.priorite}". Valeur: 1-5` })
          skipped++
          continue
        }
      }

      // Validate seuilCredit
      if (mappedRow.seuilCredit) {
        const seuil = parseFloat(mappedRow.seuilCredit)
        if (isNaN(seuil) || seuil < 0) {
          errors.push({ row: rowNum, reason: `Seuil crédit invalide: "${mappedRow.seuilCredit}"` })
          skipped++
          continue
        }
      }

      // Build client data
      const createData: Record<string, unknown> = {
        raisonSociale: mappedRow.raisonSociale,
        ice: mappedRow.ice,
        ville: mappedRow.ville,
        email: mappedRow.email,
        // Legacy field auto-mapping
        name: mappedRow.raisonSociale,
        address: mappedRow.adresse || mappedRow.raisonSociale,
        city: mappedRow.ville,
        postalCode: mappedRow.codePostal || null,
        phone: mappedRow.telephone || null,
        country: 'Maroc',
        paymentTerms: mappedRow.conditionsPaiement || '30 jours',
        creditLimit: mappedRow.seuilCredit ? parseFloat(mappedRow.seuilCredit) : 0,
        notes: mappedRow.commentairesInternes || null,
      }

      // Optional fields
      if (mappedRow.nomCommercial) createData.nomCommercial = mappedRow.nomCommercial
      if (mappedRow.formeJuridique) createData.formeJuridique = mappedRow.formeJuridique
      if (mappedRow.adresse) createData.adresse = mappedRow.adresse
      if (mappedRow.codePostal) createData.codePostal = mappedRow.codePostal
      if (mappedRow.telephone) createData.telephone = mappedRow.telephone
      if (mappedRow.gsm) createData.gsm = mappedRow.gsm
      if (mappedRow.emailSecondaire) createData.emailSecondaire = mappedRow.emailSecondaire
      if (mappedRow.siteWeb) createData.siteWeb = mappedRow.siteWeb
      if (mappedRow.conditionsPaiement) createData.conditionsPaiement = mappedRow.conditionsPaiement
      if (mappedRow.modeReglementPrefere) createData.modeReglementPrefere = mappedRow.modeReglementPrefere
      if (mappedRow.tauxTva) createData.tauxTva = mappedRow.tauxTva
      if (mappedRow.regimeFiscal) createData.regimeFiscal = mappedRow.regimeFiscal
      if (mappedRow.statut) createData.statut = mappedRow.statut
      if (mappedRow.categorie) createData.categorie = mappedRow.categorie
      if (mappedRow.priorite) createData.priorite = parseInt(mappedRow.priorite, 10)
      if (mappedRow.langueCommunication) createData.langueCommunication = mappedRow.langueCommunication
      if (mappedRow.patente) createData.patente = mappedRow.patente
      if (mappedRow.cnss) createData.cnss = mappedRow.cnss
      if (mappedRow.identifiantFiscal) createData.identifiantFiscal = mappedRow.identifiantFiscal
      if (mappedRow.registreCommerce) createData.registreCommerce = mappedRow.registreCommerce
      if (mappedRow.villeRC) createData.villeRC = mappedRow.villeRC
      if (mappedRow.seuilCredit) createData.seuilCredit = parseFloat(mappedRow.seuilCredit)
      if (mappedRow.commentairesInternes) createData.commentairesInternes = mappedRow.commentairesInternes

      createData.createdBy = user.userId

      try {
        const client = await db.client.create({ data: createData })
        await auditLog(user.userId, 'import', 'Client', client.id, null, { source: 'excel_import', raisonSociale: mappedRow.raisonSociale, ice: mappedRow.ice })
        imported++
        existingIceSet.add(mappedRow.ice) // Track newly created ICE to avoid in-file duplicates
      } catch (dbError: unknown) {
        const errMsg = dbError instanceof Error ? dbError.message : 'Erreur base de données'
        errors.push({ row: rowNum, reason: `Erreur lors de la création: ${errMsg}` })
        skipped++
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 })
  }
}
