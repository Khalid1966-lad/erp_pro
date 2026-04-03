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
**Problem:** The reception processing loop performed multiple independent DB operations without transactional guarantees.
**Fix Applied:** Wrapped the entire processing block in `db.$transaction(async (tx) => { ... })` interactive transaction.

#### Bug 3: Payment doesn't update actual cash/bank balances for `client_payment`
**File:** `src/app/api/finance/payments/route.ts`
**Problem:** When processing a `client_payment`, the code never updated actual `CashRegister` or `BankAccount` balance.
**Fix Applied:** Added balance update logic for `client_payment` based on payment method, wrapped in `db.$transaction()`.

---
## Task ID: 8 - UI/UX Fixes (Toast Notifications & Toast System Config)
### Work Task
Fix missing toast notifications, migrate login-page from legacy toast system to sonner, and fix broken timing/limit constants.

### Work Summary
- Added sonner toast notifications to clients-view and products-view
- Migrated login-page from `useToast` to `sonner`
- Fixed `TOAST_REMOVE_DELAY` (1000000 → 5000) and `TOAST_LIMIT` (1 → 5)

---
## Task ID: 9 - Code Quality Fixes (Type Safety & Schema Improvements)
### Work Task
Fix `any` type usage, add missing status field to work order step schema, and improve API error handling.

### Work Summary
- Changed all `catch (err: any)` to `catch (err: unknown)` in 3 views (15+ occurrences)
- Added `status` field to `stepSchema` in work-orders route
- Improved API error handling with Content-Type check before JSON parsing

---
## Task ID: vercel-neon-config - Vercel + Neon PostgreSQL Deployment Configuration
### Work Task
Configure the ProERP project for deployment on Vercel with Neon PostgreSQL database.

### Work Summary

#### 1. Prisma Schema: SQLite → PostgreSQL
**File:** `prisma/schema.prisma`
- Changed `provider` from `"sqlite"` to `"postgresql"`
- Added `directUrl = env("DIRECT_URL")` for Prisma migrations (bypasses connection pooling)

#### 2. package.json: Vercel Build Scripts
**File:** `package.json`
- `postinstall`: Added `"prisma generate"` (Vercel runs this automatically)
- `build`: Changed to `"prisma generate && next build"`
- `start`: Simplified to `"next start"`
- Added `"db:migrate:deploy": "prisma migrate deploy"` for production migrations

#### 3. next.config.ts: Removed Standalone Output
**File:** `next.config.ts`
- Removed `output: "standalone"` (Vercel handles this automatically)

#### 4. .env.example Created
**File:** `.env.example`
Documents 4 required environment variables:
- `DATABASE_URL` — Neon with connection pooling (`?pgbouncer=true`)
- `DIRECT_URL` — Neon direct connection for migrations
- `JWT_SECRET` — Strong random string for JWT signing
- `PASSWORD_SALT` — Strong random string for password hashing
