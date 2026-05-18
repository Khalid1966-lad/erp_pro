import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const fieldSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  fontSize: z.number().default(12),
  fontWeight: z.string().default('normal'),
  textAlign: z.string().default('left'),
  fontFamily: z.string().default('sans-serif'),
  sortOrder: z.number().default(0),
})

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  bankName: z.string().optional(),
  chequeModel: z.string().optional(),
  chequeWidth: z.number().default(160),
  chequeHeight: z.number().default(75),
  scanOffsetX: z.number().optional().nullable(),
  scanOffsetY: z.number().optional().nullable(),
  backgroundImage: z.string().optional(),
  isDefault: z.boolean().default(false),
  fields: z.array(fieldSchema).optional(),
})

const updateSchema = createSchema.extend({
  id: z.string().min(1),
})

// GET - List all templates
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const templates = await db.chequeTemplate.findMany({
      include: {
        fields: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching cheque templates:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create template
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await db.chequeTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    }

    const template = await db.chequeTemplate.create({
      data: {
        name: data.name,
        description: data.description || null,
        bankName: data.bankName || null,
        chequeModel: data.chequeModel || null,
        chequeWidth: data.chequeWidth,
        chequeHeight: data.chequeHeight,
        scanOffsetX: data.scanOffsetX ?? null,
        scanOffsetY: data.scanOffsetY ?? null,
        backgroundImage: data.backgroundImage || null,
        isDefault: data.isDefault,
        fields: data.fields
          ? {
              create: data.fields.map((f, i) => ({
                fieldKey: f.fieldKey,
                label: f.label || null,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
                fontSize: f.fontSize,
                fontWeight: f.fontWeight,
                textAlign: f.textAlign,
                fontFamily: f.fontFamily,
                sortOrder: f.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating cheque template:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Update template
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await db.chequeTemplate.updateMany({
        where: { isDefault: true, id: { not: data.id } },
        data: { isDefault: false },
      })
    }

    // Delete existing fields and recreate
    await db.chequeTemplateField.deleteMany({ where: { templateId: data.id } })

    const template = await db.chequeTemplate.update({
      where: { id: data.id },
      data: {
        name: data.name,
        description: data.description || null,
        bankName: data.bankName || null,
        chequeModel: data.chequeModel || null,
        chequeWidth: data.chequeWidth,
        chequeHeight: data.chequeHeight,
        scanOffsetX: data.scanOffsetX ?? null,
        scanOffsetY: data.scanOffsetY ?? null,
        backgroundImage: data.backgroundImage || null,
        isDefault: data.isDefault,
        fields: data.fields
          ? {
              create: data.fields.map((f, i) => ({
                fieldKey: f.fieldKey,
                label: f.label || null,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
                fontSize: f.fontSize,
                fontWeight: f.fontWeight,
                textAlign: f.textAlign,
                fontFamily: f.fontFamily,
                sortOrder: f.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error updating cheque template:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Delete template
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    await db.chequeTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cheque template:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
