import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'

// ── Tables to DELETE (transactional data) in FK-safe reverse order ──
const TABLES_TO_DELETE = [
  // Communication
  'Message',
  'ConversationParticipant',
  'Conversation',
  'Notification',
  // Finance
  'EffetCheque',
  'PaymentLine',
  'Payment',
  'AccountingEntry',
  'BankTransaction',
  'CashMovement',
  // Purchasing (children first)
  'SupplierCreditNoteLine',
  'SupplierCreditNote',
  'SupplierReturnLine',
  'SupplierReturn',
  'SupplierInvoiceLine',
  'SupplierInvoice',
  'ReceptionLine',
  'Reception',
  'PurchaseOrderLine',
  'PurchaseOrder',
  'SupplierQuoteLine',
  'SupplierQuote',
  'PriceRequestLine',
  'PriceRequest',
  // Sales (children first)
  'CustomerReturnLine',
  'CustomerReturn',
  'CreditNoteLine',
  'CreditNote',
  'InvoiceDeliveryNote',
  'InvoiceLine',
  'Invoice',
  'DeliveryNoteLine',
  'DeliveryNote',
  'PreparationLine',
  'PreparationOrder',
  'SalesOrderLine',
  'SalesOrder',
  'QuoteLine',
  'Quote',
  // Stock & Inventory
  'InventoryLine',
  'Inventory',
  'StockMovement',
  // Production
  'QualityControlLine',
  'QualityControl',
  'OTMPiece',
  'OrdreTravailMaintenance',
  'ProductionBatch',
  'LotMouvement',
  'Lot',
  'WorkOrderStep',
  'WorkOrder',
  // Cash & Bank
  'CashRegister',
  'BankAccount',
  // Payment counter
  'PaymentCodeCounter',
  // Client documents
  'ClientDocument',
]

// ── SQL table names for tables with @@map ──
const TABLE_SQL_NAMES: Record<string, string> = {
  Role: 'roles',
  RolePermission: 'role_permissions',
  EmployeeFunction: 'employee_functions',
  Employee: 'employees',
  Chantier: 'chantiers',
  CustomerReturn: 'customer_returns',
  CustomerReturnLine: 'customer_return_lines',
  PaymentCodeCounter: 'payment_code_counters',
}

function getSqlTableName(model: string): string {
  return TABLE_SQL_NAMES[model] || model
}

// POST — Reset database (super admin contact@jazelwebagency.com only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Only specific super admin email can access
  if (auth.role !== 'super_admin' || auth.email !== 'contact@jazelwebagency.com') {
    return NextResponse.json({ error: 'Accès restreint' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { confirm } = body

    if (confirm !== 'RESET') {
      return NextResponse.json({ error: 'Confirmation invalide. Tapez RESET.' }, { status: 400 })
    }

    const result = await db.$transaction(
      async (tx: any) => {
        const deleted: Record<string, number> = {}

        // Phase 1: Delete all transactional tables in FK-safe reverse order
        for (const table of TABLES_TO_DELETE) {
          const sqlTable = getSqlTableName(table)
          const countResult: Array<{ count: bigint }> = await tx.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${sqlTable}"`)
          const count = Number(countResult[0]?.count || 0)
          await tx.$executeRawUnsafe(`DELETE FROM "${sqlTable}"`)
          deleted[table] = count
        }

        // Phase 2: Reset product stock and cost
        const productResult = await tx.product.updateMany({
          data: { currentStock: 0, averageCost: 0 },
        })

        // Phase 3: Reset client balances
        const clientResult = await tx.client.updateMany({
          data: {
            balance: 0,
            caTotalHT: 0,
            nbCommandes: 0,
            panierMoyen: 0,
            tauxRetour: 0,
            nbImpayes: 0,
            delaiMoyenPaiement: 0,
          },
        })

        // Phase 4: Reset supplier balances
        const supplierResult = await tx.supplier.updateMany({
          data: { balance: 0 },
        })

        // Phase 5: Clear audit log
        await tx.$executeRawUnsafe(`DELETE FROM "AuditLog"`)
        deleted['AuditLog'] = 0

        // Phase 6: Clear user connection info
        await tx.user.updateMany({
          data: { lastLogin: null, lastSeen: null },
        })

        return {
          deleted,
          productsReset: productResult.count,
          clientsReset: clientResult.count,
          suppliersReset: supplierResult.count,
        }
      },
      { timeout: 300_000 }
    )

    // Audit log (after transaction, using fresh db)
    await auditLog(auth.userId, 'reset', 'Database', 'all', null, { action: 'full_reset', result })

    return NextResponse.json({
      success: true,
      message: 'Base de données réinitialisée avec succès',
      ...result,
    })
  } catch (error: any) {
    console.error('Database reset error:', error)
    return NextResponse.json({ error: 'Erreur lors de la réinitialisation' }, { status: 500 })
  }
}
