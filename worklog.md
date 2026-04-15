---
## Task ID: 1 - rebrand-currency-migration
### Work Task
Rebrand the ProERP application to "GEMA ERP PRO" and change all currency references from EUR to MAD (Moroccan Dirham). Update country defaults from France to Maroc where appropriate.

### Work Summary
**Rebranding (ProERP → GEMA ERP PRO):**
- Updated `src/app/layout.tsx`: Title changed to "GEMA ERP PRO - ERP de Production — Maroc"
- Updated `src/components/erp/login-page.tsx`: Card title → GEMA ERP PRO, description → "ERP de Production — Maroc", placeholder email → admin@gema-erp.com. Demo credentials display kept as-is per instructions (passwords hashed in DB).
- Updated `src/components/erp/erp-layout.tsx`: Sidebar logo text and SheetTitle → GEMA ERP PRO
- Updated `src/components/erp/admin/settings-view.tsx`: Company name placeholder → GEMA ERP PRO, email placeholder → contact@gema-erp.com, phone placeholder → +212 format, TVA placeholder → MA format, country placeholder → Maroc
- Updated `prisma/seed.ts`: Company name → "GEMA ERP PRO Industries", all user emails → @gema-erp.com, company email → contact@gema-erp-industries.ma, all findUnique queries updated, audit log references updated, console.log output updated
- Updated `.env` and `.env.example`: Header comments → GEMA ERP PRO

**Currency (EUR → MAD):**
- Changed `'EUR'` → `'MAD'` in formatCurrency functions across 16 view files:
  - dashboard-view.tsx, quotes-view.tsx, invoices-view.tsx, credit-notes-view.tsx
  - preparations-view.tsx, sales-orders-view.tsx, clients-view.tsx, products-view.tsx
  - stock-movements-view.tsx, inventory-view.tsx, suppliers-view.tsx
  - purchase-orders-view.tsx, bank-accounts-view.tsx, cash-registers-view.tsx
  - payments-view.tsx, accounting-view.tsx, work-orders-view.tsx
- Updated settings-view.tsx: Currency option changed from EUR/Euro to MAD/Dirham marocain

**Country defaults (France → Maroc):**
- Updated `src/app/api/clients/route.ts`: z.string().default('Maroc')
- Updated `src/app/api/suppliers/route.ts`: z.string().default('Maroc')
- Updated `src/components/erp/commercial/clients-view.tsx`: Form default, edit form fallback, input placeholder
- Updated `src/components/erp/purchasing/suppliers-view.tsx`: Form default, edit form fallback, input placeholder, display condition

**Auth store persist key:**
- Updated `src/lib/stores.ts`: persist name changed from 'erp-auth' to 'gema-erp-auth'

**Seed data:**
- Currency setting changed from 'EUR' to 'MAD'
- Client data kept as-is (French companies remain with country: 'France' as they are actual entities)

**Lint:** `npm run lint` passes with 0 errors.

---
## Task ID: 6-7-8 - frontend-client-management
### Work Task
Build the complete frontend for the Moroccan client management module including: Zod validation schema, full CRUD list/form/detail views with 8 tabbed sections, status/categorie filters, pagination, search, and Moroccan-specific fields (ICE, CNSS, patente, identifiant fiscal, registre commerce).

### Work Summary
**Files created:**
- `src/lib/validations/client.ts` — Complete Zod validation schema with all Moroccan fields, contact schema with useFieldArray support, all option enums (statut, categorie, forme juridique, langue, contacts types, modes règlement, conditions paiement, incoterm, taux TVA, mode facturation, régime fiscal, relance types, fréquence reporting, origine prospect), and default form values.
- `src/components/erp/commercial/clients-view.tsx` — Complete replacement (~750 lines) with three sub-views managed via internal useState:

**Architecture:**
- Internal state machine with `subView`: 'list' | 'create' | 'edit' | 'detail'
- No changes needed to page.tsx or stores.ts (sub-views handled within component)
- Uses react-hook-form + zodResolver for form validation
- useFieldArray for dynamic contacts management
- Backend-compatible API mapping (sends fields the current backend supports)

**LIST VIEW features:**
- Search bar (searches by name, email, city, phone via backend)
- Status filter buttons (actif/inactif/prospect/client_risque/client_privilegie) with colored badges
- Categorie filter dropdown
- Sortable table columns (raison sociale, ICE, ville, téléphone, email, statut, CA Total)
- Click row → navigate to detail view
- Pagination (10 per page) with smart page number display
- Loading skeleton, empty states, refresh button

**FORM VIEW (8 tabs):**
1. Identité légale — raisonSociale, nomCommercial, ICE (15 digits regex), patente, CNSS, IF, RC, villeRC, formeJuridique, dateCreation
2. Coordonnées — adresse, codePostal, ville, provincePrefecture, téléphone (Moroccan regex), gsm, email, emailSecondaire, siteWeb, langueCommunication
3. Contacts — Dynamic list with useFieldArray, add/remove, type/nom/prenom/fonction/téléphone/email/notes per contact
4. Paramètres commerciaux — conditionsPaiement, modeReglementPrefere, escompte, remisePermanente, baremePrix, seuilCredit, delaiLivraison, transporteurPrefere, incoterm
5. Paramètres fiscaux — tauxTVA, codeComptableClient, modeFacturation, emailFacturation, regimeFiscal
6. Suivi & Statistiques — Read-only display of caTotalHT, nbCommandes, panierMoyen, tauxRetour, last quote/invoice info
7. Relances & Litiges — nbImpayes, delaiMoyenPaiement, alerteImpaye (switch), contentieux fields, derniereRelance
8. Production & Divers — certifications, specs techniques, packaging, seuil lot minimal, frequence reporting, statut, categorie, priorite (slider 1-5), commentairesInternes

