---
Task ID: ui-improvements-search-combobox
Agent: main
Task: Products search by designation + Quotes searchable client/product dropdowns

Work Log:
- Modified `prisma/schema.prisma`: changed provider from postgresql to sqlite for local dev
- Modified `src/app/api/products/route.ts`:
  - Search now by designation only (removed multi-field OR search)
  - Added dropdown mode (`?dropdown=true`): lightweight response with select fields only, no pagination
  - Added `searchDesignation` query parameter
- Modified `src/app/api/clients/route.ts`:
  - Added dropdown mode (`?dropdown=true`): all clients, no pagination, search by raisonSociale only
  - Search in dropdown mode limited to raisonSociale/name fields
- Rewrote `src/components/erp/commercial/products-view.tsx`:
  - Search by designation only, server-side with 400ms debounce
  - Type/famille filters sent server-side as query params
  - Sticky table headers for vertical scrollbar
  - Shows total count from server, loading spinner during search
- Rewrote `src/components/erp/commercial/quotes-view.tsx`:
  - Client: Popover combobox with search, filters by raison sociale/name
  - Products: Popover combobox per line, only vente type, filters by designation/reference
  - Products pre-filtered by type=vente and active=true from server

Stage Summary:
- Commit 70f8748 pushed to origin/main
- Lint: 0 errors
- All changes pushed to https://github.com/Khalid1966-lad/erp_pro.git

---
Task ID: restore-postgresql
Agent: main
Task: Restore PostgreSQL provider in Prisma schema (was changed to SQLite in previous session)

Work Log:
- Restored `prisma/schema.prisma` from commit bc775c9 (PostgreSQL + directUrl)
- Created `.env` file with Neon PostgreSQL credentials recovered from git history
- Ran `npx prisma generate` successfully for PostgreSQL
- Ran `npx prisma db pull` — confirmed 38 models introspected from Neon DB
- Committed as "fix: restore PostgreSQL provider + directUrl for Neon DB"
- Pushed to origin/main (6e62834)

Stage Summary:
- Schema back to PostgreSQL with `directUrl = env("DIRECT_URL")`
- Database connection verified against Neon PostgreSQL
- Commit 6e62834 pushed to GitHub

---
Task ID: fix-case-insensitive-search
Agent: main
Task: Fix case-insensitive search for products and quotes in PostgreSQL

Work Log:
- Identified root cause: PostgreSQL `contains` is case-sensitive by default (unlike SQLite)
- Typing "Tube" wouldn't match "tube" or "TUBE" in the database
- Fixed `src/app/api/products/route.ts`: Added `mode: 'insensitive'` to designation search
- Fixed `src/app/api/quotes/route.ts`: Added `mode: 'insensitive'` to number/name/raisonSociale search, also added raisonSociale to quote search fields
- Committed and pushed as af97d4e

Stage Summary:
- Products search "Tube" now matches "tube", "TUBE", etc.
- Quotes search also now case-insensitive
- Commit af97d4e pushed to GitHub

---
Task ID: complete-commercial-docs-features
Agent: main
Task: Complete edit/print/montant-en-lettres for all commercial documents

Work Log:
- Examined commit b2f0b65 from GitHub (partial implementation of edit + montant en lettres)
- Fixed bug: Quotes detail said "Arrêtée la présente facture" → "Arrêté le présent devis"
- Fixed Sales Orders API PUT: added line update logic (delete old lines + create new + recalculate totals)
- Fixed Invoices API PUT: added line update logic (delete old lines + create new + recalculate with discount/shipping)
- Added print button (Imprimer) to Sales Orders detail dialog
- Added print button (Imprimer) to Invoices detail dialog
- Added print button + montant en lettres to Delivery Notes detail dialog
- Added print button + montant en lettres + computed totals to Preparations detail dialog
- Fixed lint error: replaced useState+useEffect with useMemo in ProductCombobox (quotes-view)

Stage Summary:
- All 5 commercial document types now have: edit capability, print button, montant en lettres
- API PUT endpoints properly handle line updates with recalculation
- Lint: 0 errors
- Commit f406e51 pushed to GitHub (main branch)

