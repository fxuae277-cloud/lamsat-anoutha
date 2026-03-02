# لمسة أنوثة - نظام ERP + POS

## Overview
Arabic RTL ERP and POS system for "لمسة أنوثة إكسسوارات لوى" accessories shop in Oman.
Manages 3 branches + main warehouse + branch warehouses + cashier + WhatsApp/Instagram orders + expenses + salaries + financial reports.

Currency: Omani Rial (OMR) | VAT: 5% | Unified pricing across branches.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend) + Express routes (backend)
- **State Management**: TanStack Query
- **Auth**: express-session + connect-pg-simple (HttpOnly cookie)

## Project Structure
```
client/src/
  components/layout/    → Sidebar, AppLayout
  components/ui/        → shadcn/ui components
  pages/                → Login, Dashboard, POS, Products, Inventory, Orders, Expenses, Settings
  hooks/                → use-toast, use-mobile
  lib/                  → queryClient, auth (AuthProvider/useAuth), utils
server/
  index.ts              → Express server entry + session setup
  routes.ts             → API routes (/api/*) + requireAuth middleware
  storage.ts            → DatabaseStorage class (Drizzle queries)
  db.ts                 → Database connection
  seed.ts               → Initial data seeding
shared/
  schema.ts             → Drizzle schema + Zod validation
```

## Authentication & Authorization
- Login via POST /api/auth/login (username + password)
- Session stored in PostgreSQL via connect-pg-simple
- GET /api/auth/me returns current user (without password)
- POST /api/auth/logout destroys session
- `requireAuth` middleware protects: /api/orders, /api/shifts, /api/expenses, /api/reports, /api/sales
- Frontend shows Login page when no session exists
- Users table has: username, password, name, role, branchId, terminalName, isActive
- POST /api/shifts takes only `openingCash`; branchId, cashierId, terminalName come from session user
- GET /api/shifts/current uses session user's branchId + terminalName
- Default users: mariam/owner123 (owner), ahmed/owner123 (owner), fatma/cashier123, noura/cashier123, huda/cashier123

## Database Schema (PostgreSQL)
- branches, cities
- users (roles: owner/cashier/employee, with terminalName + branchId)
- categories, products
- warehouses, inventory, inventory_transfers
- customers, suppliers
- sales, sale_items
- orders, order_items (orders have shift_id + payment_method + paid_at)
- expenses (with shift_id + source: cash/card/bank_transfer)
- employees, shifts (with expectedCash, actualCash, difference, terminalName)
- **cash_ledger** (date, branch_id, shift_id, type, amount_in, amount_out, note, created_by)
- **bank_ledger** (date, branch_id, shift_id, method[card/bank_transfer], amount_in, amount_out, ref_id, note, created_by)
- **session** (auto-created by connect-pg-simple)

## Payment Flow
- Payment methods: `cash`, `card`, `bank_transfer` (PAYMENT_METHODS constant)
- Orders start as status=new, become status=paid only after POST /api/orders/:id/pay
- On payment: paymentMethod + paidAt stored on order, ledger entry created in cash_ledger or bank_ledger
- Expenses also record ledger entries based on source (cash → cash_ledger, card/bank → bank_ledger)

## Shift Closing
- Cannot close shift if pending orders exist (status: new/processing/pending)
- expected_cash = sum of paid cash orders - sum of cash expenses for that shift
- actual_cash entered by user at close time
- difference = actual - expected, recorded in cash_ledger as type=shift_difference

## Key Features
1. **Login**: Username/password authentication, session-based
2. **Dashboard**: Daily sales, VAT, order count, low-stock alerts, weekly chart
3. **POS**: Session-based branch/cashier (read-only), barcode scan, cart, discount, VAT 5%, cash/card/bank payment, shift open/check
4. **Products**: CRUD with barcode, category, unified price, active toggle
5. **Inventory**: Main + branch warehouses, receive stock, transfer between warehouses, low-stock alerts
6. **Orders**: WhatsApp/Instagram orders, auto-branch assignment by city, status tracking, payment recording
7. **Expenses**: Categorized expenses per branch with source tracking + ledger integration
8. **Shift Reports**: GET /api/reports/shift?shiftId=... → cash/card/bank sales, expenses, expected vs actual cash
9. **Settings**: Branches, users/roles, cities mapping, VAT config

## API Routes
All prefixed with `/api/`:
- POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`
- GET/POST `/branches`, `/categories`, `/products`, `/warehouses`
- GET/POST/PATCH/DELETE `/products/:id`
- GET/POST `/inventory`, `/inventory/receive`, `/inventory/transfer`
- GET/POST `/sales` (requireAuth), `/orders` (requireAuth), `/expenses` (requireAuth), `/employees`, `/shifts` (requireAuth)
- POST `/orders/:id/pay` (requireAuth)
- PATCH `/orders/:id/status` (requireAuth), `/shifts/:id/close` (requireAuth)
- GET `/reports/shift?shiftId=...` (requireAuth)
- GET `/shifts/current` (requireAuth, uses session user)
- GET `/dashboard`

## Design
- Arabic-only RTL interface
- Font: Cairo (Google Fonts)
- Color palette: Soft rose/pink primary (#346 80% 65%) + light grays
- Responsive: Desktop + Tablet

## Important Notes
- branchId in products table is nullable (unified pricing across branches)
- users.branchId is also nullable
- Schema has isActive field on users table (boolean, default true)
- Seed runs only if no branches exist (idempotent)
- Orders auto-link to open shift for the branch when created
- DB has triggers on orders table (auto-set order_number) - do not interfere
- DB has unique constraint `uniq_open_shift_per_terminal` preventing duplicate open shifts per terminal
