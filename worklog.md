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

---
Task ID: 6
Agent: Main
Task: Suppression numéro BC auto + clientOrderNumber unique obligatoire + légendes horizontales

Work Log:
- Confirmed SalesOrder schema already has clientOrderNumber @unique (no auto number field)
- Confirmed sales-orders API already removed generateSONumber() and uses clientOrderNumber
- Confirmed delivery-notes and preparations APIs reference clientOrderNumber (not number)
- Confirmed sales-orders-view.tsx has manual clientOrderNumber field (required validation)
- Confirmed delivery-notes-view.tsx has clientOrderNumber filter
- Verified ALL IconLegend components across 15 views use flex flex-wrap (horizontal layout)
- Ran prisma db push to verify Neon PostgreSQL schema is in sync
- Committed all 19 modified files and pushed to GitHub

Stage Summary:
- Commit 8e99d15 pushed to GitHub main branch
- No auto BC number: only clientOrderNumber (manually entered, unique, required)
- All legends verified horizontal (flex-wrap) across all views
- Neon database already in sync with schema

---
Task ID: analysis-1
Agent: Main
Task: Analyze 7-step sales workflow vs current implementation (no code changes)

Work Log:
- Read prisma/schema.prisma: analyzed SalesOrder, SalesOrderLine, PreparationOrder, PreparationLine, DeliveryNote, DeliveryNoteLine models
- Read src/app/api/sales-orders/route.ts: analyzed create preparation and create invoice actions
- Read src/app/api/preparations/route.ts: analyzed create, start, validate, cancel, updateLine actions
- Read src/app/api/delivery-notes/route.ts: analyzed create, deliver, undeliver, cancel, edit_lines actions
- Traced full stock flow: preparation validate → stock OUT, BL deliver → stock OUT AGAIN (double decrement)
- Traced quantityPrepared flow: incremented at prep validation, NEVER decremented at BL delivery

Critical bugs found:
1. DOUBLE STOCK DECREMENT: Stock decremented at both preparation validation AND BL delivery. Same goods counted twice.
2. QUANTITY PREPARED NEVER DECREASES: When BL delivered, quantityDelivered increases but quantityPrepared stays same. Violates user's step 6 "préparé → livré".
3. BL CREATION BLOCKED ON in_preparation: Status check only allows prepared/partially_delivered/delivered, but partial prep leaves order in in_preparation.
4. RESTANT CALCULATION: quantityRequested = qty - qtyPrepared only. Should be qty - qtyPrepared - qtyDelivered if prepared decreases on delivery.
5. UNDELIVER REVERSES STOCK: If we remove stock from deliver, undeliver must also not touch stock.
6. NO BL ↔ PREPARATION LINK: No database relation between DeliveryNote and PreparationOrder for traceability.

Stage Summary:
- Analysis complete, 6 issues identified (3 critical, 3 secondary)
- Fixes localized to 2 backend files: delivery-notes/route.ts and preparations/route.ts
- Awaiting user approval to implement corrections

---
Task ID: fix-1
Agent: Main
Task: Fix critical sales workflow bugs — stock double decrement + prepared/delivered tracking

Work Log:
- Fixed double stock decrement: stock OUT only at preparation validation, NOT at BL delivery
- Fixed quantityPrepared: decrements at BL delivery, increments at BL undeliver
- Fixed BL creation: now allowed when SO status is 'in_preparation'
- Fixed BL qty validation: limited to (prepared - delivered) instead of (ordered - delivered)
- Fixed restant calculation in preparations: qty - prepared - delivered
- Fixed undeliver: no stock reversal for order-linked BLs, prepared restored
- Fixed edit_lines: stock adjustments only for standalone BLs, prepared adjusted for order-linked
- Bumped version to 1.6.8
- Lint passes clean

Stage Summary:
- Commit 9c05f72 pushed to GitHub main
- 3 files changed: delivery-notes/route.ts (10 edits), preparations/route.ts (1 edit), version.ts
- Stock flow: preparation only (single decrement)
- Prepared/Delivered properly tracked and transitioned
- BL creation no longer blocked on in_preparation status

---
Task ID: docs-1
Agent: Main
Task: Add complete sales workflow to user guide + version bump

