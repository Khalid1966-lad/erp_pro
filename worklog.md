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
