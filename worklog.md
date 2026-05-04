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
