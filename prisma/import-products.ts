/**
 * Build-time product import script.
 * Reads prisma/products-import.json and replaces all products in the database.
 * Run: npx tsx prisma/import-products.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📦 Product import script started...')

  // Check if import data exists
  let products: Array<{
    reference: string
    designation: string
    famille: string | null
    sousFamille: string | null
    productType: 'achat' | 'vente' | 'semi_fini'
    priceHT: number
    tvaRate: number
    unit: string
    currentStock: number
    minStock: number
    maxStock: number
    averageCost: number
    isActive: boolean
  }>

  try {
    const data = await import('./products-import.json', { assert: { type: 'json' } })
    products = data.default as typeof products
  } catch {
    console.log('⚠️  No products-import.json found, skipping import.')
    return
  }

  if (!products || products.length === 0) {
    console.log('⚠️  Empty product list, skipping import.')
    return
  }

  console.log(`📊 Found ${products.length} products to import`)

  // Delete all existing products (cascade handles related records)
  const deleted = await prisma.product.deleteMany({})
  console.log(`🗑️  Deleted ${deleted.count} existing products`)

  // Insert in batches of 200
  const BATCH = 200
  let created = 0
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH)
    const result = await prisma.product.createMany({
      data: batch.map(p => ({
        reference: p.reference,
        designation: p.designation,
        famille: p.famille || null,
        sousFamille: p.sousFamille || null,
        productType: p.productType,
        priceHT: p.priceHT,
        tvaRate: p.tvaRate,
        unit: p.unit,
        currentStock: p.currentStock,
        minStock: p.minStock,
        maxStock: p.maxStock,
        averageCost: p.averageCost,
        isActive: p.isActive,
      })),
      skipDuplicates: true,
    })
    created += result.count
  }

  console.log(`✅ Imported ${created} products successfully`)
}

main()
  .catch((e) => {
    console.error('❌ Import error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
