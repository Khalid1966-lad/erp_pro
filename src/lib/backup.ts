// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO — Backup & Restore Core Utility
// ═══════════════════════════════════════════════════════════════

import fs from 'fs/promises'
import crypto from 'crypto'
import zlib from 'zlib'
import { APP_VERSION } from '@/lib/version'

// ─── Table names in FK-safe order (parents before children) ───
export const BACKUP_TABLES = [
  'Setting',
  'User',
  'WorkStation',
  'CashRegister',
  'BankAccount',
  'Product',
  'AccountingEntry',
  'AuditLog',
  'Inventory',
  'PriceRequest',
  'RoutingStep',
  'StockMovement',
  'CashMovement',
  'BankTransaction',
  'Client',
  'ClientContact',
  'ClientDocument',
  'Supplier',
  'BomComponent',
  'InventoryLine',
  'PriceRequestLine',
  'Quote',
  'QuoteLine',
  'SalesOrder',
  'SalesOrderLine',
  'PreparationOrder',
  'PreparationLine',
  'DeliveryNote',
  'DeliveryNoteLine',
  'Invoice',
  'InvoiceLine',
  'InvoiceDeliveryNote',
  'CreditNote',
  'CreditNoteLine',
  'Payment',
  'SupplierQuote',
  'SupplierQuoteLine',
  'PurchaseOrder',
  'PurchaseOrderLine',
  'Reception',
  'ReceptionLine',
  'SupplierInvoice',
  'SupplierInvoiceLine',
  'SupplierReturn',
  'SupplierReturnLine',
  'SupplierCreditNote',
  'SupplierCreditNoteLine',
  'WorkOrder',
  'WorkOrderStep',
]

// Reversed order for deletion (children before parents)
export const DELETE_TABLES_ORDER = [...BACKUP_TABLES].reverse()

// ─── DateTime field names per table ───
// Used during restore to convert ISO strings back to Date objects
const DATETIME_FIELDS: Record<string, string[]> = {
  User: ['blockedAt', 'lastLogin', 'createdAt', 'updatedAt'],
  WorkStation: ['createdAt', 'updatedAt'],
  CashRegister: ['createdAt', 'updatedAt'],
  BankAccount: ['createdAt', 'updatedAt'],
  Product: ['createdAt', 'updatedAt'],
  AccountingEntry: ['date', 'createdAt'],
  AuditLog: ['createdAt'],
  Inventory: ['startedAt', 'completedAt', 'createdAt', 'updatedAt'],
  PriceRequest: ['date', 'validUntil', 'createdAt', 'updatedAt'],
  StockMovement: ['createdAt'],
  CashMovement: ['createdAt'],
  BankTransaction: ['date', 'createdAt'],
  Client: [
    'dateCreation', 'datePremierAchat', 'dateDernierAchat',
    'dernierDevisDate', 'derniereFactureDate', 'derniereRelanceDate',
    'createdAt', 'updatedAt',
  ],
  ClientContact: ['createdAt', 'updatedAt'],
  ClientDocument: ['createdAt'],
  Supplier: ['createdAt', 'updatedAt'],
  Quote: ['date', 'validUntil', 'createdAt', 'updatedAt'],
  SalesOrder: ['date', 'deliveryDate', 'createdAt', 'updatedAt'],
  PreparationOrder: ['completedAt', 'createdAt', 'updatedAt'],
  DeliveryNote: ['date', 'plannedDate', 'deliveryDate', 'createdAt', 'updatedAt'],
  Invoice: ['date', 'dueDate', 'paymentDate', 'createdAt', 'updatedAt'],
  CreditNote: ['date', 'createdAt', 'updatedAt'],
  Payment: ['date', 'createdAt'],
  SupplierQuote: ['date', 'validUntil', 'createdAt', 'updatedAt'],
  PurchaseOrder: ['date', 'expectedDate', 'createdAt', 'updatedAt'],
  Reception: ['date', 'createdAt', 'updatedAt'],
  SupplierInvoice: ['date', 'dueDate', 'paymentDate', 'createdAt', 'updatedAt'],
  SupplierReturn: ['date', 'createdAt', 'updatedAt'],
  SupplierCreditNote: ['date', 'createdAt', 'updatedAt'],
  WorkOrder: ['plannedDate', 'startedAt', 'completedAt', 'closedAt', 'createdAt', 'updatedAt'],
  WorkOrderStep: ['startedAt', 'completedAt'],
}

