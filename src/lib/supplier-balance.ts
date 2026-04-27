import { db } from '@/lib/db'

/**
 * Recalculate a single supplier's balance from actual transaction data.
 *
 * Balance logic:
 *   balance = Σ(supplierInvoices.totalTTC where not cancelled)
 *           - Σ(supplierPayments.amount via PaymentLines)
 *           - Σ(supplierCreditNotes.totalTTC where not cancelled)
 *           + Σ(rejected_effets.montant)
 */
export async function recalculateSupplierBalance(supplierId: string): Promise<number> {
  const [invoicesAgg, paymentsAgg, creditNotesAgg, rejetEffetsAgg] = await Promise.all([
    // Total supplier invoices (not cancelled)
    db.supplierInvoice.aggregate({
      where: { supplierId, status: { not: 'cancelled' } },
      _sum: { totalTTC: true },
    }),

    // Total supplier payments linked to this supplier's invoices via PaymentLines
    db.paymentLine.aggregate({
      where: {
        supplierInvoice: { supplierId },
      },
      _sum: { amount: true },
    }),

    // Total supplier credit notes (not cancelled)
    db.supplierCreditNote.aggregate({
      where: { supplierId, status: { not: 'cancelled' } },
      _sum: { totalTTC: true },
    }),

    // Rejected cheques/effets linked to supplier payments via PaymentLines
    db.effetCheque.aggregate({
      where: {
        statut: 'rejete',
        payment: {
          paymentLines: {
            some: {
              supplierInvoice: { supplierId },
            },
          },
        },
      },
      _sum: { montant: true },
    }),
  ])

  const invoiceTotal = invoicesAgg._sum.totalTTC || 0
  const paymentTotal = paymentsAgg._sum.amount || 0
  const creditNoteTotal = creditNotesAgg._sum.totalTTC || 0
  const rejetTotal = rejetEffetsAgg._sum.montant || 0

  return Math.round((invoiceTotal - paymentTotal - creditNoteTotal + rejetTotal) * 100) / 100
}

/**
 * Update a single supplier's balance in the database.
 */
export async function syncSupplierBalance(supplierId: string): Promise<number> {
  const balance = await recalculateSupplierBalance(supplierId)

  await db.supplier.update({
    where: { id: supplierId },
    data: { balance },
  })

  return balance
}

/**
 * Sync balances for ALL suppliers.
 */
export async function syncAllSupplierBalances(): Promise<{
  total: number
  updated: number
  unchanged: number
}> {
  const suppliers = await db.supplier.findMany({
    select: { id: true, name: true, balance: true },
  })

  let updated = 0
  let unchanged = 0

  for (const supplier of suppliers) {
    const newBalance = await recalculateSupplierBalance(supplier.id)

    if (supplier.balance !== newBalance) {
      await db.supplier.update({
        where: { id: supplier.id },
        data: { balance: newBalance },
      })
      updated++
    } else {
      unchanged++
    }
  }

  return { total: suppliers.length, updated, unchanged }
}
