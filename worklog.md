---
Task ID: 1
Agent: Main
Task: Fix dropdowns for clients, suppliers, and products across all views

Work Log:
- Explored codebase to map ALL client/supplier/product dropdown usage
- Found root cause: Suppliers API had NO `dropdown=true` mode (only 50 records returned)
- Found client dropdowns in 4 views using default `/clients` (50 records only)
- Found product dropdowns in 4 views using default `/products` (50 records only)
- Found ProductCombobox hardcoded `slice(0, 50)` limiting display even with all data
- Found product table columns too narrow (w-48=192px, w-[220px]) in 11 views

Fixes applied:
1. Added `dropdown=true` mode to `/api/suppliers` route (returns all with minimal fields)
2. Updated 7 client dropdown calls to use `?dropdown=true`
3. Updated 6 supplier dropdown calls to use `?dropdown=true`  
4. Updated 4 product dropdown calls to use `?dropdown=true`
5. Removed `slice(0, 50)` from ProductCombobox component
6. Widened product columns from w-48/w-[220px] to min-w-[300px] in 11 views
7. Fixed payments-view.tsx client/supplier dropdowns to use dropdown=true

Stage Summary:
- 15 files modified, commit e2a2c70 pushed to GitHub main branch
- All dropdowns now show ALL clients/suppliers/products with search functionality
- Product columns now wide enough to show full product names

---
Task ID: 2
Agent: Main
Task: Sidebar cadenas (lock) for unauthorized sections + fix caisse print

Work Log:
- Analyzed existing sidebar navigation code in erp-layout.tsx
- Analyzed existing permission system: hasPermission in auth store, permission mapping on NavItems
- Analyzed ViewRouter in page.tsx for view-level permission control
- Analyzed caisse print code in cash-registers-view.tsx

Changes applied:
1. erp-layout.tsx - Sidebar lock implementation:
   - ALL nav items now always visible (removed hiding of superAdminOnly items)
   - Each item checked with isItemAccessible() for permission
   - Unauthorized items: opacity-50, cursor-not-allowed, no hover effects
   - Lock icon (lucide Lock) shown after label in expanded mode
   - Lock badge shown on icon in collapsed mode
   - Lock icon shown in tooltip for collapsed mode
   - Click on locked item: toast.error('Accès restreint') - no navigation
   - Super admin: all items accessible, no locks shown
   - Added toast import from 'sonner'

2. page.tsx - View-level permission gate:
   - Added VIEW_PERMISSIONS mapping (view ID → required permission string)
   - Added SUPER_ADMIN_ONLY_VIEWS set ('users', 'roles')
   - Added LockedPlaceholder component (Lock icon + "Accès restreint" message)
   - ViewRouter checks permissions before rendering views
   - Unauthorized views show LockedPlaceholder with animation instead of actual view
   - Super admin bypasses all permission checks

3. cash-registers-view.tsx - Caisse print fix:
   - Removed unused PrintHeader import (line 33)
   - Verified handlePrintStatement function is correct

Stage Summary:
- 3 files modified, commit 28d1ba5 pushed to GitHub main branch
- Sidebar shows cadenas (lock) for all unauthorized sections
- No visualization permitted for locked sections
- Super admins have all powers, no locks displayed
- Caisse print button fixed (removed unused import)
---
Task ID: 2
Agent: main
Task: Implement hierarchical RBAC role permission system with sidebar-mirroring checkboxes and cadenas (lock) icons

Work Log:
- Created shared permissions config at `src/lib/permissions.ts` defining MENU_PERMISSIONS structure that mirrors sidebar hierarchy
- Updated `src/components/erp/erp-layout.tsx` — assigned unique individual permissions to ALL sidebar sub-menu items (previously many shared composite permissions like `stock:read`)
- Updated `src/lib/auth.ts` — added backward-compatible permission expansion (old composite keys like `stock:read` auto-grant new sub-permissions), updated hardcodedPermissions, expanded permissions in getPermissionsForUser
- Updated `src/app/api/roles/route.ts` — now imports ALL_PERMISSION_FLAT from shared config
- Rewrote `src/components/erp/admin/roles-view.tsx` — new hierarchical checkbox UI with:
  - Collapsible groups matching sidebar (Tableau de bord, Ventes, Achats, Stock, Production, Finance, Communication, Administration)
  - Parent checkbox per group to select/deselect all items
  - Child checkbox per sub-menu item with lock/unlock icons
  - Counter badges showing X/Y items checked per group
  - Read-only view dialog showing locked (cadenas) vs unlocked items
  - "Tout sélectionner / Tout désélectionner" for all menus

