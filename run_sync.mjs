import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_VjZ3u1cQOotx@ep-round-unit-aj8b7o9b-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

async function main() {
  // Only sync clients that actually have transactions
  const clientsWithTx = await db.$queryRaw`
    SELECT DISTINCT c.id, c.name, c."balance", c."nbImpayes"
    FROM "Client" c
    LEFT JOIN "Invoice" i ON i."clientId" = c.id AND i.status != 'cancelled'
    LEFT JOIN "CreditNote" cn ON cn."clientId" = c.id AND cn.status != 'cancelled'
    LEFT JOIN "Payment" p ON p.type = 'client_payment' AND p."invoiceId" IS NOT NULL
    LEFT JOIN "Invoice" ip ON ip.id = p."invoiceId" AND ip."clientId" = c.id
    WHERE c."isDeleted" = false
    AND (i.id IS NOT NULL OR cn.id IS NOT NULL OR p.id IS NOT NULL)
  `

  console.log(`\n📊 Clients avec transactions: ${clientsWithTx.length} (sur ${await db.client.count({ where: { isDeleted: false } })} total)\n`)
  console.log("Synchronisation en cours...\n")

  let updated = 0
  let unchanged = 0

  for (const client of clientsWithTx) {
    const [invoicesAgg, paymentsAgg, creditNotesAgg, rejetEffetsAgg, unpaidCount] = await Promise.all([
      db.invoice.aggregate({
        where: { clientId: client.id, status: { not: 'cancelled' } },
        _sum: { totalTTC: true },
      }),
      db.payment.aggregate({
        where: { type: 'client_payment', invoiceId: { not: null }, invoice: { clientId: client.id } },
        _sum: { amount: true },
      }),
      db.creditNote.aggregate({
        where: { clientId: client.id, status: { not: 'cancelled' } },
        _sum: { totalTTC: true },
      }),
      db.effetCheque.aggregate({
        where: { statut: 'rejete', payment: { type: 'client_payment', invoice: { clientId: client.id } } },
        _sum: { montant: true },
      }),
      db.invoice.count({
        where: { clientId: client.id, status: { in: ['validated', 'sent', 'overdue'] } },
      }),
    ])

    const invT = invoicesAgg._sum.totalTTC || 0
    const payT = paymentsAgg._sum.amount || 0
    const cnT = creditNotesAgg._sum.totalTTC || 0
    const rejT = rejetEffetsAgg._sum.montant || 0
    const balance = Math.round((invT - payT - cnT + rejT) * 100) / 100
    const nbImpayes = unpaidCount

    if (client.balance !== balance || client.nbImpayes !== nbImpayes) {
      await db.client.update({ where: { id: client.id }, data: { balance, nbImpayes } })
      updated++
      console.log(`  ✅ ${client.name}: ${client.balance} → ${balance} MAD | impayés ${client.nbImpayes} → ${nbImpayes}`)
    } else {
      unchanged++
    }
  }

  console.log(`\n📈 Résultat: ${updated} mis à jour, ${unchanged} inchangés`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
