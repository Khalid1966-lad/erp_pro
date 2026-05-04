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