Stage Summary:
- 40 individual permission keys now cover every sidebar sub-menu independently
- Backward compatibility ensures existing roles with old composite permissions still work
- Super admin has unrestricted access (no cadenas)
- Custom roles with checkbox-based permission management matching sidebar structure
- Sidebar already shows cadenas (Lock icon from lucide-react) on unauthorized items with toast message
---
Task ID: 3
Agent: Main
Task: Fix employee-functions dropdown, photo upload, guide update, version 1.6.1

Work Log:
- Fixed employee-functions dropdown API: was returning plain array, now returns { functions: [...] }
- Fixed employees GET response mapping: API returns fonction: { id, name } but view expected fonctionId/fonctionName — added client-side mapping
- Replaced photo URL text input with file upload + client-side canvas compression
- Created compressImage utility: scales to max 1024px, iteratively reduces JPEG quality, falls back to 75% resize
- Created /api/upload route for server-side size validation
- Added RHSection to guide-view.tsx covering: fonctions system, salariés management, photo upload, commercial assignment
- Added RBAC permissions section and Actualiser button section to Administration guide
- Added 'rh' section to guide sidebar with sous-items: salaries, fonctions
- Bumped version from 1.6.0 to 1.6.1

Stage Summary:
- 5 files modified, commit 6ca4b75 pushed to GitHub main
- Dropdown fonctions now populates correctly in employee form
- Photo upload with automatic compression (max 500KB)
- Guide updated with RH module, RBAC, and Actualiser button documentation
- Version 1.6.1

---
Task ID: 2
Agent: Main
Task: Date picker manuel + codes auto-incrémentés (CL/FR/PROD)

Work Log:
- Replaced Calendar/Popover date picker in employees-view.tsx with native `<Input type="date">` allowing year selection and manual keyboard entry
- Removed unused Popover/Calendar imports from employees-view.tsx
- Added `code String @unique` field to Client model in prisma/schema.prisma
- Used raw SQL migration to add column, generate unique codes (CL-0001 to CL-0760) for 760 existing rows, and add unique constraint
- Updated /api/clients POST to auto-generate client code (CL-XXXX format)
- Updated /api/clients GET with ?nextCode=true query param for preview
- Added code to client GET select fields (list and dropdown)
- Updated /api/suppliers POST to auto-generate supplier code (FR-XXXX format)
- Updated /api/suppliers GET with ?nextCode=true query param
- Updated /api/products POST to auto-generate product reference (PROD-XXXX format)
- Updated /api/products GET with ?nextCode=true query param
- Updated suppliers-view.tsx: openCreate fetches next code, code field now disabled (read-only), removed client-side code validation
- Updated products-view.tsx: openCreate fetches next code, reference field disabled during creation, removed reference check in handleSave
- Updated clients-view.tsx: added code field to Client interface, added Code column to table, added autoCode state with useEffect to fetch next code, displayed code as read-only in form
- Updated prisma/seed.ts: added code field to all client and supplier seed data
- All changes pushed to GitHub (commit 917fba3)

Stage Summary:
- Date picker: native HTML5 date input with year/month/day dropdowns and manual keyboard entry
- Client code: auto-incremented CL-0001, CL-0002, etc. — displayed in form and list table
- Supplier code: auto-incremented FR-0001, FR-0002, etc. — read-only field
- Product reference: auto-incremented PROD-0001, PROD-0002, etc. — read-only during creation
- All existing 760 clients retroactively assigned unique codes
- API endpoints support ?nextCode=true for preview

---
Task ID: 4
Agent: Main
Task: Ajouter N° Commande Client obligatoire sur les commandes + filtre BL