---
Task ID: 3
Agent: main
Task: Create 5 purchasing API routes (price-requests, supplier-quotes, supplier-invoices, supplier-returns, supplier-credit-notes)

Work Log:
- Read existing API routes for patterns: purchase-orders, receptions, suppliers, auth, db
- Created `src/app/api/price-requests/route.ts`:
  - GET: List price requests with lines (product info) + supplierQuotes. Filters: ?search, ?status
  - POST: Create with lines (productId + quantity). Auto-generates number `DMP-{year}-{seq}`
  - PUT: Update status (draft→sent→answered→partially_answered→closed/cancelled), title, notes, lines
  - DELETE: Only draft status
- Created `src/app/api/supplier-quotes/route.ts`:
  - GET: List with lines + supplier + priceRequest info. Filters: ?priceRequestId, ?supplierId, ?status
  - POST: Create linked to priceRequest (optional) + supplier (required) + lines. Auto-calc totals. Number `DFR-{year}-{seq}`
  - PUT: Update status (received→accepted/rejected/expired), lines, totals recalculation
  - DELETE: Only received status
- Created `src/app/api/supplier-invoices/route.ts`:
  - GET: List with lines + supplier + purchaseOrder info. Filters: ?supplierId, ?status, ?search
  - POST: Create linked to purchaseOrder (optional) + supplier (required) + lines. Number `FAC-F-{year}-{seq}`
  - PUT: Update status, notes, paymentDate, amountPaid, dueDate
  - DELETE: Only received status
- Created `src/app/api/supplier-returns/route.ts`:
  - GET: List with lines + supplier + reception/purchaseOrder/supplierInvoice info. Filters: ?receptionId, ?supplierId
  - POST: Create linked to reception (optional) + purchaseOrder (optional) + supplierInvoice (optional) + supplier (required) + lines. Number `BRF-{year}-{seq}`
  - PUT: Update status (draft→sent→received_by_supplier→credited/cancelled). When status becomes `received_by_supplier`, creates stock movement OUT via transaction with stock validation
  - DELETE: Only draft status
- Created `src/app/api/supplier-credit-notes/route.ts`:
  - GET: List with lines + supplier + supplierInvoice/supplierReturn info. Filters: ?supplierInvoiceId, ?supplierId
  - POST: Create linked to supplierInvoice (optional) + supplierReturn (optional) + supplier (required) + lines. Number `AVF-{year}-{seq}`
  - PUT: Update status (received→applied/partially_applied/cancelled), amountApplied with validation. Auto-determines status from amountApplied
  - DELETE: Only received status

Stage Summary:
- All 5 API routes follow existing patterns: auth, Zod validation, number generation, audit logging, proper HTTP status codes
- Case-insensitive search with `mode: 'insensitive'` for PostgreSQL
- Stock movements on supplier return `received_by_supplier` status (transactional)
- Lint: 0 errors

---
Task ID: 6
Agent: main
Task: Create 5 frontend purchasing view components + update navigation

Work Log:
- Read existing view files (purchase-orders-view, receptions-view, suppliers-view) for exact patterns
- Created `src/components/erp/purchasing/price-requests-view.tsx`:
  - List with search + status filter (draft/sent/answered/partially_answered/closed/cancelled)
  - Create dialog: title, validUntil, notes, product lines (productId + quantity)
  - Detail dialog: shows lines with product info + list of supplier quotes received
  - Actions: send (draft→sent), close (sent/answered→closed), delete (draft only)
  - Icons: FileQuestion
- Created `src/components/erp/purchasing/supplier-quotes-view.tsx`:
  - List with search + supplier filter + status filter (received/accepted/rejected/expired)
  - Create dialog: select supplier (required), link to price request (optional), lines with product/qty/unitPrice/tvaRate, validUntil, deliveryDelay, paymentTerms
  - Detail dialog with totals (HT/TVA/TTC), linked price request, delivery/payment info
  - Actions: accept (received→accepted), reject (received→rejected), delete (received only)
  - Icons: FileText
