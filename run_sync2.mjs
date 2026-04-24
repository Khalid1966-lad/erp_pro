import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_VjZ3u1cQOotx@ep-round-unit-aj8b7o9b-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
})

async function main() {
  // Get client IDs that actually have invoices
  const invoiceClientIds = await db.invoice.findMany({
    where: { status: { not: 'cancelled' } },
    select: { clientId: true },
    distinct: ['clientId'],
  })

  // Get client IDs that actually have credit notes
  const cnClientIds = await db.creditNote.findMany({
    where: { status: { not: 'cancelled' } },
    select: { clientId: true },
    distinct: ['clientId'],
  })

  // Get client IDs that have payments
  const payClientIds = await db.payment.findMany({
    where: { type: 'client_payment', invoiceId: { not: null } },
    select: { invoice: { select: { clientId: true } } },
    distinct: ['invoiceId'],
  })

  // Build unique set of client IDs
  const idSet = new Set()
  for (const c of invoiceClientIds) idSet.add(c.clientId)
  for (const c of cnClientIds) idSet.add(c.clientId)
  for (const p of payClientIds) if (p.invoice?.clientId) idSet.add(p.invoice.clientId)

  const clientIds = [...idSet]
  console.log(`\n📊 ${clientIds.length} clients avec transactions réelles\n`)

  let updated = 0
  let unchanged = 0

  // Process in batches of 20
  for (let i = 0; i < clientIds.length; i += 20) {
    const batch = clientIds.slice(i, i + 20)
    const clients = await db.client.findMany({
      where: { id: { in: batch }, isDeleted: false },
      select: { id: true, name: true, balance: true, nbImpayes: true },
    })

    for (const client of clients) {
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
        console.log(`  ✅ ${client.name}: solde ${client.balance} → ${balance} MAD | impayés ${client.nbImpayes} → ${nbImpayes}`)
      } else {
        unchanged++
      }
    }

    process.stdout.write(`  Traité ${Math.min(i + 20, clientIds.length)}/${clientIds.length}...\r`)
  }

  console.log(`\n\n📈 Résultat: ${updated} mis à jour, ${unchanged} inchangés (total: ${clientIds.length})`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