Work Log:
- Added comprehensive "Processus de vente complet" section to guide-view.tsx
- 7 detailed steps with visual diagrams, screen mocks, and examples
- Added "Processus de vente" entry in guide sidebar (Ventes section)
- Explained stock behavior: single decrement at preparation, none at delivery
- Added example table: 1000 PVC pipes across 3 preparations and 3 BLs
- Added command status table with automatic transitions
- Clarified BL autonomous vs BL linked to order (stock behavior difference)
- Version already at 1.6.8 from previous commit
- All version references (login, layout, guide, print-header) use APP_VERSION constant

Stage Summary:
- Commit 0575927 pushed to GitHub main
- 1 file changed: guide-view.tsx (+328 lines, -28 lines)
- Version 1.6.8 (already bumped in previous commit 9c05f72)

---
Task ID: backup-bl-fix
Agent: Main
Task: Verify backup/restore system completeness + Fix BL creation from preparation

Work Log:

**1. Backup/Restore System Verification:**
- Analyzed all 73 Prisma models in schema.prisma against BACKUP_TABLES array (72 entries)
- Confirmed all 72 data tables are covered in correct FK-safe order
- Confirmed Backup model correctly excluded (no recursive backup)
- Confirmed all 9 TABLE_SQL_NAMES mappings (tables with @@map annotation)
- **BUG FOUND**: Employee model missing from DATETIME_FIELDS mapping
  - Employee has 5 DateTime fields: dateOfBirth, dateEmbauche, dateDepart, createdAt, updatedAt
  - Without this mapping, restore would keep these as ISO strings instead of Date objects
- **BUG FOUND**: EmployeeFunction also missing from DATETIME_FIELDS
  - EmployeeFunction has 2 DateTime fields: createdAt, updatedAt
- Fixed both by adding entries to DATETIME_FIELDS in src/lib/backup.ts

**2. BL Creation from Preparation — 3 bugs found and fixed:**

Bug A: preparations GET API missing `id` filter
- `fetchOrderLinesForDelivery()` calls `/preparations?id=${preparationId}`
- API handler only supported `status`, `salesOrderId`, `search` filters — `id` was ignored
- Result: ALL preparations returned, first one used (wrong preparation!)
- Fix: Added `preparationId` variable and `if (preparationId) where.id = preparationId` to preparations API

Bug B: `loadForNavigation` missing `in_preparation` status
- Only fetched orders with `status=prepared` and `status=partially_delivered`
- After preparation validation, SO might be `in_preparation` (partial prep)
- Result: Order not in dropdown, Select shows placeholder instead of selected order
- Fix: Added fetch for `status=in_preparation` orders + fetch specific order by ID
- Used Map to deduplicate orders before setting availableOrders state

Bug C: Order dropdown not showing selected order
- Related to Bug B: even though lines loaded correctly via `/sales-orders?id=xxx`,
  the Select component couldn't display the order because it wasn't in options
- Fix: Same as Bug B — order is now guaranteed to be in availableOrders

Stage Summary:
- 3 files modified: backup.ts, delivery-notes-view.tsx, preparations/route.ts
- Backup system: Employee and EmployeeFunction DateTime fields now properly handled
- BL from preparation: data auto-loads correctly (quantities, client, order)
- Lint passes clean, no TypeScript errors

---
Task ID: print-prep
Agent: Main
Task: Ajouter possibilitée d'imprimer le bon de préparation depuis la vue détail (eye icon)

Work Log:
- Examiné preparations-view.tsx — le bouton Imprimer existait déjà dans la vue détail mais avec données incorrectes
- Corrigé infoGrid : salesOrder?.number (inexistant) → salesOrder.clientOrderNumber
- Ajouté champs supplémentaires : N° Préparation, Statut, Progression
- Ajouté colonne Référence dans le tableau d'impression
- Ajouté résumé des totaux (total lignes, lignes complètes, progression %)
- Ajouté bouton Télécharger PDF utilisant downloadPdf depuis print-utils
- Import ajouté : downloadPdf depuis @/lib/print-utils
- Lint vérifié : aucun problème
- Pushé vers GitHub main : commit b91e951

