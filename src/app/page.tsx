'use client'

import { useAuthStore, useNavStore } from '@/lib/stores'
import dynamic from 'next/dynamic'

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
const SuppliersView = dynamic(() => import('@/components/erp/purchasing/suppliers-view'), { ssr: false })
const PurchaseOrdersView = dynamic(() => import('@/components/erp/purchasing/purchase-orders-view'), { ssr: false })
const ReceptionsView = dynamic(() => import('@/components/erp/purchasing/receptions-view'), { ssr: false })
const StockMovementsView = dynamic(() => import('@/components/erp/stock/stock-movements-view'), { ssr: false })
const StockAlertsView = dynamic(() => import('@/components/erp/stock/stock-alerts-view'), { ssr: false })
const InventoryView = dynamic(() => import('@/components/erp/stock/inventory-view'), { ssr: false })
const BomView = dynamic(() => import('@/components/erp/production/bom-view'), { ssr: false })
const RoutingView = dynamic(() => import('@/components/erp/production/routing-view'), { ssr: false })
const WorkstationsView = dynamic(() => import('@/components/erp/production/workstations-view'), { ssr: false })
const WorkOrdersView = dynamic(() => import('@/components/erp/production/work-orders-view'), { ssr: false })
const CashRegistersView = dynamic(() => import('@/components/erp/finance/cash-registers-view'), { ssr: false })
const BankAccountsView = dynamic(() => import('@/components/erp/finance/bank-accounts-view'), { ssr: false })
const PaymentsView = dynamic(() => import('@/components/erp/finance/payments-view'), { ssr: false })
const AccountingView = dynamic(() => import('@/components/erp/finance/accounting-view'), { ssr: false })
const AuditLogView = dynamic(() => import('@/components/erp/admin/audit-log-view'), { ssr: false })
const SettingsView = dynamic(() => import('@/components/erp/admin/settings-view'), { ssr: false })
const UsersView = dynamic(() => import('@/components/erp/admin/users-view'), { ssr: false })
const ProfileView = dynamic(() => import('@/components/erp/admin/profile-view'), { ssr: false })

function ViewRouter() {
  const { currentView } = useNavStore()

  switch (currentView) {
    case 'dashboard': return <DashboardView />
    case 'clients': return <ClientsView />
    case 'products': return <ProductsView />
    case 'quotes': return <QuotesView />
    case 'sales-orders': return <SalesOrdersView />
    case 'preparations': return <PreparationsView />
    case 'invoices': return <InvoicesView />
    case 'credit-notes': return <CreditNotesView />
    case 'suppliers': return <SuppliersView />
    case 'purchase-orders': return <PurchaseOrdersView />
    case 'receptions': return <ReceptionsView />
    case 'stock-movements': return <StockMovementsView />
    case 'stock-alerts': return <StockAlertsView />
    case 'inventory': return <InventoryView />
    case 'bom': return <BomView />
    case 'routing': return <RoutingView />
    case 'workstations': return <WorkstationsView />
    case 'work-orders': return <WorkOrdersView />
    case 'cash-registers': return <CashRegistersView />
    case 'bank-accounts': return <BankAccountsView />
    case 'payments': return <PaymentsView />
    case 'accounting': return <AccountingView />
    case 'audit-log': return <AuditLogView />
    case 'settings': return <SettingsView />
    case 'users': return <UsersView />
    case 'profile': return <ProfileView />
    default: return <DashboardView />
  }
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