- Created `src/components/erp/purchasing/supplier-invoices-view.tsx`:
  - List with search + supplier filter + status filter (received/verified/paid/partially_paid/overdue/cancelled)
  - Create dialog: select supplier, link to purchase order (optional), lines, dueDate, notes
  - Detail dialog with totals, amount paid, remaining balance
  - Actions: verify (received→verified), mark paid (verified/partially_paid→paid), delete (received only)
  - Icons: Receipt
- Created `src/components/erp/purchasing/supplier-returns-view.tsx`:
  - List with search + supplier filter
  - Create dialog: select supplier, link to reception/purchase order/invoice (optional), lines, reason
  - Detail dialog with totals + linked document refs + reason
  - Status flow: draft→sent→received_by_supplier→credited/cancelled
  - Actions: send, received, credited, cancel, delete (draft only)
  - Icons: RotateCcw
- Created `src/components/erp/purchasing/supplier-credit-notes-view.tsx`:
  - List with search + supplier filter
  - Create dialog: select supplier, link to invoice/return (optional), lines, reason
  - Detail dialog with totals, amount applied, remaining to apply
  - Status flow: received→applied/partially_applied/cancelled
  - Actions: apply, cancel, delete (received only)
  - Icons: ArrowLeftRight
- Updated `src/lib/stores.ts`: Added 5 new ViewIds (price-requests, supplier-quotes, supplier-invoices, supplier-returns, supplier-credit-notes)
- Updated `src/components/erp/erp-layout.tsx`:
  - Added 5 nav items to "Achats" group after receptions
  - Added viewLabels for all 5 new views
  - Imported FileQuestion + ArrowLeftRight from lucide-react
- Updated `src/app/page.tsx`:
  - Added 5 dynamic imports with ssr: false
  - Added 5 case statements in ViewRouter switch

Stage Summary:
- All 5 frontend views follow existing patterns (use client, api wrapper, shadcn/ui, StatusBadge, fmtMoney, fmtDate, toast)
- Navigation fully updated with icons, colors, and permissions
- Lint: 0 errors
- Dev server: compiling successfully

---
Task ID: 4
Agent: main
Task: Add client detail view with individual document tabs (same as supplier detail view)

Work Log:
- Read the existing ClientDetailView in clients-view.tsx which had a single "Historique" tab grouping all documents
- Analyzed the supplier detail view (supplier-detail-view.tsx) for the target pattern
- Replaced the grouped "Historique" approach with individual tabs for each document type
- Created separate status config maps for each document type (quotes, orders, delivery notes, invoices, credit notes)
- Added useTabData custom hook for parallel data fetching per tab
- Created individual tabs: Informations, Devis, Commandes, Bons de Livraison, Factures, Avoirs
- Added document count badges on tab triggers
- Added 4 summary cards: Téléphone, Email, Adresse, Solde (with color-coded balance)
- Added comprehensive status badge configs with dark mode support
- Verified: lint passes with 0 errors, dev server compiling

Stage Summary:
- Client detail view now matches supplier detail view pattern with individual tabs
- Each document type has its own dedicated tab with status-colored badges
- Commercial sidebar was already renamed to 'Ventes' and purchase items already in correct order

---
Task ID: 2
Agent: main
Task: Add overflow-x-auto to all tables missing horizontal scroll

Work Log:
- Added overflow-x-auto to quotes-view.tsx
- Added overflow-x-auto to sales-orders-view.tsx
- Added overflow-x-auto to preparations-view.tsx
- Added overflow-x-auto to delivery-notes-view.tsx
- Added overflow-x-auto to invoices-view.tsx
- Added overflow-x-auto to credit-notes-view.tsx
- Added overflow-x-auto to payments-view.tsx
- Added overflow-x-auto to accounting-view.tsx
- Added overflow-x-auto to cash-registers-view.tsx
- Added overflow-x-auto to bank-accounts-view.tsx
- Added overflow-x-auto to audit-log-view.tsx

