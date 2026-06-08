import { db } from '@/lib/db'

/**
 * Get the next code for an entity using a persistent counter that never decreases.
 * Format: CL-0001, FR-001, PROD-0001
 *
 * The counter is initialized from the MAX existing code on first use,
 * then always increments. Even if entities are deleted, the counter stays high.
 */

type CodeConfig = {
  entity: string        // "client" | "supplier" | "product"
  prefix: string        // "CL" | "FR" | "PROD"
  digits: number        // 4 for CL/PROD, 3 for FR
  modelField: string    // "code" | "reference"
  regex: RegExp          // /^CL-(\d+)$/
  tableName: string      // "Client" | "Supplier" | "Product"
  prefixFilter: string   // "CL-" | "FR-" | "PROD-"
}

const CONFIGS: Record<string, CodeConfig> = {
  client: {
    entity: 'client',
    prefix: 'CL',
    digits: 4,
    modelField: 'code',
    regex: /^CL-(\d+)$/,
    tableName: 'Client',
    prefixFilter: 'CL-',
  },
  supplier: {
    entity: 'supplier',
    prefix: 'FR',
    digits: 3,
    modelField: 'code',
    regex: /^FR-(\d+)$/,
    tableName: 'Supplier',
    prefixFilter: 'FR-',
  },
  product: {
    entity: 'product',
    prefix: 'PROD',
    digits: 4,
    modelField: 'reference',
    regex: /^PROD-(\d+)$/,
    tableName: 'Product',
    prefixFilter: 'PROD-',
  },
}

/**
 * Get the next code for preview (does NOT increment counter)
 */
export async function getNextCode(entityType: 'client' | 'supplier' | 'product'): Promise<string> {
  const config = CONFIGS[entityType]
  const nextNum = await _getNextNumber(config)
  return `${config.prefix}-${String(nextNum).padStart(config.digits, '0')}`
}

/**
 * Generate and increment the next code (used on entity creation)
 */
export async function generateNextCode(entityType: 'client' | 'supplier' | 'product'): Promise<string> {
  const config = CONFIGS[entityType]
  const nextNum = await _getNextNumber(config)
  // Increment the counter for next time
  await db.codeCounter.upsert({
    where: { entity: config.entity },
    update: { nextValue: nextNum + 1 },
    create: { entity: config.entity, nextValue: nextNum + 1 },
  })
  return `${config.prefix}-${String(nextNum).padStart(config.digits, '0')}`
}

/**
 * Internal: get the next number (MAX of counter and existing codes)
 */
async function _getNextNumber(config: CodeConfig): Promise<number> {
  // 1. Get persistent counter
  const counter = await db.codeCounter.findUnique({ where: { entity: config.entity } })
  const counterValue = counter?.nextValue ?? 0

  // 2. Get MAX existing code from database (safety net)
  const rows = await (db[config.tableName.toLowerCase() as keyof typeof db] as any).findMany({
    where: { [config.modelField]: { startsWith: config.prefixFilter } },
    select: { [config.modelField]: true },
  })
  let maxExisting = 0
  for (const row of rows) {
    const val = row[config.modelField]
    if (val) {
      const match = val.match(config.regex)
      if (match) maxExisting = Math.max(maxExisting, parseInt(match[1], 10))
    }
  }

  // 3. Return the higher of the two (never go backwards)
  return Math.max(counterValue, maxExisting)
}

/**
 * Initialize counters from existing data (run once during migration)
 */
export async function initCounters(): Promise<void> {
  for (const config of Object.values(CONFIGS)) {
    await generateNextCode(config.entity as any)
    // Undo the increment — we just want to set the counter to MAX existing + 1
    // Actually, let's just set it properly
    const rows = await (db[config.tableName.toLowerCase() as keyof typeof db] as any).findMany({
      where: { [config.modelField]: { startsWith: config.prefixFilter } },
      select: { [config.modelField]: true },
    })
    let maxExisting = 0
    for (const row of rows) {
      const val = row[config.modelField]
      if (val) {
        const match = val.match(config.regex)
        if (match) maxExisting = Math.max(maxExisting, parseInt(match[1], 10))
      }
    }
    await db.codeCounter.upsert({
      where: { entity: config.entity },
      update: { nextValue: maxExisting + 1 },
      create: { entity: config.entity, nextValue: maxExisting + 1 },
    })
    console.log(`  ${config.entity}: counter set to ${maxExisting + 1} (${config.prefix}-${String(maxExisting).padStart(config.digits, '0')} was max)`)
  }
}
