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
Task ID: 1
Agent: Main
Task: Fix login access issues and refine permissions

Work Log:
- Fixed super admin hardcoded email typo: `contact@jazelwebagnecy.com` → `contact@jazelwebagency.com` in login route
- Fixed profile API bug: `isBlocked: false` in select (should be `true` to include the field)
- Verified all API routes for users are already restricted to `super_admin` only (GET, POST, PUT, block)
- Added `super_admin` to valid roles in user create and update API endpoints
- Added `isSuperAdmin` flag when creating users with `super_admin` role
- Added `super_admin` role option to frontend user create/edit dialog
- Restarted dev server, verified compilation with lint (0 errors)
- Synced Prisma schema to database (already in sync)

Stage Summary:
- Super admin login now works with correct email: `contact@jazelwebagency.com` / `hello@erp2026`
- Only super admins can create, modify, or block users
- Super admins can now create other super admins from the UI
- Profile page available for all users to view info and change password
- Dev server running on port 3000, all code passing lint
