import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl || (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://'))) {
    throw new Error(
      `Invalid DATABASE_URL: must start with postgresql:// or postgres://. Got: ${databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'undefined'}`
    )
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