**DETAIL VIEW features:**
- Client header with name, ICE, status badge
- Summary cards (téléphone, email, adresse)
- Tabbed detail sections (Identité, Commercial with balance/credit/payment cards, Historique with placeholder for related documents, Contacts)
- Edit/Delete actions
- Back navigation

**UX:**
- All labels in French
- Moroccan context throughout (ICE format, +212 phone, Moroccan cities, CNSS, patente, IF)
- Responsive design (mobile-first)
- Loading skeletons
- Error handling with toast notifications via sonner
- Back button navigation between views
- shadcn/ui components exclusively (Card, Button, Input, Badge, Tabs, Select, Form, Switch, Slider, etc.)

**Lint:** `npm run lint` passes with 0 errors.
**Dev server:** Compiles successfully, no runtime errors.

---
## Task ID: 3 - backend-client-management
### Work Task
Build the complete backend for the Moroccan client management module: Prisma schema with Moroccan enums, ClientContact, ClientDocument models, Zod validations, full CRUD API routes with permissions, and backward compatibility with existing frontend.

### Work Summary

**1. Prisma Schema (`prisma/schema.prisma`):**
- Added 13 new enums: `FormeJuridique`, `LangueCommunication`, `ModeReglement`, `Incoterm`, `TauxTVA`, `ModeFacturation`, `RegimeFiscal`, `StatutClient`, `CategorieClient`, `ContactType`, `StatutPaiement`
- Replaced `Client` model with comprehensive Moroccan version containing 80+ fields across 9 sections:
  - Identité légale (ICE, patente, CNSS, IF, RC, formeJuridique)
  - Coordonnées (adresse, ville, codePostal, téléphone, gsm, email)
  - Paramètres commerciaux (conditionsPaiement, modeReglement, escompte, remise)
  - Paramètres fiscaux (tauxTVA, codeComptable, régimeFiscal)
  - Suivi commercial (CA, commandes, panier moyen)
  - Statut & relation (statut, catégorie, priorité)
  - Relances & litiges (nbImpayes, alerteImpaye, contentieux)
  - Spécificités production (certifications, packaging)
  - Champs système (version, soft delete, createdBy/updatedBy)
- Kept ALL legacy fields (`name`, `siret`, `address`, `city`, `postalCode`, `phone`, `country`, `creditLimit`, `paymentTerms`, `notes`, `balance`) for backward compatibility
- Added `ClientContact` model (type, nom, prenom, fonction, telephoneDirect, email) with Cascade delete
- Added `ClientDocument` model (nomFichier, url, type, taille) with Cascade delete

**2. Zod Validations (`src/lib/validations/client.ts`):**
- `clientCreateSchema` — full validation with ICE regex (15 alphanumeric), Moroccan phone regex, email validation
- `clientUpdateSchema` — partial version for updates
- `clientContactSchema` — contact creation with enum type
- `clientContactUpdateSchema` — partial contact update
- `clientDocumentSchema` — document validation

**3. API Routes:**
- `GET /api/clients` — List with pagination, search (raisonSociale/ice/email/ville/telephone/name), filters (statut/categorie/formeJuridique/ville), sorting, status count stats, soft-delete filter
- `POST /api/clients` — Create with ICE & email uniqueness checks, legacy field auto-population
- `GET /api/clients/[id]` — Get with contacts, documents, and relation counts (quotes/salesOrders/invoices/creditNotes)
- `PUT /api/clients/[id]` — Update with uniqueness checks, legacy field sync, version increment
- `DELETE /api/clients/[id]` — Soft delete (isDeleted: true)
- `GET/POST /api/clients/[id]/contacts` — List/create contacts
- `GET/PUT/DELETE /api/clients/[id]/contacts/[contactId]` — Individual contact CRUD
- `GET/POST /api/clients/[id]/documents` — List/create documents
- `GET/DELETE /api/clients/[id]/documents/[documentId]` — Individual document operations

**4. Auth Permissions (`src/lib/auth.ts`):**
- Added granular permissions: `client:read`, `client:create`, `client:edit`, `client:delete`
- Kept backward compatibility: `clients:read`, `clients:write` still work
- Added `client:read` to direction, buyer, storekeeper, prod_manager, accountant, cashier roles
- Commercial role gets all 4 granular permissions

**5. Seed Data (`prisma/seed.ts`):**
- Updated all 6 clients with Moroccan data (ICE, patente, CNSS, registreCommerce)
- Added legacy alias fields (address→adresse, city→ville, postalCode→codePostal, phone→telephone)
- Added commercial tracking data (caTotalHT, nbCommandes, panierMoyen, datePremierAchat, etc.)
- Added varied statuses and categories across clients
- Added cleanup for ClientContact and ClientDocument tables

**Lint:** `npm run lint` passes with 0 errors.
**Database:** Schema pushed with `db push --force-reset`, seed completed successfully.

---
## Task ID: 4 - logo-transparent-favicon
### Work Task
Make the app logo background transparent and configure it as the favicon.