// ═══════════════════════════════════════════════════════════════
// 1. Compute SHA256 hash of prisma/schema.prisma
// ═══════════════════════════════════════════════════════════════
export async function computeSchemaHash(): Promise<string> {
  try {
    const schemaPath = 'prisma/schema.prisma'
    const content = await fs.readFile(schemaPath, 'utf-8')
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch {
    // Fallback for Vercel / environments where prisma/schema.prisma is not readable
    return crypto.createHash('sha256').update(`gema-erp-${APP_VERSION}`).digest('hex')
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. Export all database tables
// ═══════════════════════════════════════════════════════════════
export async function exportDatabase(db: any): Promise<{
  data: Record<string, any[]>
  meta: {
    app: string
    version: string
    exportedAt: string
    totalTables: number
    totalRows: number
    tables: Record<string, number>
  }
}> {
  const data: Record<string, any[]> = {}
  const tables: Record<string, number> = {}
  let totalRows = 0

  for (const table of BACKUP_TABLES) {
    const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM "${table}"`)
    data[table] = rows
    const count = rows.length
    tables[table] = count
    totalRows += count
  }

  const meta = {
    app: 'GEMA ERP PRO',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    totalTables: BACKUP_TABLES.length,
    totalRows,
    tables,
  }

  return { data, meta }
}

// ═══════════════════════════════════════════════════════════════
// 3. Compress backup data (JSON → gzip → base64)
// ═══════════════════════════════════════════════════════════════
export function createBackupData(backup: { data: Record<string, any[]>; meta: object }): {
  compressed: string
  originalSize: number
  compressedSize: number
} {
  const jsonString = JSON.stringify({ meta: backup.meta, data: backup.data })
  const originalSize = Buffer.byteLength(jsonString, 'utf-8')
  const gzipped = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'))
  const compressed = gzipped.toString('base64')
  const compressedSize = gzipped.byteLength

  return { compressed, originalSize, compressedSize }
}

// ═══════════════════════════════════════════════════════════════
// 4. Validate uploaded backup file
// ═══════════════════════════════════════════════════════════════
export async function validateBackupFile(fileBuffer: Buffer): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
  meta: any
}> {
  const errors: string[] = []
  const warnings: string[] = []
  let meta: any = null

  // Step 1: Try to decompress (gzip) — fallback to raw JSON
  let jsonBuffer: Buffer
  let isGzip = true
  try {
    jsonBuffer = zlib.gunzipSync(fileBuffer)
  } catch {
    // Maybe it's a plain JSON file (not gzipped)
    isGzip = false
    jsonBuffer = fileBuffer
    warnings.push('Le fichier n\'est pas compressé (gzip). Format accepté mais la compression est recommandée.')
  }

  // Step 2: Try to parse JSON
  let parsed: any
  try {
    const jsonString = jsonBuffer.toString('utf-8')
    parsed = JSON.parse(jsonString)
  } catch {
    errors.push('Impossible de lire le fichier JSON. Le contenu est corrompu ou le format est invalide.')
    return { valid: false, errors, warnings, meta }
  }

  // Step 3: Check structure
  if (!parsed.meta) {
    errors.push('Structure invalide: "meta" manquant.')
    return { valid: false, errors, warnings, meta }
  }
  if (!parsed.data) {
    errors.push('Structure invalide: "data" manquant.')
    return { valid: false, errors, warnings, meta }
  }

  meta = parsed.meta

  // Step 4: Check app name
  if (meta.app !== 'GEMA ERP PRO') {
    errors.push(`Ce fichier ne provient pas de GEMA ERP PRO (app: "${meta.app ?? 'inconnu'}").`)
    return { valid: false, errors, warnings, meta }
  }

  // Step 5: Check version compatibility
  if (meta.version !== APP_VERSION) {
    warnings.push(
      `Version différente détectée: sauvegarde v${meta.version}, application v${APP_VERSION}. La restauration peut comporter des incohérences.`
    )
  }

  // Step 6: Check all required tables are present
  const missingTables: string[] = []
  for (const table of BACKUP_TABLES) {
    if (!(table in parsed.data)) {
      missingTables.push(table)
    }
  }
  if (missingTables.length > 0) {
    errors.push(`Tables manquantes: ${missingTables.join(', ')}`)
  }

  // Step 7: Check each table is an array
  const nonArrayTables: string[] = []
  for (const [table, value] of Object.entries(parsed.data)) {
    if (!Array.isArray(value)) {
      nonArrayTables.push(table)
    }
  }
  if (nonArrayTables.length > 0) {
    errors.push(`Tables non-array: ${nonArrayTables.join(', ')}`)
  }

  // Step 8: Check data is not empty
  const totalRows = BACKUP_TABLES.reduce((sum, t) => {
    return sum + (Array.isArray(parsed.data[t]) ? parsed.data[t].length : 0)
  }, 0)
  if (totalRows === 0) {
    warnings.push('La sauvegarde ne contient aucune donnée (toutes les tables sont vides).')
  }

  const valid = errors.length === 0
  return { valid, errors, warnings, meta }
}

// ═══════════════════════════════════════════════════════════════
// 5. Restore database from backup data
// ═══════════════════════════════════════════════════════════════
export type RestoreProgress = {
  step: 'validating' | 'deleting' | 'inserting' | 'done' | 'error'
  message: string
  current?: number
  total?: number
  table?: string
}

export async function restoreDatabase(
  db: any,
  data: Record<string, any[]>,
  onProgress?: (progress: RestoreProgress) => void
): Promise<void> {
  const totalTables = DELETE_TABLES_ORDER.length + BACKUP_TABLES.length
  let completed = 0

  const emit = (progress: RestoreProgress) => {
    if (onProgress) {
      progress.current = completed
      progress.total = totalTables
      onProgress(progress)
    }
  }

  await db.$transaction(
    async (tx: any) => {
      // Phase 1: Delete all data in reverse FK order (children first)
      emit({ step: 'deleting', message: 'Suppression des données existantes...' })
      for (const table of DELETE_TABLES_ORDER) {
        emit({ step: 'deleting', message: `Suppression : ${table}`, table })
        await tx.$executeRawUnsafe(`DELETE FROM "${table}"`)
        completed++
      }

      // Phase 2: Insert all data in FK-safe order (parents first)
      emit({ step: 'inserting', message: 'Restauration des données...' })
      for (const table of BACKUP_TABLES) {
        const rows = data[table]
        if (!rows || rows.length === 0) {
          completed++
          continue
        }

        emit({ step: 'inserting', message: `${table} (${rows.length} lignes)`, table })

        // Convert DateTime string fields back to Date objects
        const datetimeFields = DATETIME_FIELDS[table]
        const processedRows = rows.map((row: any) => {
          if (!datetimeFields) return row
          const processed = { ...row }
          for (const field of datetimeFields) {
            if (processed[field] !== null && processed[field] !== undefined) {
              processed[field] = new Date(processed[field])
            }
          }
          return processed
        })

        await tx[table as any].createMany({
          data: processedRows,
          skipDuplicates: false,
        })
        completed++
      }
    },
    { timeout: 300_000 }
  )
}

// ═══════════════════════════════════════════════════════════════
// 6. Trim backups to max limit (delete oldest first)
// ═══════════════════════════════════════════════════════════════
export async function trimBackups(db: any, maxBackups: number = 7): Promise<void> {
  const count = await db.backup.count()
  if (count <= maxBackups) return

  const excess = count - maxBackups
  const oldest = await db.backup.findMany({
    orderBy: { createdAt: 'asc' },
    take: excess,
    select: { id: true },
  })

  if (oldest.length > 0) {
    const ids = oldest.map((b: any) => b.id)
    await db.backup.deleteMany({
      where: { id: { in: ids } },
    })
  }
}