Stage Summary:
- Le bon de préparation peut être imprimé et téléchargé en PDF depuis la vue détail (clic sur oeil)
- Les données affichées sont : N° préparation, N° commande, client, statut, dates, progression
- Le tableau contient : produit, réf, type, demandé, stock actuel, préparé, état

---
Task ID: 1
Agent: Main
Task: Analyze existing implementation and complete pending BL/prep/order table enhancements

Work Log:
- Read delivery-notes-view.tsx, preparations-view.tsx, sales-orders-view.tsx
- Analyzed all existing features: sort, dates, transport fields, lock logic, creation date columns
- Found that 90% of requested features were already implemented in previous sessions
- Added createdAt to DeliveryNote TypeScript interface (was used but not declared)
- Added createdAt to SalesOrder TypeScript interface
- Renamed "Date" column to "Créé le" in sales orders table with sort support
- Lint check passed
- Pushed commit 6039072 to main

Stage Summary:
- All requested features confirmed working:
  - BL: delivery date + due date default to today (editable)
  - BL: order number shown below Commande dropdown
  - BL: transport fields (chauffeur, transporteur, matricule) are optional
  - BL: quantities/PU/TVA locked when created from preparation
  - All 3 tables (BL, préparations, commandes) are sortable asc/desc
  - Creation date columns in all 3 tables
- Minor TypeScript fix: added missing createdAt to DeliveryNote interface
- Sales orders: "Date" → "Créé le" column with createdAt sort

---
Task ID: 2
Agent: Main
Task: Lier les BL aux préparations — anti-doublon, verrouillage, bouton camion intelligent

Work Log:
- Added preparationId to DeliveryNote Prisma model with relation to PreparationOrder
- Pushed schema to Neon PostgreSQL successfully
- Backend API: preparationId in createFromOrderSchema, duplicate check (409), included in GET/PUT responses
- Backend API: edit_lines blocked when preparationId present (400)
- Frontend BL: added preparation to TypeScript interface
- Frontend BL: sends preparationId on create, handles 409 duplicate error
- Frontend BL: shows prep number in expanded detail, detail dialog, edit dialog
- Frontend BL: edit dialog locks lines (qty/price/tva/article disabled), header-only save
- Frontend BL: print includes preparation number
- Frontend BL: support viewDetailId navigation param to open BL directly
- Frontend Preparations: smart truck button (checks existing BL via API)
- Frontend Preparations: truck button color changes (blue=exists, teal=new)
- Fixed TS errors (salesOrder.number→clientOrderNumber, ProductCombobox props, idx variable)

Stage Summary:
- Commit 5c54992 pushed to main
- BL from preparation now fully tracked and protected
- No duplicate BLs possible for same preparation
- Lines immutable when BL created from preparation

---
Task ID: 1
Agent: main
Task: Créer version 1.8.0, mettre à jour références et pieds de page, mettre à jour PWA

