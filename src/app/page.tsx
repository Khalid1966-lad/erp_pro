'use client'

import { useAuthStore, useNavStore } from '@/lib/stores'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'

import LoginPage from '@/components/erp/login-page'
import { ERPSidebar, ERPHeader } from '@/components/erp/erp-layout'

// Lazy-load all views to keep the initial bundle small
const DashboardView = dynamic(() => import('@/components/erp/dashboard/dashboard-view'), { ssr: false })
const ClientsView = dynamic(() => import('@/components/erp/commercial/clients-view'), { ssr: false })
const ProductsView = dynamic(() => import('@/components/erp/commercial/products-view'), { ssr: false })
const QuotesView = dynamic(() => import('@/components/erp/commercial/quotes-view'), { ssr: false })
const SalesOrdersView = dynamic(() => import('@/components/erp/commercial/sales-orders-view'), { ssr: false })
const PreparationsView = dynamic(() => import('@/components/erp/commercial/preparations-view'), { ssr: false })
const InvoicesView = dynamic(() => import('@/components/erp/commercial/invoices-view'), { ssr: false })
const CreditNotesView = dynamic(() => import('@/components/erp/commercial/credit-notes-view'), { ssr: false })
const DeliveryNotesView = dynamic(() => import('@/components/erp/commercial/delivery-notes-view'), { ssr: false })
const CustomerReturnsView = dynamic(() => import('@/components/erp/commercial/customer-returns-view'), { ssr: false })
const SuppliersView = dynamic(() => import('@/components/erp/purchasing/suppliers-view'), { ssr: false })
const PurchaseOrdersView = dynamic(() => import('@/components/erp/purchasing/purchase-orders-view'), { ssr: false })
const ReceptionsView = dynamic(() => import('@/components/erp/purchasing/receptions-view'), { ssr: false })
const PriceRequestsView = dynamic(() => import('@/components/erp/purchasing/price-requests-view'), { ssr: false })
const SupplierQuotesView = dynamic(() => import('@/components/erp/purchasing/supplier-quotes-view'), { ssr: false })
const SupplierInvoicesView = dynamic(() => import('@/components/erp/purchasing/supplier-invoices-view'), { ssr: false })
const SupplierReturnsView = dynamic(() => import('@/components/erp/purchasing/supplier-returns-view'), { ssr: false })
const SupplierCreditNotesView = dynamic(() => import('@/components/erp/purchasing/supplier-credit-notes-view'), { ssr: false })
const StockMovementsView = dynamic(() => import('@/components/erp/stock/stock-movements-view'), { ssr: false })
const StockAlertsView = dynamic(() => import('@/components/erp/stock/stock-alerts-view'), { ssr: false })
const InventoryView = dynamic(() => import('@/components/erp/stock/inventory-view'), { ssr: false })
const LotsView = dynamic(() => import('@/components/erp/production/lots-view'), { ssr: false })
const BomView = dynamic(() => import('@/components/erp/production/bom-view'), { ssr: false })
const RoutingView = dynamic(() => import('@/components/erp/production/routing-view'), { ssr: false })
const WorkstationsView = dynamic(() => import('@/components/erp/production/workstations-view'), { ssr: false })
const WorkOrdersView = dynamic(() => import('@/components/erp/production/work-orders-view'), { ssr: false })
const EquipementsView = dynamic(() => import('@/components/erp/production/equipements-view'), { ssr: false })
const MaintenanceView = dynamic(() => import('@/components/erp/production/maintenance-view'), { ssr: false })
const CashRegistersView = dynamic(() => import('@/components/erp/finance/cash-registers-view'), { ssr: false })
const BankAccountsView = dynamic(() => import('@/components/erp/finance/bank-accounts-view'), { ssr: false })
const PaymentsView = dynamic(() => import('@/components/erp/finance/payments-view'), { ssr: false })
const EffetsView = dynamic(() => import('@/components/erp/finance/effets-view'), { ssr: false })
const AccountingView = dynamic(() => import('@/components/erp/finance/accounting-view'), { ssr: false })
const FinancialReportsView = dynamic(() => import('@/components/erp/finance/financial-reports-view'), { ssr: false })
const AuditLogView = dynamic(() => import('@/components/erp/admin/audit-log-view'), { ssr: false })
const SettingsView = dynamic(() => import('@/components/erp/admin/settings-view'), { ssr: false })
const UsersView = dynamic(() => import('@/components/erp/admin/users-view'), { ssr: false })
const ProfileView = dynamic(() => import('@/components/erp/admin/profile-view'), { ssr: false })
const GuideView = dynamic(() => import('@/components/erp/admin/guide-view'), { ssr: false })
const MessagesView = dynamic(() => import('@/components/erp/messages/messages-view'), { ssr: false })
const QualityControlView = dynamic(() => import('@/components/erp/production/quality-control-view'), { ssr: false })

// ── Page transition variants ─────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1],
}

function ViewRouter() {
  const { currentView } = useNavStore()

  let view: React.ReactNode
  switch (currentView) {
    case 'dashboard': view = <DashboardView />; break
    case 'clients': view = <ClientsView />; break
    case 'products': view = <ProductsView />; break
    case 'quotes': view = <QuotesView />; break
    case 'sales-orders': view = <SalesOrdersView />; break
    case 'preparations': view = <PreparationsView />; break
    case 'invoices': view = <InvoicesView />; break
    case 'credit-notes': view = <CreditNotesView />; break
    case 'delivery-notes': view = <DeliveryNotesView />; break
    case 'customer-returns': view = <CustomerReturnsView />; break
    case 'suppliers': view = <SuppliersView />; break
    case 'purchase-orders': view = <PurchaseOrdersView />; break
    case 'receptions': view = <ReceptionsView />; break
    case 'price-requests': view = <PriceRequestsView />; break
    case 'supplier-quotes': view = <SupplierQuotesView />; break
    case 'supplier-invoices': view = <SupplierInvoicesView />; break
    case 'supplier-returns': view = <SupplierReturnsView />; break
    case 'supplier-credit-notes': view = <SupplierCreditNotesView />; break
    case 'stock-movements': view = <StockMovementsView />; break
    case 'stock-alerts': view = <StockAlertsView />; break
    case 'inventory': view = <InventoryView />; break
    case 'lots': view = <LotsView />; break
    case 'bom': view = <BomView />; break
    case 'routing': view = <RoutingView />; break
    case 'workstations': view = <WorkstationsView />; break
    case 'work-orders': view = <WorkOrdersView />; break
    case 'equipements': view = <EquipementsView />; break
    case 'maintenance': view = <MaintenanceView />; break
    case 'cash-registers': view = <CashRegistersView />; break
    case 'bank-accounts': view = <BankAccountsView />; break
    case 'payments': view = <PaymentsView />; break
    case 'effets': view = <EffetsView />; break
    case 'accounting': view = <AccountingView />; break
    case 'financial-reports': view = <FinancialReportsView />; break
    case 'audit-log': view = <AuditLogView />; break
    case 'settings': view = <SettingsView />; break
    case 'users': view = <UsersView />; break
    case 'profile': view = <ProfileView />; break
    case 'guide': view = <GuideView />; break
    case 'messages': view = <MessagesView />; break
    case 'quality-control': view = <QualityControlView />; break
    default: view = <DashboardView />; break
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="h-full"
      >
        {view}
      </motion.div>
    </AnimatePresence>
  )
}

function ERPApp() {
  return (
    <div className="flex h-screen overflow-hidden">
      <ERPSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <ERPHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ViewRouter />
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <ERPApp />
}
