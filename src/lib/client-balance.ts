import { db } from '@/lib/db'

/**
 * Recalculate a single client's balance and nbImpayes from actual transaction data.
 *
 * Balance logic (same as statement API):
 *   balance = Σ(invoices.totalTTC where not cancelled) - Σ(payments.amount) - Σ(creditNotes.totalTTC where not cancelled)
 *   + Σ(rejected_effets.montant where cheque/effet was rejected)
 *
 * nbImpayes logic:
 *   Count of invoices with status in ('validated', 'sent', 'overdue') — not 'paid', not 'draft', not 'cancelled'
 */
export async function recalculateClientBalance(clientId: string): Promise<{ balance: number; nbImpayes: number }> {
  const [invoicesAgg, paymentsAgg, creditNotesAgg, rejetEffetsAgg, unpaidCount] = await Promise.all([
    // Total invoices (not cancelled)
    db.invoice.aggregate({
      where: { clientId, status: { not: 'cancelled' } },
      _sum: { totalTTC: true },
    }),

    // Total client payments linked to this client's invoices
    db.payment.aggregate({
      where: {
        type: 'client_payment',
        invoiceId: { not: null },
        invoice: { clientId },
      },
      _sum: { amount: true },
    }),

    // Total credit notes (not cancelled)
    db.creditNote.aggregate({
      where: { clientId, status: { not: 'cancelled' } },
      _sum: { totalTTC: true },
    }),

    // Rejected cheques/effets (reversal of payment)
    db.effetCheque.aggregate({
      where: {
        statut: 'rejete',
        payment: {
          type: 'client_payment',
          invoice: { clientId },
        },
      },
      _sum: { montant: true },
    }),

    // Count of unpaid invoices
    db.invoice.count({
      where: {
        clientId,
        status: { in: ['validated', 'sent', 'overdue'] },
      },
    }),
  ])

  const invoiceTotal = invoicesAgg._sum.totalTTC || 0
  const paymentTotal = paymentsAgg._sum.amount || 0
  const creditNoteTotal = creditNotesAgg._sum.totalTTC || 0
  const rejetTotal = rejetEffetsAgg._sum.montant || 0

  const balance = Math.round((invoiceTotal - paymentTotal - creditNoteTotal + rejetTotal) * 100) / 100
  const nbImpayes = unpaidCount

  return { balance, nbImpayes }
}

/**
 * Update a single client's balance and nbImpayes in the database.
 */
export async function syncClientBalance(clientId: string): Promise<{ balance: number; nbImpayes: number }> {
  const { balance, nbImpayes } = await recalculateClientBalance(clientId)

  await db.client.update({
    where: { id: clientId },
    data: { balance, nbImpayes },
  })

  return { balance, nbImpayes }
}

/**
 * Sync balances for ALL clients. Returns stats about what was updated.
 */
export async function syncAllClientBalances(): Promise<{
  total: number
  updated: number
  unchanged: number
  details: Array<{ clientId: string; clientName: string; oldBalance: number; newBalance: number; oldNbImpayes: number; newNbImpayes: number }>
}> {
  const clients = await db.client.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, balance: true, nbImpayes: true },
  })

  let updated = 0
  let unchanged = 0
  const details: Array<{ clientId: string; clientName: string; oldBalance: number; newBalance: number; oldNbImpayes: number; newNbImpayes: number }> = []

  for (const client of clients) {
    const { balance, nbImpayes } = await recalculateClientBalance(client.id)

    if (client.balance !== balance || client.nbImpayes !== nbImpayes) {
      await db.client.update({
        where: { id: client.id },
        data: { balance, nbImpayes },
      })
      updated++
      details.push({
        clientId: client.id,
        clientName: client.name,
        oldBalance: client.balance,
        newBalance: balance,
        oldNbImpayes: client.nbImpayes,
        newNbImpayes: nbImpayes,
      })
    } else {
      unchanged++
    }
  }

  return { total: clients.length, updated, unchanged, details }
}