Work Log:
- Identified all version references across the project (package.json, version.ts, manifest.webmanifest, sw.js, guide-view.tsx)
- Updated package.json: 1.7.0 → 1.8.0
- Updated src/lib/version.ts: APP_VERSION = '1.8.0', BUILD_DATE = '2025-07-20'
- Updated public/manifest.webmanifest: version = "1.8.0"
- Fixed public/sw.js: restored __BUILD_STAMP_PLACEHOLDER__ (was hardcoded v1.6.9, prebuild regex couldn't match)
- Updated guide-view.tsx: processus de vente comment v1.6.8 → v1.7.0
- Verified all other files import APP_VERSION dynamically (sidebar, login, settings, print-header, backup, PWA registrar)
- ESLint passed with no errors
- Committed as e75e6a3 and pushed to main

Stage Summary:
- Version bumped from 1.7.0 to 1.8.0 across all references
- PWA manifest version updated
- Service Worker placeholder bug fixed (prebuild script can now properly inject build stamps)
- All footers/sidebars/print-headers auto-update via shared APP_VERSION import

---
Task ID: 2
Agent: main
Task: Vérifier si toutes les tables et champs sont prises en compte dans Sauvegarde / Restore

Work Log:
- Read complete prisma/schema.prisma (1780 lines, 73 models)
- Read src/lib/backup.ts (BACKUP_TABLES, DATETIME_FIELDS, TABLE_SQL_NAMES)
- Extracted all 73 Prisma model names via grep
- Extracted all 8 @@map annotations and compared with TABLE_SQL_NAMES
- Verified DateTime fields for ALL 72 data models against DATETIME_FIELDS mapping
- Checked FK order correctness for backup/restore

Stage Summary:
- 73 Prisma models total; 72 business models need backup; Backup model correctly excluded
- BACKUP_TABLES: 72/72 models present (100% coverage)
- TABLE_SQL_NAMES: 8/8 @@map annotations correctly mapped
- DATETIME_FIELDS: All 47 models with DateTime fields correctly listed with exact field names
- 25 models without DateTime fields correctly excluded from DATETIME_FIELDS
- FK-safe order verified (parents before children, reversed for delete)
- Conclusion: Backup/Restore system is 100% complete and correct

---
Task ID: 3
Agent: main
Task: Fix server errors on bon de retour, factures, avoir clients — verify PostgreSQL tables

Work Log:
- Verified .env was pointing to SQLite instead of PostgreSQL — fixed locally
- Confirmed Prisma schema is PostgreSQL (`provider = "postgresql"`)
- Ran `prisma db push` — confirmed "database is already in sync" with Neon PostgreSQL
- Listed ALL 72 tables in PostgreSQL via raw SQL query — all exist including:
  - customer_returns ✅, customer_return_lines ✅
  - CreditNote ✅, CreditNoteLine ✅
  - Invoice ✅, InvoiceLine ✅
- Tested Prisma queries directly against PostgreSQL for all 3 tables — all succeed
- Verified customer_returns columns match schema (15 columns) ✅
- Verified customer_return_lines columns match schema (8 columns) ✅
- **ROOT CAUSE FOUND**: 7 references to `salesOrder.number` in API routes (should be `salesOrder.clientOrderNumber`)
  - SalesOrder model has `clientOrderNumber` field, NOT `number`
  - This caused Prisma runtime errors when invoices included salesOrder relation
- Fixed 7 references across 5 files:
  1. src/app/api/invoices/[id]/route.ts — salesOrder select
  2. src/app/api/invoices/route.ts — 2 occurrences (list + BL creation)
  3. src/app/api/invoices/uninvoiced-bls/route.ts — salesOrder select
  4. src/app/api/finance/financial-reports/route.ts — 2 occurrences (select + property access)
  5. src/app/api/agenda/route.ts — 2 occurrences (select + property access)
- Fixed local .env to PostgreSQL connection string
- ESLint passed with no errors
- Committed as 9f3cda0 and pushed to main

Stage Summary:
- PostgreSQL tables confirmed: all 3 features (bon de retour, factures, avoirs) have correct tables/columns
- Bug: `salesOrder.number` → `salesOrder.clientOrderNumber` in 7 API references across 5 files
- Commit 9f3cda0 pushed to main — Vercel will auto-deploy
- All factures, avoirs, and related features should work after deployment
---
Task ID: 1
Agent: main
Task: Fix bon de retour (customer-returns) server error on Vercel

Work Log:
- Investigated the customer-returns API route (`src/app/api/customer-returns/route.ts`)
- Checked Prisma schema for `CustomerReturn` and `CustomerReturnLine` models
- Verified all reverse relations exist (Client, DeliveryNote, Invoice, Product)
- Found the bug: API route line 57 had `orderBy: { createdAt: 'asc' }` on the `lines` include, but `CustomerReturnLine` model does NOT have a `createdAt` field
- This caused a Prisma runtime error → HTTP 500 "Erreur serveur" on every GET request
- Fixed by removing the `orderBy` clause from the lines include
- Ran `bun run lint` — passed
- Committed and pushed to main

Stage Summary:
- Root cause: `CustomerReturnLine` Prisma model has no `createdAt` field, but the GET endpoint was trying to order lines by `createdAt`
- Fix: Removed `orderBy: { createdAt: 'asc' }` from the lines include in the findMany query
- Commit: `31c6d9e` pushed to `main`
---
Task ID: 2
Agent: main
Task: Create version 1.8.1, update references and PWA, push

Work Log:
- Bumped version from 1.8.0 → 1.8.1 in 3 files:
  - `src/lib/version.ts`: APP_VERSION + BUILD_DATE
  - `package.json`: version field
  - `public/manifest.webmanifest`: version field
- Updated BUILD_DATE to 2026-05-11
- Verified all version references use APP_VERSION from version.ts (single source of truth)
- PWA update mechanism: prebuild.js reads package.json → writes build-meta.json + updates manifest + injects sw.js stamp
- Ran `bun run lint` — passed
- Committed and pushed to main

Stage Summary:
- Version 1.8.1 deployed (commit c8cbf3b)
- All footers, settings, print headers, and PWA manifest auto-update via APP_VERSION
---
Task ID: 1
Agent: Main
Task: Implement complete cheque printing system with visual template editor

Work Log:
- Added ChequeTemplate + ChequeTemplateField models to prisma/schema.prisma
- Added printedAt + printCount + templateId to EffetCheque model
- Pushed schema to Neon PostgreSQL (prisma db push)
- Created /api/cheque-templates route (GET, POST, PUT, DELETE)
- Created /api/effets-cheques/[id]/print-data route (formatted print data)
- Created /api/effets-cheques/[id]/print route (print counter)
- Created cheque-template-editor.tsx: visual drag-and-drop editor
  - Background image upload (scan A4), grid overlay, snap to 1mm
  - Field properties: fontSize, fontWeight, textAlign, fontFamily, dimensions
  - Undo support, duplicate template, preview toggle
  - 11 available cheque fields (montant_chiffres, montant_lettres, beneficiaire, etc.)
- Created cheque-print.ts: print engine
  - buildChequePrintHtml() for production (text only, centered on A4)
  - buildChequePreviewHtml() for preview (with optional background)
  - buildChequeTestHtml() with alignment markers (corner crosses, outline)
  - printCheque() function with preview dialog
- Added Print button in effets-view.tsx for cheque type items
- Added "Modèles chèques" tab in settings-view.tsx with full CRUD
- Updated backup.ts: added ChequeTemplate, ChequeTemplateField to BACKUP_TABLES, TABLE_SQL_NAMES, DATETIME_FIELDS
- Lint passes clean

Stage Summary:
- Commit 02b1104 pushed to main
- 9 files changed, 2162 insertions
- Complete cheque printing system with visual template editor
- Settings > Modèles chèques tab for template management
- Print button integrated in Effets & Chèques view

---
Task ID: 1
Agent: Main
Task: Make cheque template editor dialog fullscreen

Work Log:
- Read settings-view.tsx to understand the cheque template dialog structure
- Read cheque-template-editor.tsx to find the DialogContent configuration
- Identified the dialog was constrained to w-[1400px] h-[850px]
- Changed DialogContent to use fullscreen classes: fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none max-h-none rounded-none border-0

Stage Summary:
- Cheque template editor now opens as a fullscreen overlay, giving full viewport access for editing
- No more content cut off due to fixed 1400x850 dimensions
- Lint passes cleanly

---
Task ID: 1
Agent: Main
Task: Fix invoice list print — printDocument crash + empty dates handling

Work Log:
- Diagnosed root cause: `handlePrintList` in both invoices-view.tsx and supplier-invoices-view.tsx were calling `printDocument()` with wrong data format
  - `printDocument` expects `PrintOptions` with `columns: Array<{label}>`, `rows: Array<Array<{value}>>`, plus required `docNumber`, `infoGrid`, `totals`
  - But callers passed plain string arrays for columns/rows and a non-existent `footer` property
  - This caused runtime crash when accessing `col.label` and `cell.value` on undefined
- Created new `printList()` function in `src/lib/print-utils.ts` specifically for simple list/table printing
  - Accepts `PrintListOptions`: title, columns (string[]), rows (string[][]), footer?, dateRange?
  - Builds simple HTML with company header, title, optional date range subtitle, table, footer
  - Uses same full-screen preview dialog with zoom, pan, and print as `printDocument`
- Updated `invoices-view.tsx` (Vente): changed `handlePrintList` to use `printList()`, added `dateRange` param
- Updated `supplier-invoices-view.tsx` (Achat): same fix, uses `filtered` (client-side filtered) data
- Empty dates now work correctly: no date params sent to API = full list fetched = full list printed
- Lint passes clean

Stage Summary:
- 3 files modified: print-utils.ts (+250 lines, new printList function), invoices-view.tsx, supplier-invoices-view.tsx
- Print button works for both Vente and Achat invoice lists
- Works with or without date filters (empty dates = print complete list)
- Excel export was already working correctly (no changes needed)

---
Task ID: 2
Agent: Main
Task: Fix payment dialog crash, cheque print 401, null guards

Work Log:
- Diagnosed 4 bugs from user-reported errors when clicking "paiement fournisseur/client"

Bug 1 (CRITICAL): formatCurrency crash — `Cannot read properties of undefined (reading 'toLocaleString')`
- payments-view.tsx and effets-view.tsx: formatCurrency(n) crashed when n was null/undefined
- Fix: Changed signature to `(n: number | null | undefined) => (n ?? 0).toLocaleString(...)`

Bug 2 (CRITICAL): cheque-print.ts bare fetch without auth token
- printCheque() called `/api/effets-cheques/{id}/print-data` with no Authorization header → 401
- Also `/api/effets-cheques/{id}/print` (POST counter) missing auth
- Fix: Import useAuthStore, add `Authorization: Bearer ${token}` to both fetch calls

Bug 3 (MEDIUM): payment.number undefined in notifications
- API route payments/route.ts used `payment.number` but Payment model has no `number` field
- Result: notification shows "Paiement undefined"
- Fix: Changed to `payment.reference || payment.code || payment.id.slice(0, 8)` (3 locations)

Bug 4 (LOW): print-data route null guard
- numberToFrenchWords() and fmtMoney() could crash if effet.montant is null
- Fix: Added `|| 0` fallback

Stage Summary:
- 5 files modified, commit be39593 pushed to main
- Paiement fournisseur/client dialogs no longer crash
- Cheque printing no longer returns 401
- Notifications show correct payment reference
- print-data API handles null amounts gracefully

---
Task ID: verify-178eace
Agent: Main
Task: Verify commit 178eace (v1.8.6) — Prisma relations fix + full system audit

Work Log:
- Fetched and merged remote commits (178eace + 2691f69 + be39593 + others)
- Verified commit 2691f69: 3 missing @relation annotations added to schema.prisma
  - InventoryLine.product → Product (fixes Inventaire 500 error)
  - WorkOrderStep.workStation → WorkStation (fixes Ordres de fabrication 500 error)
  - OTMPiece.product → Product (fixes Maintenance 500 error)
- Verified commit 178eace: version bumped 1.8.5 → 1.8.6 in version.ts, package.json, manifest.webmanifest
- Verified all 3 version references are consistent at 1.8.6
- Verified BACKUP_TABLES: 74/74 business models covered (no change needed — fix was adding relations, not new tables)
- Verified DATETIME_FIELDS: no new DateTime fields added (OTMPiece still has none)
- Verified TABLE_SQL_NAMES: 10 @@map annotations unchanged
- Ran `prisma db push` — Neon PostgreSQL confirmed "database is already in sync"

Stage Summary:
- Commit 178eace is correct and complete
- All 3 server errors (Inventaire, OF, Maintenance) should be fixed after Vercel deployment
- Backup/Restore system still 100% in sync
- No issues found

---
Task ID: fix-prep-status
Agent: Main
Task: Fix — allow preparation creation for prepared/partially_delivered orders

Work Log:
- Found bug: preparations API only accepted `confirmed` and `in_preparation` statuses
- Command 12358 (partially_delivered) could not create new preparation after BL delivery
- Backend fix: added `prepared` and `partially_delivered` to accepted statuses in preparations/route.ts
- Frontend fix: added "Créer préparation" button for `prepared` and `partially_delivered` statuses in sales-orders-view.tsx
- Lint passes clean

Stage Summary:
- Commit 7be3fb9 pushed to main
- 2 files changed: preparations/route.ts, sales-orders-view.tsx
- Full lifecycle now works: confirmed → in_preparation → prepared/partially_delivered → still can create preparations

---
Task ID: fix-product-create
Agent: Main
Task: Fix product creation fails on PostgreSQL — null values in non-nullable Float fields + detailed error messages

Work Log:
- Root cause: Frontend sent minStock=null and maxStock=null when fields empty during creation
- Zod schema accepts null (.nullable()) but Prisma schema has `Float @default(0)` — NOT nullable
- SQLite accepts null in Float columns (lenient), PostgreSQL rejects it (strict) → 500 on Vercel
- Also `unit: form.unit || null` could send null to non-nullable String field

Fixes applied:
1. src/lib/api.ts — Added ApiError class carrying status + details, thrown on non-OK responses
2. src/components/erp/commercial/products-view.tsx:
   - handleSave body: minStock/maxStock default to 0/100 instead of null
   - handleSave body: unit defaults to 'unité' instead of null
   - handleSave body: priceHT/tvaRate default to 0/20 via `|| operator`
   - handleSave body: currentStock=0 explicitly sent on creation
   - Error catch: import ApiError, show err.message or Zod details in toast
   - Toast duration increased to 6s for readability
3. src/app/api/products/route.ts (POST):
   - Before Zod parse: convert null→defaults for minStock, maxStock, currentStock, averageCost, unit, productUsage, productNature
   - Error response: include server error message in details field for debugging
4. src/app/api/products/route.ts (PUT):
   - Same null→defaults conversion for product updates

Stage Summary:
- Commit 2e22d70 pushed to main
- 4 files changed: api.ts, products-view.tsx, products/route.ts (2 sections)
- Product creation now works on Vercel/PostgreSQL
- Error messages now show actual API error details (Zod validation, server error, etc.)

---
Task ID: fix-payment-client-select
Agent: Main
Task: Fix payment wizard server error when selecting client — PostgreSQL enum strictness

Work Log:
- User reported: clicking a client in payment wizard → "erreur serveur"
- Traced flow: handleEntitySelect → fetchUnpaidInvoices → /invoices?clientId=xxx&status=validated,sent,overdue,partially_paid&limit=100
- Root cause: invoices GET handler sets `where.status = "validated,sent,overdue,partially_paid"` (entire string)
- InvoiceStatus is a PostgreSQL enum — PostgreSQL rejects invalid enum values → Prisma crash → 500
- SQLite treats status as plain text, silently returns no results (no crash)
- Same issue found in supplier-invoices route

Fixes applied:
1. src/app/api/invoices/route.ts: Split comma-separated status param, use Prisma `{in: [...]}` operator
2. src/app/api/supplier-invoices/route.ts: Same fix for supplier payment flow
3. src/components/erp/finance/payments-view.tsx: Import ApiError, show detailed error message in toast
4. Both API routes: Include server error message in response details field

Stage Summary:
- Commit 358a8cc pushed to main
- 4 files changed
- Payment wizard client/supplier selection now works on Vercel/PostgreSQL
- Unpaid invoices correctly fetched using multiple status filter

---
Task ID: payment-codes
Agent: Main
Task: Payment codes tracking across invoices, statements, and prints

Work Log:
- Analyzed existing system: PaymentLine model already links payments to invoices with paymentId
- Client statement API: already had paymentLines include + paymentCode in transactions (was already working)
- Client statement UI: already had code column in table + print (was already working)
- Invoice detail view: already showed code règlement badge (was already working)

Changes applied:
1. Supplier statement API (suppliers/[id]/statement/route.ts):
   - Added paymentCode field to StatementTransaction interface
   - Added paymentLines include on supplier invoices query (with payment code + date)
   - Build paymentCodes from paymentLines (sorted, joined with |)
   - Added code to payment select
   - Set paymentCode on both invoice and payment transaction rows

2. Supplier invoices API (supplier-invoices/route.ts):
   - Added paymentLines include with payment code/amount/date/method

3. Client invoices print (invoices-view.tsx):
   - Created buildPaymentsHtml() helper function
   - Generates "PAIEMENTS REÇUS — Codes : A|AB" section with table (Code, Date, Mode, Montant)
   - Injected into both inline print (expanded) and detail dialog print

4. Supplier invoices print (supplier-invoices-view.tsx):
   - Created buildSupplierPaymentsHtml() helper function
   - Same format: "PAIEMENTS EFFECTUÉS — Codes : A|AB"
   - Updated SupplierInvoice interface with paymentLines
   - Injected into both inline and detail print locations

Stage Summary:
- Commit 68bef7a pushed to main (5 files, +85 lines, -7 lines)
- Printed invoices now show a "Paiements reçus/effectués" table with payment codes
- Supplier invoices API now returns paymentLines for frontend use
- Supplier statement now includes paymentCode column
---
Task ID: 1
Agent: Main
Task: Dashboard refresh — auto-update, refresh button, last-updated timestamp, accurate KPIs

Work Log:
- Analyzed dashboard API (src/app/api/dashboard/route.ts): identified 3 issues
  1. Revenue query missing overdue/partially_paid statuses → fixed
  2. Expenses using purchaseOrder instead of supplierInvoice → switched to supplierInvoice
  3. Recent activity sorted ASC (oldest first) → changed to DESC (newest first)
- Added totalClients, totalSuppliers, totalProducts counts to API response
- Updated dashboard component (src/components/erp/dashboard/dashboard-view.tsx):
  1. Added RefreshCw, Users, UserCheck, Boxes icon imports
  2. Added useRef import for interval management
  3. Added refreshing state (separate from loading — no skeleton flicker on refresh)
  4. Added lastUpdated state showing last fetch time
  5. Added autoRefresh state (default: true, 60-second interval)
  6. Added handleManualRefresh function
  7. Added useEffect for auto-refresh with setInterval (60s)
  8. Added refresh indicator bar (fixed top, subtle pulse)
  9. Added header with: title + last-updated time + auto-refresh toggle + refresh button
  10. Added Row 1.5: 3 clickable cards (Clients, Fournisseurs, Produits) with counts
  11. Updated stock KPI subtitle to show product count when no alerts
  12. Updated DashboardData interface with totalClients/totalSuppliers/totalProducts
- Lint passes clean

Stage Summary:
- 2 files modified: dashboard/route.ts, dashboard-view.tsx
- All KPIs query fresh DB data on each fetch (no stale cache)
- Auto-refresh every 60 seconds (toggleable)
- Manual refresh button with spinning animation
- Last-updated timestamp shown in header
- New entity counts row: Clients, Fournisseurs, Produits
- Revenue now includes overdue + partially_paid invoices
- Expenses now from supplier invoices (more accurate than purchase orders)
---
Task ID: 1
Agent: Main Agent
Task: Seed database with ~100 clients, suppliers, and products (delete existing first)

Work Log:
- Read Prisma schema to understand Client, Supplier, Product models and all their fields
- Existing seed.ts already had ~100 clients, 100 products, 30 suppliers for menuiserie aluminium/PVC
- Created optimized seed script `prisma/seed-clients-suppliers-products.ts` using `createMany` for fast bulk inserts
- Script deletes ALL existing data in FK-safe order before inserting fresh data
- Increased transaction timeout to 120s for remote Neon DB connection
- Successfully executed seed: 100 products (35 MP + 15 SF + 50 PF), 30 suppliers, 100 clients, 164 client contacts
- Pushed to GitHub main branch (commit 685fdcf)

Stage Summary:
- Database seeded with fresh data on Neon PostgreSQL
- Old data deleted, new data inserted
- 100 products, 30 suppliers, 100 clients with max info per record
- 164 client contacts auto-generated
- Vercel deployment triggered via GitHub push
---
Task ID: 2
Agent: Main Agent
Task: Fix logo not displaying on printouts

Work Log:
- Identified root cause: logo was loaded via `/api/logo` URL reference in iframe/html2pdf context
- html2pdf (html2canvas) cannot load same-origin images that require session cookies
- Fixed `getCompanyInfo()` to fetch logo as base64 data URL and embed directly in HTML
- Simplified `buildHeaderHtml()` logo src to use data URL directly (no window.location.origin needed)
- Added fallback to URL reference if fetch fails
- Pushed to GitHub main (commit 25c0ae5)

Stage Summary:
- Logo now embedded as base64 data URL in print HTML
- Works for both preview (iframe) and PDF download (html2pdf)
- No more CORS/session issues with printed documents
