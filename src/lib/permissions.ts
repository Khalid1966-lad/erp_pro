/**
 * Centralized permission structure that mirrors the sidebar hierarchy.
 * Used by: roles-view.tsx (UI), api/roles/route.ts (validation), erp-layout.tsx (sidebar)
 *
 * Each menu group maps to the sidebar's NavGroup.
 * Each item maps to a sidebar NavItem with a unique permission key.
 * Checking a checkbox grants both `:read` and `:write` permissions.
 */

export interface SubMenuPermission {
  id: string        // sidebar ViewId
  label: string     // display label
  permissions: string[]  // e.g. ['clients:read', 'clients:write']
}

export interface MenuGroupPermission {
  group: string           // sidebar group title (e.g. "Ventes")
  items: SubMenuPermission[]
}

// ─────────────────────────────────────────────────────────
//  PERMISSION STRUCTURE — mirrors sidebar exactly
// ─────────────────────────────────────────────────────────
export const MENU_PERMISSIONS: MenuGroupPermission[] = [
  {
    group: 'Tableau de bord',
    items: [
      { id: 'dashboard', label: "Vue d'ensemble", permissions: ['dashboard:read'] },
    ],
  },
  {
    group: 'Ventes',
    items: [
      { id: 'clients', label: 'Clients', permissions: ['clients:read', 'clients:write'] },
      { id: 'quotes', label: 'Devis', permissions: ['quotes:read', 'quotes:write'] },
      { id: 'sales-orders', label: 'Commandes', permissions: ['sales_orders:read', 'sales_orders:write'] },
      { id: 'preparations', label: 'Préparations', permissions: ['preparations:read', 'preparations:write'] },
      { id: 'delivery-notes', label: 'Bons de livraison', permissions: ['delivery_notes:read', 'delivery_notes:write'] },
      { id: 'customer-returns', label: 'Bons de retour clients', permissions: ['customer_returns:read', 'customer_returns:write'] },
      { id: 'invoices', label: 'Factures', permissions: ['invoices:read', 'invoices:write'] },
      { id: 'credit-notes', label: 'Avoirs', permissions: ['credit_notes:read', 'credit_notes:write'] },
    ],
  },
  {
    group: 'Achats',
    items: [
      { id: 'suppliers', label: 'Fournisseurs', permissions: ['suppliers:read', 'suppliers:write'] },
      { id: 'price-requests', label: 'Demandes de prix', permissions: ['price_requests:read', 'price_requests:write'] },
      { id: 'supplier-quotes', label: 'Devis fournisseurs', permissions: ['supplier_quotes:read', 'supplier_quotes:write'] },
      { id: 'purchase-orders', label: 'Commandes fournisseurs', permissions: ['purchase_orders:read', 'purchase_orders:write'] },
      { id: 'receptions', label: 'Réceptions', permissions: ['receptions:read', 'receptions:write'] },
      { id: 'supplier-returns', label: 'Bons de retour', permissions: ['supplier_returns:read', 'supplier_returns:write'] },
      { id: 'supplier-credit-notes', label: 'Avoirs fournisseurs', permissions: ['supplier_credit_notes:read', 'supplier_credit_notes:write'] },
      { id: 'supplier-invoices', label: 'Factures fournisseurs', permissions: ['supplier_invoices:read', 'supplier_invoices:write'] },
    ],
  },
  {
    group: 'Stock',
    items: [
      { id: 'products', label: 'Produits', permissions: ['products:read', 'products:write'] },
      { id: 'stock-movements', label: 'Mouvements', permissions: ['stock_movements:read', 'stock_movements:write'] },
      { id: 'stock-alerts', label: 'Alertes stock', permissions: ['stock_alerts:read', 'stock_alerts:write'] },
      { id: 'inventory', label: 'Inventaires', permissions: ['inventory:read', 'inventory:write'] },
      { id: 'lots', label: 'Lots de stock', permissions: ['stock_lots:read', 'stock_lots:write'] },
    ],
  },
  {
    group: 'Production',
    items: [
      { id: 'bom', label: 'Nomenclatures', permissions: ['bom:read', 'bom:write'] },
      { id: 'routing', label: 'Gammes', permissions: ['routing:read', 'routing:write'] },
      { id: 'workstations', label: 'Postes de travail', permissions: ['workstations:read', 'workstations:write'] },
      { id: 'work-orders', label: 'Ordres de fabrication', permissions: ['work_orders:read', 'work_orders:write'] },
      { id: 'equipements', label: 'Équipements', permissions: ['equipments:read', 'equipments:write'] },
      { id: 'maintenance', label: 'Maintenance', permissions: ['maintenance:read', 'maintenance:write'] },
      { id: 'quality-control', label: 'Contrôle qualité', permissions: ['quality_control:read', 'quality_control:write'] },
    ],
  },
  {
    group: 'Finance',
    items: [
      { id: 'cash-registers', label: 'Caisses', permissions: ['cash:read', 'cash:write'] },
      { id: 'bank-accounts', label: 'Banque', permissions: ['bank:read', 'bank:write'] },
      { id: 'payments', label: 'Paiements', permissions: ['payments:read', 'payments:write'] },
      { id: 'effets', label: 'Chèques & Effets', permissions: ['effets_cheques:read', 'effets_cheques:write'] },
      { id: 'accounting', label: 'Comptabilité', permissions: ['accounting:read', 'accounting:write'] },
      { id: 'financial-reports', label: 'États financiers', permissions: ['financial_reports:read', 'financial_reports:write'] },
    ],
  },
  {
    group: 'Communication',
    items: [
      { id: 'messages', label: 'Messagerie', permissions: ['messages:read'] },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'audit-log', label: "Journal d'audit", permissions: ['audit_log:read'] },
      { id: 'settings', label: 'Paramètres', permissions: ['settings:read', 'settings:write'] },
      { id: 'guide', label: "Guide d'utilisation", permissions: ['guide:read'] },
    ],
  },
]

// Flatten all permissions for validation
export const ALL_PERMISSION_FLAT: string[] = MENU_PERMISSIONS.flatMap(g =>
  g.items.flatMap(i => i.permissions)
)

// Total count of sub-menu items (not individual permission keys)
export const TOTAL_MENU_ITEMS: number = MENU_PERMISSIONS.reduce((sum, g) => sum + g.items.length, 0)

// Map from sidebar item ID to its primary :read permission (used for sidebar access check)
export const ITEM_READ_PERMISSION: Record<string, string> = {}
MENU_PERMISSIONS.forEach(g => {
  g.items.forEach(item => {
    const readPerm = item.permissions.find(p => p.endsWith(':read'))
    if (readPerm) ITEM_READ_PERMISSION[item.id] = readPerm
  })
})
