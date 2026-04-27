import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'
import { z } from 'zod'

const bulkProductSchema = z.array(z.object({
  reference: z.string().min(1),
  designation: z.string().min(1),
  famille: z.string().nullable().optional(),
  sousFamille: z.string().nullable().optional(),
  productType: z.string(),
  priceHT: z.number().min(0),
  tvaRate: z.number().default(20),
  unit: z.string().default('unité'),
  currentStock: z.number().default(0),
  minStock: z.number().default(0),
  maxStock: z.number().default(100),
  averageCost: z.number().default(0),
  isActive: z.boolean().default(true),
}))

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé au super administrateur' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const products = bulkProductSchema.parse(body)

    if (products.length === 0) {
      return NextResponse.json({ error: 'Aucun produit à importer' }, { status: 400 })
    }

    // Delete all existing products (cascade handles related records)
    const deletedCount = await db.product.deleteMany({})
    console.log(`Bulk import: deleted ${deletedCount.count} existing products`)

    // Insert new products in batches of 200
    const BATCH_SIZE = 200
    let created = 0
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      const result = await db.product.createMany({
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

    await auditLog(auth.userId, 'bulk_import', 'Product', null, null, {
      deletedCount: deletedCount.count,
      importedCount: created,
    })

    return NextResponse.json({
      success: true,
      deleted: deletedCount.count,
      imported: created,
      message: `${created} produits importés, ${deletedCount.count} anciens supprimés.`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors.slice(0, 5) }, { status: 400 })
    }
    console.error('Bulk import error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