Work Log:
- Added `clientOrderNumber String` (required) field to SalesOrder model in prisma/schema.prisma
- Used SQL migration: added column with default, filled existing 5 rows, set NOT NULL constraint
- Updated /api/sales-orders POST: added clientOrderNumber to Zod validation (min 1, required), save on create
- Updated /api/sales-orders GET: added clientOrderNumber search filter (dedicated param + in global search)
- Updated /api/delivery-notes GET: added clientOrderNumber filter param via salesOrder relation
- Updated /api/delivery-notes deliveryNoteInclude: switched salesOrder from include to select, added clientOrderNumber
- Updated sales-orders-view.tsx: added formClientOrderNumber state, validation, field in create/edit dialog
- Updated sales-orders-view.tsx: added N° Cmd Client column to list table (replacing Numéro with N° Interne + N° Cmd Client)
- Updated sales-orders-view.tsx: added clientOrderNumber to print infoGrid (inline detail + detail dialog)
- Updated delivery-notes-view.tsx: added filterClientOrderNumber state + filter input in filters section
- Updated delivery-notes-view.tsx: added N° Cmd Client column to BL list table
- Updated delivery-notes-view.tsx: added clientOrderNumber to print infoGrid (inline detail + detail dialog)
- Updated DeliveryNote and SalesOrderOption TypeScript interfaces

Stage Summary:
- 5 files modified, commit a996d1a pushed to GitHub main
- N° Commande Client: champ de saisie manuelle obligatoire dans le formulaire de commande
- Code auto (BC-YYYY-NNNN) conservé comme numéro interne
- Liste commandes: colonnes N° Interne + N° Cmd Client
- Liste BL: colonne N° Cmd Client visible + filtre dédié
- Impressions: N° Cmd Client affiché sur les documents Commande et BL

---
Task ID: 5
Agent: Main
Task: Replace salesOrder.number with salesOrder.clientOrderNumber + Move IconLegend outside Table

Work Log:

**Task A: Replace `salesOrder.number` → `salesOrder.clientOrderNumber` in 3 frontend files**

1. delivery-notes-view.tsx:
   - Removed `number: string` from `SalesOrderOption` interface
   - Removed `number: string` from `DeliveryNote.salesOrder` sub-interface (kept `clientOrderNumber`)
   - Changed `en.salesOrder.number` → `en.salesOrder.clientOrderNumber` (inline print)
   - Changed `order.number` → `order.clientOrderNumber` (order selector in create dialog)
   - Changed `selectedNote.salesOrder.number` → `selectedNote.salesOrder.clientOrderNumber` (detail print)

2. invoices-view.tsx:
   - Changed `Invoice.salesOrder` type: `{ id: string; number: string }` → `{ id: string; clientOrderNumber: string }`
   - Changed `UninvoicedBL.salesOrder` type: same replacement
   - Changed `invoice.salesOrder.number` → `invoice.salesOrder.clientOrderNumber` (table row)
   - Changed `bl.salesOrder.number` → `bl.salesOrder.clientOrderNumber` (BL selection dialog)
   - Changed `selectedInvoice.salesOrder.number` → `selectedInvoice.salesOrder.clientOrderNumber` (detail dialog)

3. preparations-view.tsx:
   - Changed `Preparation.salesOrder.number` → `clientOrderNumber` in interface
   - Changed `SalesOrderOption.number` → `clientOrderNumber` in interface
   - Changed `prep.salesOrder.number` → `prep.salesOrder.clientOrderNumber` (table row)
   - Changed `ep.salesOrder.number` → `ep.salesOrder.clientOrderNumber` (inline detail, 2 locations)
   - Changed `selectedPrep.salesOrder.number` → `selectedPrep.salesOrder.clientOrderNumber` (detail dialog, 2 locations)
   - Changed `so.number` → `so.clientOrderNumber` (create dialog order selector)

**Task B: Move `<IconLegend>` outside `<Table>` in 12 files**

Moved `<IconLegend items={...LegendItems} />` from inside `<Table>` to before it, fixing invalid HTML (`<div>` inside `<table>`):

Commercial (6 files):
1. delivery-notes-view.tsx — line ~1151
2. quotes-view.tsx — line ~540
3. invoices-view.tsx — line ~646
4. credit-notes-view.tsx — line ~439
5. preparations-view.tsx — line ~561
6. customer-returns-view.tsx — line ~810

Purchasing (6 files):
7. purchase-orders-view.tsx — line ~651
8. receptions-view.tsx — line ~508
9. supplier-quotes-view.tsx — line ~717
10. supplier-invoices-view.tsx — line ~713
11. supplier-returns-view.tsx — line ~687
12. price-requests-view.tsx — line ~627

Stage Summary:
- 15 files modified total (3 for Task A, 12 for Task B; delivery-notes-view.tsx, invoices-view.tsx, preparations-view.tsx had both tasks applied)
- All `salesOrder.number` references replaced with `salesOrder.clientOrderNumber`
- All IconLegend components moved outside Table, allowing proper horizontal flex layout
- ESLint passes with no errors