Stage Summary:
- All 11 table views now have horizontal scroll support via overflow-x-auto

---
Task ID: 1
Agent: main
Task: Remove ICE column from clients table

Work Log:
- Removed ICE TableHead from clients table header
- Removed ICE TableCell from data rows  
- Updated colSpan from 8 to 7 in loading/empty states

Stage Summary:
- ICE column successfully removed from client list view

---
Task ID: 3
Agent: main
Task: Add Edit functionality to credit-notes (Avoirs ventes)

Work Log:
- Added Pencil icon import
- Added isEditing state variable
- Added openEdit function to populate form from existing credit note
- Modified handleSave to support both create and update modes
- Made dialog title and save button text dynamic based on edit mode
- Added Edit button in actions column for draft credit notes
- Reset isEditing state when dialog closes

Stage Summary:
- Credit notes can now be edited (in draft status) via the Pencil icon button
- Reuses existing create dialog with dynamic title/button text
- Backend PUT endpoint already supports this via updateData spread

---
Task ID: 2b-1
Agent: frontend-achats-edit-1
Task: Add edit functionality to price-requests and supplier-quotes views

Work Log:
- Added Pencil icon import to both views
- Added isEditing state variable to both views
- Added openEdit function to both views (pre-populates form from existing document)
- Modified handleCreate to support both POST and PUT
- Made dialog title and save button text dynamic
- Added Edit button in table rows (draft for price-requests, received for supplier-quotes)
- Reset isEditing on dialog close

Stage Summary:
- Price requests can now be edited in draft status
- Supplier quotes can now be edited in received status
- Both reuse the existing create dialog with pre-populated data

---
Task ID: 2b-2
Agent: frontend-achats-edit-2
Task: Add edit functionality to purchase-orders and supplier-returns views

Work Log:
- Added isEditing state to both views
- Added openEdit function to pre-populate form from existing document
- Modified handleCreate to support POST/PUT
- Dynamic dialog titles and save buttons
- Edit button in table rows (draft/sent for PO, draft for returns)

Stage Summary:
- Purchase orders can now be edited in draft/sent status
- Supplier returns can now be edited in draft status
- Both reuse existing create dialog

---
Task ID: 2c
Agent: frontend-ventes-pencil
Task: Add Pencil edit button directly in table rows for ventes views

Work Log:
- Added Pencil button to quotes-view.tsx table rows (draft/rejected/expired)
- Added Pencil button to sales-orders-view.tsx table rows (pending)
- Added Pencil button to invoices-view.tsx table rows (draft)

Stage Summary:
- All 3 ventes views now have direct Edit access from table row
- Previously edit was only accessible via Detail dialog
- Uses existing openEdit functions already present in each view

---
Task ID: 2a
Agent: backend-api-fixer
Task: Fix backend PUT APIs to support data editing (lines, metadata)

Work Log:
- Fixed credit-notes PUT to support line replacement + recalculate totals (draft only)
- Fixed purchase-orders PUT to support line replacement + recalculate totals (draft/sent only)
- Fixed supplier-returns PUT to support line replacement + recalculate totals (draft only)
- Fixed supplier-invoices PUT to support line replacement + recalculate totals (received only)
- Fixed supplier-credit-notes PUT to support line replacement + recalculate totals (received only)

Stage Summary:
- All 5 PUT APIs now support full data editing with line replacement and total recalculation
- Each API validates status before allowing edits
- price-requests and supplier-quotes already had full support

---
Task ID: 2b-3
Agent: frontend-achats-edit-3
Task: Add edit functionality to supplier-invoices and supplier-credit-notes views

Work Log:
- Added isEditing state to both views
- Added openEdit function with form pre-population
- Modified handleCreate for POST/PUT support
- Dynamic dialog titles and save buttons
- Edit button in table rows (received status for both)
- Fixed pre-existing TS error: item.reference → item.number in delete dialog

Stage Summary:
- Supplier invoices can now be edited in received status
- Supplier credit notes can now be edited in received status
