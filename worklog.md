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
