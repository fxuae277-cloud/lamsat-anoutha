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

## Project Structure
```
client/src/
  components/layout/    → Sidebar, AppLayout
  components/ui/        → shadcn/ui components
  pages/                → Dashboard, POS, Products, Inventory, Orders, Expenses, Settings
  hooks/                → use-toast, use-mobile
  lib/                  → queryClient, utils
server/
  index.ts              → Express server entry
  routes.ts             → API routes (/api/*)
  storage.ts            → DatabaseStorage class (Drizzle queries)
  db.ts                 → Database connection
  seed.ts               → Initial data seeding
shared/
  schema.ts             → Drizzle schema + Zod validation
```

## Database Schema (PostgreSQL)
- branches, cities
- users (roles: owner/cashier/employee)
- categories, products
- warehouses, inventory, inventory_transfers
- customers, suppliers
- sales, sale_items
- orders, order_items (orders have shift_id + payment_method + paid_at)
- expenses (with shift_id + source: cash/card/bank_transfer)
- employees, shifts (with expectedCash, actualCash, difference)
- **cash_ledger** (date, branch_id, shift_id, type, amount_in, amount_out, note, created_by)
- **bank_ledger** (date, branch_id, shift_id, method[card/bank_transfer], amount_in, amount_out, ref_id, note, created_by)

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
1. **Dashboard**: Daily sales, VAT, order count, low-stock alerts, weekly chart
2. **POS**: Branch/cashier selection, barcode scan, cart, discount, VAT 5%, cash/card/bank payment
3. **Products**: CRUD with barcode, category, unified price, active toggle
4. **Inventory**: Main + branch warehouses, receive stock, transfer between warehouses, low-stock alerts
5. **Orders**: WhatsApp/Instagram orders, auto-branch assignment by city, status tracking, payment recording
6. **Expenses**: Categorized expenses per branch with source tracking + ledger integration
7. **Shift Reports**: GET /api/reports/shift?shiftId=... → cash/card/bank sales, expenses, expected vs actual cash
8. **Settings**: Branches, users/roles, cities mapping, VAT config

## API Routes
All prefixed with `/api/`:
- GET/POST `/branches`, `/categories`, `/products`, `/warehouses`
- GET/POST/PATCH/DELETE `/products/:id`
- GET/POST `/inventory`, `/inventory/receive`, `/inventory/transfer`
- GET/POST `/sales`, `/orders`, `/expenses`, `/employees`, `/shifts`
- POST `/orders/:id/pay` (paymentMethod: cash/card/bank_transfer)
- PATCH `/orders/:id/status`, `/shifts/:id/close` (requires actualCash)
- GET `/reports/shift?shiftId=...`
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
