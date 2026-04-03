# Worklog

---
## Task ID: 7 - API Bug Fixes (Database Transactions & Payment Balance Updates)
### Work Task
Fix three API bugs related to missing database transactions (race conditions) and missing financial account balance updates in the ERP system.

### Work Summary

#### Bug 1: Bank transactions lack database transactions (race condition)
**File:** `src/app/api/finance/bank/route.ts`
**Problem:** Bank transaction creation and balance updates were executed as separate DB calls, causing potential race conditions where the transaction record could be created but the balance update fails (or vice versa).
**Fix Applied:**
- **POST (create transaction):** Wrapped `db.bankTransaction.create()` and `db.bankAccount.update()` in `db.$transaction([...])` array-style transaction.
- **PUT (update transaction with amount change):** When amount changes, wrapped `db.bankTransaction.update()` and balance diff `db.bankAccount.update()` in `db.$transaction([...])`.
- **DELETE (delete transaction):** Wrapped balance reversal (`decrement`) and `db.bankTransaction.delete()` in `db.$transaction([...])`.

#### Bug 2: Reception processing lacks transaction
**File:** `src/app/api/receptions/route.ts`
**Problem:** The reception processing loop performed multiple independent DB operations (update PO line, create stock movement, update product stock/avg cost, update PO status, create reception record) without transactional guarantees. A failure mid-loop would leave the database in an inconsistent state.
**Fix Applied:** Wrapped the entire processing block in `db.$transaction(async (tx) => { ... })` interactive transaction. All operations (PO line updates, stock movements, product stock updates, PO status determination, reception creation) now execute atomically. Validation errors within the loop throw exceptions that trigger automatic rollback.

#### Bug 3: Payment doesn't update actual cash/bank balances for `client_payment`
**File:** `src/app/api/finance/payments/route.ts`
**Problem:** When processing a `client_payment`, the code created accounting entries and updated the client balance, but never updated the actual `CashRegister` or `BankAccount` balance. This meant financial account balances were out of sync with reality.
**Fix Applied:**
- Added balance update logic for `client_payment` type based on payment method:
  - `cash` → finds active `CashRegister` and increments balance
  - `bank_transfer` / `check` / `card` → finds active `BankAccount` and increments balance
- Wrapped the entire payment creation flow (payment record, accounting entries, financial account balance updates, client balance update, invoice status update) in `db.$transaction(async (tx) => { ... })` for atomicity.

#### Lint Check
All changes pass ESLint with no errors.

---
## Task ID: 8 - UI/UX Fixes (Toast Notifications & Toast System Config)
### Work Task
Fix missing toast notifications in clients-view and products-view, migrate login-page from legacy toast system to sonner, and fix broken timing/limit constants in use-toast.ts.

### Work Summary

#### Fix 1: Missing toast notifications in clients-view.tsx
**File:** `src/components/erp/commercial/clients-view.tsx`
**Changes:**
- Added `import { toast } from 'sonner'`
- `fetchClients` catch: added `toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des clients.' })`
- `handleSave` catch: added `toast.error('Erreur de sauvegarde', { description: 'Impossible de sauvegarder le client.' })`
- `handleSave` success: added `toast.success('Client modifié', ...)` on update and `toast.success('Client créé', ...)` on create
- `handleDelete` catch: added `toast.error('Erreur de suppression', { description: 'Impossible de supprimer le client.' })`
- `handleDelete` success: added `toast.success('Client supprimé', { description: 'Le client a été supprimé avec succès.' })`

#### Fix 2: Missing toast notifications in products-view.tsx
**File:** `src/components/erp/commercial/products-view.tsx`
**Changes:**
- Added `import { toast } from 'sonner'`
- `fetchProducts` catch: added `toast.error('Erreur de chargement', { description: 'Impossible de charger la liste des produits.' })`
- `handleSave` catch: added `toast.error('Erreur de sauvegarde', { description: 'Impossible de sauvegarder le produit.' })`
- `handleSave` success: added `toast.success('Produit modifié', ...)` on update and `toast.success('Produit créé', ...)` on create
- `handleDelete` catch: added `toast.error('Erreur de suppression', { description: 'Impossible de supprimer le produit.' })`
- `handleDelete` success: added `toast.success('Produit supprimé', { description: 'Le produit a été supprimé avec succès.' })`

#### Fix 3: Login page migrated from old toast to sonner
**File:** `src/components/erp/login-page.tsx`
**Changes:**
- Removed `import { ToastAction } from '@/components/ui/toast'` (unused)
- Removed `import { useToast } from '@/hooks/use-toast'` (unused)
- Added `import { toast } from 'sonner'`
- Removed `const { toast } = useToast()` hook call
- Replaced success toast from `toast({ title: 'Connexion réussie', description: ... })` to `toast.success('Connexion réussie', { description: ... })`
- Replaced error toast from `toast({ title: 'Erreur de connexion', description: msg, variant: 'destructive', action: <ToastAction ...> })` to `toast.error('Erreur de connexion', { description: msg })`

#### Fix 4 & 5: use-toast.ts broken timing and limit
**File:** `src/hooks/use-toast.ts`
**Changes:**
- `TOAST_LIMIT`: changed from `1` to `5` (allows up to 5 simultaneous toasts)
- `TOAST_REMOVE_DELAY`: changed from `1000000` (~16.6 minutes) to `5000` (5 seconds, proper auto-dismiss)

#### Lint Check
All changes pass ESLint with no errors.

---
## Task ID: 9 - Code Quality Fixes (Type Safety & Schema Improvements)
### Work Task
Fix `any` type usage across three commercial view components, add missing `status` field to work order step schema, and improve API error response handling to check content-type before parsing.

### Work Summary

#### Fix 1: `any` type usage in quotes-view.tsx
**File:** `src/components/erp/commercial/quotes-view.tsx`
**Changes:**
- All 5 `catch (err: any)` blocks changed to `catch (err: unknown)` with type narrowing: `const msg = err instanceof Error ? err.message : 'Erreur'`
- `updateLine` function parameter `value: any` changed to `value: string | number`

#### Fix 2: `any` type usage in sales-orders-view.tsx
**File:** `src/components/erp/commercial/sales-orders-view.tsx`
**Changes:**
- All 6 `catch (err: any)` blocks changed to `catch (err: unknown)` with proper type narrowing
- `updateLine` function parameter `value: any` changed to `value: string | number`

#### Fix 3: `any` type usage in credit-notes-view.tsx
**File:** `src/components/erp/commercial/credit-notes-view.tsx`
**Changes:**
- All 4 `catch (err: any)` blocks changed to `catch (err: unknown)` with proper type narrowing
- `updateLine` function parameter `value: any` changed to `value: string | number`

#### Fix 4: Work orders stepSchema missing status field
**File:** `src/app/api/production/work-orders/route.ts`
**Changes:**
- Added `status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional()` to `stepSchema` object
- This allows the `update_step` action to properly parse and apply step status changes

#### Fix 5: API error response handling improvement
**File:** `src/lib/api.ts`
**Changes:**
- Replaced the old error handling (unconditional `res.json()` parse) with a content-type check
- Now checks `res.headers.get('content-type')` for `application/json` before attempting to parse the response body
- Falls back to a generic `Erreur ${res.status}` message for non-JSON responses, preventing JSON parse errors on HTML error pages

#### Lint Check
All changes pass ESLint with no errors.
