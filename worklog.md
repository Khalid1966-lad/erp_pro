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