### Work Summary
- **SVG Logo transparency**: Removed dark rectangle background from `/public/logo.svg`. Changed letter fill to dark color (#1a1a2e) visible on light backgrounds.
- **Favicon generation**: Generated `favicon-32.png` (32x32) and `apple-touch-icon.png` (180x180) from transparent SVG using sharp-cli.
- **Layout metadata**: Updated `src/app/layout.tsx` icons config for PNG favicon and Apple touch icon.
- **Login page**: Updated to reference `/logo.svg` instead of `/logo.avif`.
- **Sidebar**: Updated SidebarLogo default to `/logo.svg`.
- **Lint:** `bun run lint` passes with 0 errors.

---
## Task ID: 5 - commandes-quote-import
### Work Task
Enhance Commandes (Sales Orders) module with two creation modes: manual product entry and import from accepted quotes (devis). Only accepted quotes importable. When creating an order for a client, all accepted quotes appear in popup.

### Work Summary
**Frontend (`sales-orders-view.tsx`):**
- Complete rewrite (~955 lines) with quote import functionality
- "Importer un devis accepté" button appears when client selected (emerald-themed)
- Fetches `GET /api/quotes?clientId=xxx&status=accepted`
- Quote import dialog shows each accepted quote as card with number, date, lines, total TTC, product references
- On selection: form pre-filled with quote lines (product, qty, price, TVA, discount)
- Green info banner confirms imported quote; badge shown with clear option
- Client change auto-clears quote import
- Order list shows quote reference under number if linked
- Order detail shows blue banner "Créée depuis le devis DEV-XXXX"
- Added discount column to line items table

**Backend (`/api/sales-orders/route.ts`):**
- Added `quoteId` and `discount` to Zod schemas
- Validation: quote must exist, be accepted, match client
- POST stores `quoteId` on created order
- Total calculation accounts for line-level discount
- All includes now return `quote` relation
- **Lint:** `bun run lint` passes with 0 errors.

---
## Task ID: 3 - client-excel-import
### Work Task
Build a client Excel import feature for the GEMA ERP PRO project: API route with POST (import) and GET (template download), and frontend import UI with dialog, progress, and result summary in the clients list view.

### Work Summary

**1. Package:**
- Installed `xlsx` npm package for Excel parsing and generation

**2. API Route (`src/app/api/clients/import/route.ts`):**

**GET — Download Excel Template:**
- Admin-only auth check via `getUser(req)`
- Generates a `.xlsx` file with 27 French column headers matching all import fields
- Includes 2 pre-filled example data rows with realistic Moroccan company data (GEMA Industries, Atlas Distribution)
- Proper column widths for readability
- Returns binary buffer with `Content-Disposition: attachment; filename=clients-template.xlsx`

**POST — Import Clients from Excel:**
- Admin-only auth check
- Accepts `FormData` with `file` field
- Validates file extension (.xlsx/.xls)
- Parses Excel using `xlsx` library (`XLSX.read`, `sheet_to_json`)
- Maps French column headers to internal field names via `COLUMN_MAP`
- Required fields validation: `raisonSociale`, `ice`, `ville`, `email`
- Batch duplicate ICE check (single DB query before processing)
- Skips in-file duplicates by tracking newly created ICEs
- Per-row enum validation for: formeJuridique, statut, categorie, modeReglementPrefere, tauxTva, regimeFiscal, langueCommunication
- Email format validation (primary + secondary)
- Priorite range validation (1-5), seuilCredit numeric validation
- Auto-populates legacy fields from new fields (name←raisonSociale, address←adresse, city←ville, postalCode←codePostal, phone←telephone, creditLimit←seuilCredit, paymentTerms←conditionsPaiement)
- Creates clients via Prisma with `createdBy` tracking
- Audit log entry per imported client (`action: 'import'`)
- Returns JSON summary: `{ imported, skipped, errors: [{row, reason}] }`

**3. Frontend (`src/components/erp/commercial/clients-view.tsx`):**
- Added imports: `FileSpreadsheet`, `Download`, `Upload`, `CheckCircle2`, `XCircle`, `Loader2` icons; `useAuthStore`, `Dialog*` components, `Progress` component; `useRef`
- Added `ImportResult` interface
- Admin-only "Télécharger modèle" button (triggers template download via fetch + blob URL)
- Admin-only "Importer Excel" button (opens import dialog)
- Import dialog features:
  - Drag/click file upload area with `.xlsx` accept filter
  - File info card (name, size, remove button) after selection
  - Progress bar with spinner during import
  - Result summary with green (imported) and amber (skipped) stat cards
  - Scrollable error details list with row numbers and reasons
  - Cancel/Import buttons during upload, Close button after result
  - Auto-refreshes client list after successful import
- All state properly reset on dialog close

**4. Column Mapping (French → English):**
27 columns: Raison Sociale *, ICE *, Ville *, Email *, Nom Commercial, Forme Juridique, Adresse, Code Postal, Téléphone, GSM, Email Secondaire, Site Web, Conditions Paiement, Mode Règlement, Taux TVA, Régime Fiscal, Statut, Catégorie, Priorité, Langue Communication, Patente, CNSS, Identifiant Fiscal, Registre Commerce, Ville RC, Seuil Crédit, Commentaires

**Lint:** `npm run lint` passes with 0 errors.
**Dev server:** Compiles successfully, no runtime errors.

---
## Task ID: 2-b - frontend-delivery-notes-view
### Work Task
Create the frontend view for Bons de Livraison (Delivery Notes) at `src/components/erp/commercial/delivery-notes-view.tsx`, following the exact patterns of `preparations-view.tsx`.

### Work Summary
**File created:** `src/components/erp/commercial/delivery-notes-view.tsx` (~270 lines)

**Component: `DeliveryNotesView`** (default export, 'use client')

**Features implemented:**
1. **Header** — Truck icon from lucide-react, title "Bons de Livraison", count Badge showing total delivery notes.

2. **Status Filter** — Select dropdown with options: Tous, Brouillon, Confirmé, Livré, Annulé. Filters the API call via `?status=...&page=1`.

3. **Table** — 7 columns:
   - Numéro (font-mono, e.g. BL-2025-0001)
   - Commande (linked sales order number, font-mono)
   - Client
   - Statut (colored Badge: yellow/blue/green/red)
   - Nb articles (hidden on mobile via `hidden md:table-cell`)
   - Date de livraison (hidden on lg via `hidden lg:table-cell`, formatted dd/MM/yyyy with `fr` locale)
   - Actions (Eye button for detail, DropdownMenu for status actions)

4. **Status Labels & Colors**:
   - `draft` → "Brouillon" (bg-yellow-100 text-yellow-800)
   - `confirmed` → "Confirmé" (bg-blue-100 text-blue-800)
   - `delivered` → "Livré" (bg-green-100 text-green-800)
   - `cancelled` → "Annulé" (bg-red-100 text-red-800)

5. **Detail Dialog** (sm:max-w-3xl):
   - Header with Truck icon, number, status badge
   - Info grid: Commande, Client, Transporteur (conditional), Immatriculation (conditional), Date de livraison
   - Lines table: Produit (ref + designation with Package icon), Qté, P.U. HT, Total HT
   - Totals section: Total HT, Total TVA, Total TTC (right-aligned, with border-top)
   - Notes section with FileText icon (conditional)
   - Currency formatting with `formatCurrency` (MAD, fr-FR locale)

6. **Actions via DropdownMenu**:
   - `draft`: Confirmer (CheckCircle icon → PUT action: 'confirm'), Annuler (XCircle icon → PUT action: 'cancel'), Supprimer (Trash2, destructive)
   - `confirmed`: Livrer (Truck icon → PUT action: 'deliver'), Annuler, Supprimer not available
   - `delivered` / `cancelled`: no dropdown actions
   - Delete only available for `draft` and `cancelled` statuses

7. **API Integration**:
   - `GET /delivery-notes?status=...&page=1` → `{ deliveryNotes, total }`
   - `PUT /delivery-notes` with `{ id, action: 'confirm'|'deliver'|'cancel' }`
   - `DELETE /delivery-notes?id=...`

8. **UX**: Loading skeleton state, empty state messages (contextual based on filter), toast notifications on all actions, scrollable table (max-h-500px), responsive design.

9. **Interfaces**: `DeliveryNoteLine`, `DeliveryNote` with nested `salesOrder.lines` and `client` relations.

**shadcn/ui components used**: Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Skeleton.

**Lint:** `npm run lint` passes with 0 errors.

---
## Task ID: 2-a - delivery-notes-backend
### Work Task
Add DeliveryNote and DeliveryNoteLine Prisma models, update existing model relations, create full CRUD API route for delivery notes (Bons de Livraison), and push schema to database.

### Work Summary

**1. Prisma Schema (`prisma/schema.prisma`):**
- Added `DeliveryNoteStatus` enum: `draft`, `confirmed`, `delivered`, `cancelled`
- Added `DeliveryNote` model with fields: id, number (unique), salesOrderId, clientId, status, date, deliveryDate, transporteur, vehiclePlate, notes, totalHT, totalTVA, totalTTC, timestamps, and `lines` relation
- Added `DeliveryNoteLine` model with fields: id, deliveryNoteId (cascade delete), salesOrderLineId, productId, quantity, unitPrice, tvaRate, totalHT
- Added `deliveryNotes DeliveryNote[]` relation to `SalesOrder` model
- Added `deliveryNotes DeliveryNote[]` relation to `Client` model
- Added `deliveryNoteLines DeliveryNoteLine[]` relation to `Product` model
- Fixed datasource provider from `postgresql` to `sqlite` (matching actual SQLite database)

**2. Database (`bun run db:push --force-reset`):**
- Schema pushed successfully to SQLite
- Database re-seeded with all existing data (6 clients, 17 products, 5 quotes, 3 sales orders, etc.)
- `DIRECT_URL` added to `.env` for compatibility

**3. API Route (`src/app/api/delivery-notes/route.ts`):**
- **GET** — List delivery notes with filters (status, clientId, salesOrderId, page, limit). Includes salesOrder (with client + lines + products), client, and lines (with products).
- **POST** — Create delivery note from a sales order. Validates SO is in `prepared` or `partially_delivered` status. Generates sequential number `BL-{year}-{0001}`. Creates DeliveryNoteLine records from SalesOrderLines. Calculates totalHT, totalTVA, totalTTC. Updates SO status to `partially_delivered`. Uses Zod validation with optional fields: transporteur, vehiclePlate, notes.
- **PUT** — Actions:
  - `confirm`: Changes status from draft to confirmed
  - `deliver`: Changes status to delivered, sets deliveryDate to now, checks if all delivery notes for the SO are delivered → updates SO to `delivered`
  - `cancel`: Cancels non-delivered notes, reverts SO status if no active delivery notes remain
  - Simple update for notes/transporteur/vehiclePlate
- **DELETE** — Only allows deletion of `draft` or `cancelled` delivery notes. On deletion, checks remaining delivery notes for the SO and reverts SO status accordingly.

**4. Auth Permissions (`src/lib/auth.ts`):**
- Added `delivery_notes:read` to: direction, commercial, storekeeper
- Added `delivery_notes:write` to: commercial, storekeeper
- Admin and super_admin retain all permissions

**5. Pattern Consistency:**
- API route follows exact same patterns as `preparations/route.ts` and `receptions/route.ts`
- Uses `requireAuth`, `hasPermission`, `auditLog` from `@/lib/auth`
- Uses `db` from `@/lib/db`
- All error messages in French
- Proper transaction usage for data integrity

**Lint:** `npm run lint` passes with 0 errors.


---
Task ID: 1
Agent: main
Task: Support standalone delivery notes (BL without sales order) + full CRUD UI

Work Log:
- Modified Prisma schema: made `salesOrderId` optional on `DeliveryNote` and `salesOrderLineId` optional on `DeliveryNoteLine`
- Added reverse relation `deliveryNoteLines` on `SalesOrderLine`
- Pushed schema to SQLite database with `bun run db:push`
- Rewrote `/api/delivery-notes` API to support two creation modes:
  - Mode 1 (from order): requires `salesOrderId`, auto-fills lines from SO lines
  - Mode 2 (standalone): requires `clientId` + `lines[]` array with manual product selection
- Updated GET to support `standalone=true/false` filter
- Updated all status actions (confirm/deliver/cancel) to handle optional salesOrderId gracefully
- Completely rewrote `delivery-notes-view.tsx` with:
  - Mode toggle in create dialog: "Avec commande" vs "Sans commande"
  - Standalone mode: client selector + manual product line editor with add/remove/edit
  - Line editor: product dropdown, quantity, unit price, TVA rate, auto-calculated totals
  - Grand totals (HT, TVA, TTC) displayed in real-time
  - Type badges in table: "Lié" (linked) vs "Autonome" (standalone)
  - Full detail view showing type, all info, lines table with TVA column
  - Edit dialog for drafts, delete confirmation, status transition actions
- Lint passes cleanly

Stage Summary:
- BL module now supports both linked and standalone delivery notes
- Full CRUD: Create (2 modes), Edit, Detail view, Delete, Status transitions
- Schema: `salesOrderId String?` on DeliveryNote, `salesOrderLineId String?` on DeliveryNoteLine
- No PostgreSQL-specific features used, SQLite compatible locally

---
## Task ID: 3 - smart-deliveries-sales-tracking
### Work Task
Phase 2: Implement smart partial deliveries with quantityDelivered tracking on SalesOrderLine, plannedDate support, delivery percentage calculations, and sales order delivery tracking UI with progress bars and "Create BL" navigation.

### Work Summary

**Part A: Rewrite `src/app/api/delivery-notes/route.ts`:**

1. **Partial delivery support (POST from order)**:
   - Added `partialLineSchema` with `salesOrderLineId` (required) and `quantity` (positive)
   - `createFromOrderSchema` now accepts optional `lines` array for partial delivery
   - If `lines` provided: validates each line's quantity <= remaining (quantity - quantityDelivered)
   - If `lines` NOT provided: backward compatible — auto-fills all order lines with remaining quantities
   - Only includes lines where remaining > 0

2. **Track quantityDelivered (POST)**:
   - On BL creation from order: `tx.salesOrderLine.update` increments `quantityDelivered` by BL line quantity
   - On standalone BL creation: also increments `quantityDelivered` if lines have `salesOrderLineId`
   - SO status updated: checks if all lines fully delivered → `delivered`, else `partially_delivered`

3. **Track quantityDelivered (PUT deliver)**:
   - On deliver action: recalculates total delivered per SO line across all non-cancelled BLs
   - Syncs `quantityDelivered` on each `SalesOrderLine` to ensure consistency
   - Updates SO status to `delivered` if all lines fully delivered

4. **Track quantityDelivered (PUT cancel)**:
   - On cancel: decrements `quantityDelivered` on each BL line's `salesOrderLineId`
   - Rechecks remaining active BLs and recalculates SO status
   - Reverts to `prepared`/`in_preparation` if no deliveries remain

5. **Track quantityDelivered (DELETE)**:
   - On delete of draft: decrements `quantityDelivered` on each linked BL line
   - Does NOT double-decrement on cancelled notes (already reverted)

6. **plannedDate support**:
   - POST: accepts `plannedDate` string, converts to Date
   - PUT simple update: accepts `plannedDate` for update
   - PUT confirm: also accepts `plannedDate`
   - GET response includes `plannedDate` in enriched notes

7. **GET enrichment**:
   - Added `computeDeliveryTracking()` helper: calculates `remainingQuantity` and `deliveryPercentage` per SO line
   - Response enriched with `salesOrderLinesTracking` array (for linked orders)
   - Each BL line enriched with `previouslyDelivered` (quantityDelivered - this BL quantity) and `remainingAfterDelivery`

**Part B: Update `src/components/erp/commercial/delivery-notes-view.tsx`:**

1. **Partial delivery UI (order mode)**:
   - After selecting a sales order, fetches order lines with delivery tracking via delivery-notes API
   - Shows table with: Product (ref + designation), Commandé, Livré, Restant, Avancement (%), Qty BL (editable input), Total HT
   - Filters to only show lines where remaining > 0
   - Default quantity = remaining; max enforced via `Math.min()`
   - Shows green banner "Cette commande est déjà entièrement livrée" when no remaining lines
   - Totals (HT, TVA, TTC) recalculate based on selected quantities
   - Create button disabled until at least one quantity is entered

2. **plannedDate field**:
   - Added to create dialog with CalendarClock icon
   - Added to edit dialog
   - Displayed in table rows and detail dialog

3. **Detail dialog enhancements**:
   - "Suivi de livraison par ligne de commande" section for linked orders
   - Shows overall delivery tracking table per SO line: ordered, delivered, remaining, progress percentage badge
   - BL lines table shows: Qty BL, Déjà livré, Reste après delivery (for linked orders)
   - Action buttons moved inside detail dialog footer for better UX
   - Delete confirmation dialog added

4. **New interfaces**: `OrderLineWithDelivery`, `DeliveryBadge` helper component

**Part C: Update `src/components/erp/commercial/sales-orders-view.tsx`:**

1. **Delivery Tracking section in detail dialog**:
   - Shows "Suivi de livraison" section for orders with status: `prepared`, `partially_delivered`, `delivered`
   - Overall progress bar with percentage (green ≥100%, amber 1-99%, gray 0%)
   - Per-line delivery table: Commandé, Préparé, Livré, Restant, % (with color-coded badges)
   - `quantityDelivered` added to `SalesOrderLine` interface

2. **"Créer BL" action button**:
   - Added to `prepared` and `partially_delivered` order status actions
   - Dispatches `CustomEvent('erp:navigate-delivery-notes', { detail: { salesOrderId } })` for cross-module navigation

3. **New icon imports**: `Truck`, `Package` from lucide-react

**Lint:** `npm run lint` passes with 0 errors.

---
## Task ID: 4 - invoicing-from-delivery-notes
### Work Task
Phase 3: Implement "Facturer depuis BL" (Invoice from delivery notes) feature in the GEMA ERP PRO invoicing module. This includes: backend API changes for creating invoices from delivery notes with junction table support, a new endpoint for fetching uninvoiced BLs, and comprehensive frontend UI with mode toggle, BL selection, and invoice list/detail enhancements.

### Work Summary

**Part A: Backend — `src/app/api/invoices/route.ts`:**

1. **POST — New creation mode from delivery notes (`deliveryNoteIds` array)**:
   - Added `invoiceFromBLSchema` Zod validation (clientId, deliveryNoteIds[], dueDate, discountRate, shippingCost, notes)
   - Detects BL creation mode when body contains `deliveryNoteIds` array
   - Validates all BLs exist and belong to the same client
   - Only allows invoicing of BLs with status `delivered` or `confirmed`
   - Checks that none of the BLs are already linked to another invoice via `InvoiceDeliveryNote`
   - Aggregates all BL lines into invoice lines (keeps separate per BL line)
   - Creates `InvoiceDeliveryNote` junction records linking invoice to each BL
   - Sets `salesOrderId` if all BLs share the same sales order (null otherwise)
   - Calculates totals (HT, TVA, TTC) with discount and shipping cost support
   - Uses `db.$transaction` for atomic creation
   - Returns created invoice with all relations including `deliveryNotes` junction

2. **GET — Enhanced listing with `deliveryNotes` relation**:
   - Added `deliveryNotes` include to all query results (list, create, update, validate, send, pay, cancel)
   - Each `deliveryNotes` entry includes the full `deliveryNote` object with: id, number, date, totalHT, totalTVA, totalTTC, status

3. **DELETE — Cleanup of junction records**:
   - Added `db.invoiceDeliveryNote.deleteMany({ where: { invoiceId: id } })` before deleting invoice lines and invoice

**Part B: New API — `src/app/api/invoices/uninvoiced-bls/route.ts`:**

- **GET**: Takes `clientId` query parameter
- Returns all delivery notes for that client with status `delivered` or `confirmed` that are NOT linked to any invoice
- Cross-references with `InvoiceDeliveryNote` table to filter out already-invoiced BLs
- Includes BL lines (with products), salesOrder, and client relations
- Auth: requires either `invoices:read` or `delivery_notes:read` permission

**Part C: Frontend — `src/components/erp/commercial/invoices-view.tsx`:**

1. **Create Mode Toggle**:
   - Two buttons: "Manuelle" (FileText icon) and "Depuis BL" (Truck icon)
   - State managed via `createMode: 'manual' | 'from_bl'`

2. **"Depuis BL" Mode UI**:
   - Client selector (same dropdown as manual mode)
   - After client selection: fetches uninvoiced BLs via `GET /api/invoices/uninvoiced-bls?clientId=X`
   - BL selection table with: checkbox, N° BL, Date, Commande (if linked), Nb articles, Total TTC
   - "Tout sélectionner / Tout désélectionner" toggle button
   - Clickable rows for easy selection, amber highlight for selected BLs
   - Empty state: dashed border with Truck icon when no BLs available
   - Selected BLs summary card (amber-themed): lists each BL number with its total
   - Aggregated lines preview table: all BL lines shown with product, qty, price, TVA, total
   - Discount, shipping cost, notes fields (same as manual mode)
   - Running totals: Sous-total BLs, Total HT, TVA, TTC
   - Create button: "Créer la facture (N BL)" — disabled when 0 BLs selected

3. **Invoice List Enhancement**:
   - "N BL" amber badge (outline variant) shown in the Client column when invoice has linked BLs
   - Badge includes Truck icon for visual clarity
   - BL badge appears alongside sales order reference if both exist

4. **Invoice Detail Dialog Enhancement**:
   - "Bons de livraison facturés" section with Truck icon header
   - Amber-bordered table showing linked BLs: N° BL, Date, Statut (Livré/Confirmé badge), Total TTC
   - BL count badge also shown in dialog title

5. **New Types/Interfaces**:
   - `InvoiceDeliveryNoteRel`: junction record with nested deliveryNote
   - `UninvoicedBL`: full BL with lines, products, salesOrder, client
   - Invoice interface updated with `deliveryNotes: InvoiceDeliveryNoteRel[]`

6. **UX Improvements**:
   - Moroccan TVA rates in manual mode (0%, 7%, 10%, 14%, 20%)
   - Currency label fixed from "€" to "MAD" in shipping cost labels
   - Loading skeletons for BL fetch
   - Responsive table hiding (md:table-cell for date/commande columns)

**Files modified:**
- `src/app/api/invoices/route.ts` (rewritten ~380 lines)
- `src/components/erp/commercial/invoices-view.tsx` (rewritten ~720 lines)

**Files created:**
- `src/app/api/invoices/uninvoiced-bls/route.ts` (~60 lines)

**Lint:** `npm run lint` passes with 0 errors.
**Dev server:** Compiles successfully, no runtime errors.

---
## Task ID: 5 - preparation-management-stock-check
### Work Task
Phase 4: Full Preparation Management with Stock Check. Rewrite the preparations API route with PreparationLine creation, stock validation, stock check endpoint, and line quantity updates. Rewrite the preparations frontend view with comprehensive UI including list view with progress bars, create dialog with stock preview, detail dialog with editable quantities and stock alerts.

### Work Summary

**Part A: Backend — `src/app/api/preparations/route.ts` (complete rewrite ~470 lines):**

1. **GET — List preparations (enhanced)**:
   - Includes `lines` with full `product` data (id, reference, designation, currentStock, productType, unit)
   - Includes `salesOrder` with `client` (id, name) and `lines` with products
   - Filters: `status`, `salesOrderId`, pagination (`page`, `limit`)
   - Response enriched with `totalLines`, `preparedLines`, `fullyPreparedLines`, `progressPercent` per preparation
   - Each line enriched with `deficit`, `hasDeficit`, `suggestion` based on product type

2. **GET — Stock check endpoint** (`?stockCheck=true&id=xxx`):
   - Returns per-line: stockAvailable (current), stockAvailableAtCreation, deficit, hasDeficit
   - Includes productType, productTypeLabel, suggestion (action + target)
   - Suggestions: `raw_material` → "Commander auprès d'un fournisseur" / `semi_finished|finished` → "Lancer une production"
   - Returns aggregate: totalLines, deficitLines count

3. **POST — Create preparation (enhanced)**:
   - Takes `salesOrderId` + optional `notes`
   - Fetches SO with lines and products
   - Validates SO status is `confirmed` or `in_preparation`
   - Checks no active (pending/in_progress) preparation exists for the SO
   - Creates `PreparationLine` records for each SO line where `quantityRequested > 0`
   - `quantityRequested` = SO line quantity - SO line quantityPrepared
   - `stockAvailable` = product.currentStock at creation time
   - Skips fully prepared lines; returns error if all lines are fully prepared
   - Updates SO status to `in_preparation` if it was `confirmed`
   - Uses `db.$transaction` for atomicity
   - Returns preparation with all lines and product data

4. **PUT — `start` action**: Only `pending` preparations can be started, sets status to `in_progress`

5. **PUT — `validate` action**:
   - Only `in_progress` preparations can be validated
   - Validates each line: `quantityPrepared` <= `quantityRequested`
   - Stock check: blocks if `quantityPrepared` > `product.currentStock` with error details
   - On success (within transaction): increments SOLine.quantityPrepared, creates StockMovement, decrements product stock, sets completed, updates SO status

6. **PUT — `updateLine` action**: Updates individual PreparationLine.quantityPrepared for `in_progress` status

7. **PUT — `cancel` action**: Prevents cancellation of completed preparations, reverts SO status

8. **DELETE — Delete preparation**: Only pending/cancelled, cascade deletes lines, reverts SO status

**Part B: Frontend — `src/components/erp/commercial/preparations-view.tsx` (complete rewrite ~680 lines):**

1. **List view**: Header with icon/badge, status filter, table with Progress bars + ProgressBadge, clickable rows, action dropdowns
2. **Create dialog**: Sales order selector, preview table with stock availability (green OK / red deficit badges), deficit suggestions, amber alert, notes
3. **Detail dialog**: Info grid, overall progress card, lines table with editable quantities, product type badges, state indicators, stock alerts with action buttons (purchase-orders / work-orders navigation)
4. **Delete confirmation**: AlertDialog with destructive styling
5. **Cross-module navigation**: CustomEvent dispatch to purchase-orders and work-orders modules

**Files modified:**
- `src/app/api/preparations/route.ts` (rewritten ~470 lines)
- `src/components/erp/commercial/preparations-view.tsx` (rewritten ~680 lines)

**Lint:** `npm run lint` passes with 0 errors.
---
Task ID: main-phase1-2-3-4
Agent: main (orchestrator) + 3 subagents
Task: Implement full commercial flow overhaul (4 phases)

Work Log:
- PHASE 1: Schema changes applied and pushed
  - Added `quantityDelivered Float @default(0)` to SalesOrderLine
  - Added `plannedDate DateTime?` to DeliveryNote
  - Created `PreparationLine` model (preparationOrderId, salesOrderLineId, productId, quantityRequested, quantityPrepared, stockAvailable, notes)
  - Created `InvoiceDeliveryNote` junction model (invoiceId, deliveryNoteId with unique constraint)
  - Added `lines PreparationLine[]` to PreparationOrder
  - Added `invoices InvoiceDeliveryNote[]` to DeliveryNote
  - Added `deliveryNotes InvoiceDeliveryNote[]` to Invoice
  - Added `preparationLines PreparationLine[]` to Product
  - db push + generate successful

- PHASE 2 (subagent 2d53797e): Smart Deliveries + Sales Order tracking
  - Rewrote delivery-notes API: partial delivery support, quantityDelivered tracking, plannedDate, delivery percentage calculation
  - Rewrote delivery-notes-view: partial delivery UI with qty ordered/delivered/remaining columns, editable "Qty BL" input, delivery tracking in detail
  - Updated sales-orders-view: delivery tracking section with progress bars, "Créer BL" button

- PHASE 3 (subagent 680adf03): Invoicing from Delivery Notes
  - Enhanced invoice API: POST with deliveryNoteIds mode, creates InvoiceDeliveryNote junction records, GET includes deliveryNotes relation
  - Created new endpoint: /api/invoices/uninvoiced-bls/route.ts (returns BLs not yet invoiced for a client)
  - Rewrote invoices-view: mode toggle (Manuelle / Depuis BL), client selector → uninvoiced BLs table with checkboxes → create invoice, "N BL" badges in list, detail shows linked BLs

- PHASE 4 (subagent cda0c89b): Full Preparation Management
  - Rewrote preparations API: creates PreparationLine records, stock check with deficit analysis, stock validation on validate action, stock movements
  - Rewrote preparations-view: list with progress bars, create dialog with stock availability preview (green OK / red deficit), detail with editable quantities and stock alert cards suggesting purchase/production

Stage Summary:
- Complete commercial flow: Devis → Commande → Préparation → Livraison → Facturation
- Partial delivery support with quantity tracking per order line
- Invoice can group multiple delivery notes from same client
- Preparation checks stock availability and suggests procurement actions
- All lint checks pass, dev server compiles without errors
- Total files modified/created: ~10 files, ~7260 lines of code
---
Task ID: 2
Agent: main + subagent (full-stack-developer)
Task: Full commercial flow - Partial deliveries, delivery tracking, invoice grouping

Work Log:
- Analyzed existing codebase: found that most of the commercial flow was already implemented
  - Quotes: Full CRUD with status transitions and transform→order action
  - Sales Orders: Full CRUD with quote import, preparation creation, delivery tracking with progress bars
  - Preparations: Full UI with stock checking, progress tracking, deficit alerts, purchase/production suggestions
  - Invoices: Full CRUD with both manual and from-BL modes, multi-BL selection via InvoiceDeliveryNote junction
- Identified the main gap: Delivery Notes lacked partial delivery support
  - API was copying ALL lines with full quantities from sales orders
  - No per-line quantity selection when creating a BL
  - `quantityDelivered` on SalesOrderLine was not being updated

Changes Made:

1. **Schema** (already existed):
   - `SalesOrderLine.quantityDelivered Float @default(0)` ✓
   - `PreparationLine` with stock tracking ✓
   - `InvoiceDeliveryNote` junction table ✓
   - `DeliveryNote.plannedDate DateTime?` ✓

2. **API `/api/delivery-notes/route.ts`** - Rewrote:
   - POST from order now requires `lines: [{ salesOrderLineId, quantity }]` array
   - Validates each line's quantity against remaining (ordered - delivered)
   - Auto-calculates totals from selected line quantities
   - PUT deliver action now increments `quantityDelivered` on SalesOrderLine
   - Recalculates SO status (partially_delivered / delivered) based on all lines

3. **API `/api/sales-orders/route.ts`** - Added `id` query parameter for single order lookup

4. **UI `delivery-notes-view.tsx`** - Major rewrite by subagent:
   - Create from Order mode: shows checkbox per line, ordered/delivered/remaining columns, editable quantity per line
   - Select All checkbox, filters by included lines with qty > 0
   - Detail view: shows overall delivery progress bar, per-line tracking (ordered, delivered, remaining)
   - Table: added "Date prévue" column, "% Livré" column with progress bars
   - DeliveryProgressBar component for visual progress

Stage Summary:
- Complete commercial flow is now functional: Devis → Commande → Préparation → BL (partiel) → Facture
- Partial deliveries: user selects quantities per line, system tracks cumulative delivered amounts
- Multi-BL invoicing: select multiple delivered BLs to generate a single invoice
- All lint checks pass, dev server running on port 3000
---
Task ID: 3-4-5-fixes-verify
Agent: main
Task: Verify and fix TVA rates, currency labels, and search across all commercial views

Work Log:
- Verified commit fc0b942 is pushed with all fixes
- Checked all TVA rate selects across commercial views: all use Moroccan rates (0%, 7%, 10%, 14%, 20%)
- Checked all € labels: none remaining (all replaced with MAD or generic symbol)
- Checked search bars: preparations-view and delivery-notes-view both have search with Search icon
- Checked API search support: both preparations and delivery-notes API routes accept `search` param with OR filtering
- Credit-notes-view.tsx confirmed using Moroccan TVA rates (7%, 14%)
- All fixes already applied in earlier commits, repo is clean and up-to-date

Stage Summary:
- All 3 remaining issues were already fixed in previous sessions
- TVA rates unified to Moroccan standard across all views
- Currency labels all show MAD
- Search functionality added to Preparations and Delivery Notes
- Repo is clean, everything pushed to origin/main at fc0b942
