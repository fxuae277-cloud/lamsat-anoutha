# لمسة أنوثة - نظام ERP + POS

## Overview
Arabic RTL ERP and POS system for "لمسة أنوثة إكسسوارات لوى" accessories shop in Oman.
Manages 3 branches + main warehouse + branch warehouses + cashier + WhatsApp/Instagram orders + expenses + salaries + financial reports + purchases with Average Cost.

Currency: Omani Rial (OMR) | VAT: 5% | Unified pricing across branches.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS v4 + shadcn/ui + Recharts
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend) + Express routes (backend)
- **State Management**: TanStack Query
- **Auth**: express-session + connect-pg-simple (HttpOnly cookie)
- **Export**: xlsx (Excel export)

## Project Structure
```
client/src/
  components/layout/    → Sidebar, AppLayout
  components/ui/        → shadcn/ui components
  pages/                → Login, Dashboard, POS, Products, Inventory, Orders, Expenses, Settings, Reports, Purchases
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
- POST /api/auth/change-password (oldPassword, newPassword) - any logged-in user
- `requireAuth` middleware protects: /api/orders, /api/shifts, /api/expenses, /api/reports, /api/sales, /api/ledger, /api/purchases
- `requireOwnerOrAdmin` middleware protects: /api/users (GET/POST/PATCH)
- `requireManager` (owner/admin/manager only) middleware protects: inventory transfer, add-stock, purchase posting
- Cashier UI: inventory page shows showroom-only read-only view; transfer & transactions tabs hidden; purchase post button hidden
- Frontend shows Login page when no session exists
- Users table has: username (unique), password (bcrypt), name, role, branchId, terminalName, isActive
- POST /api/shifts takes only `openingCash`; branchId, cashierId, terminalName come from session user
- GET /api/shifts/current uses session user's branchId + terminalName
- User management (owner/admin only):
  - GET /api/users (strips passwords)
  - POST /api/users (name, username, password, role, branchId, terminalName) - checks unique username
  - PATCH /api/users/:id (name, role, branchId, terminalName, isActive)
  - PATCH /api/users/:id/reset-password (newPassword)
- Default users: owner/Owner@12345 (bootstrap), mariam/owner123, ahmed/owner123, fatma/cashier123, noura/cashier123, huda/cashier123

## Database Schema (PostgreSQL)
- branches, cities
- users (roles: owner/cashier/employee, with terminalName + branchId)
- categories, products (with avg_cost + stock_qty for Average Cost tracking)
- warehouses, inventory, inventory_transfers (legacy)
- **locations** (branch_id, code[showroom/backstore], name, active) — auto-created for each branch
- **location_inventory** (location_id, product_id, qty_on_hand, reorder_level, updated_at) — unique(location_id, product_id)
- **inventory_transactions** (date, branch_id, from_location_id, to_location_id, product_id, type, qty, ref_table, ref_id, note, created_by)
- customers, suppliers
- sales, sale_items (sales have shift_id + payment_method)
- orders, order_items (orders have shift_id + payment_method + paid_at)
- expenses (with shift_id + source: cash/card/bank_transfer)
- employees, shifts (with expectedCash, actualCash, difference, terminalName)
- **cash_ledger** (date, branch_id, shift_id, type, amount_in, amount_out, category, note, created_by)
- **bank_ledger** (date, branch_id, shift_id, method[card/bank_transfer], amount_in, amount_out, ref_id, category, note, created_by)
- **purchase_invoices** (invoice_number, supplier_id, branch_id, invoice_date, shipping/customs/clearance/other costs, subtotal, total_extra_cost, grand_total, status[draft/posted])
- **purchase_items** (purchase_id, product_id, qty, unit_cost_base, line_subtotal, allocated_extra_cost, unit_cost_final)
- **session** (auto-created by connect-pg-simple)

## Purchases & Average Cost System
- Create draft purchase invoice with optional supplier, branch, date, extra costs
- Add items with product, qty, base unit cost → auto-calculate line_subtotal
- Extra costs: shipping, customs, clearance, other
- **Posting** (POST /api/purchases/:id/post):
  1. Calculate subtotal_items = sum of all line_subtotals
  2. Calculate total_extra_cost = shipping + customs + clearance + other
  3. Allocate extra costs to items proportionally: allocated = total_extra * (line_subtotal / subtotal_items)
  4. Calculate unit_cost_final = (line_subtotal + allocated_extra) / qty
  5. Update products.avg_cost using Weighted Average: new_avg = (old_avg * old_qty + unit_cost_final * new_qty) / (old_qty + new_qty)
  6. Update products.stock_qty += qty
- Guards: Cannot post if status != draft or items empty; cannot modify posted invoices

## COGS & Profit Tracking
- **POS Sales** (createSale): calculates COGS = sum(qty * product.avg_cost) at time of sale, stores in sales.cogs_total and sales.gross_profit
- **Order Payment** (payOrder): calculates COGS = sum(qty * product.avg_cost) at time of payment, stores in orders.cogs_total and orders.gross_profit
- **Daily Report** (/api/reports/daily): includes cogsTotal, grossProfit, netProfit (= grossProfit - expenses)
- **Branch Comparison** (/api/reports/branch-comparison): sales, cogs, gross, expenses, net per branch with margin %

## Multi-Location Inventory System
- Each branch auto-gets 2 locations: showroom (صالة العرض) + backstore (المخزن)
- **addStock(branchId, ...)**: adds to backstore + logs transaction (used by purchase posting)
- **removeStock(branchId, ...)**: deducts from showroom, throws error if insufficient qty (used by POS sales)
- **transferStock(fromLocId, toLocId, ...)**: internal transfer between locations within same branch
- Purchase posting → stock enters backstore
- POS sale → stock deducted from showroom (blocks sale if insufficient)
- Sale return → stock enters showroom
- Frontend tabs: مخزون المواقع (filter by branch/location), نقل داخلي (backstore→showroom), حركات المخزون (filterable transaction log)
- Transaction types: purchase_receipt, sale, sale_return, internal_transfer, manual_receipt, adjustment
- Permissions: cashier sees own branch only; owner/admin can select any branch

## Ledger System
- **cash_ledger types**: sale, expense, order_payment, shift_difference
- **bank_ledger methods**: card, bank_transfer
- POS sale → cash_ledger (if cash) or bank_ledger (if card/bank_transfer) with type='sale'
- Order payment → cash_ledger (if cash) or bank_ledger (if card/bank_transfer) with type='order_payment'
- Expense → cash_ledger (if source=cash) or bank_ledger (if source=card/bank_transfer) with type='expense'
- Shift close difference → cash_ledger with type='shift_difference'
- API: GET /api/ledger/cash, GET /api/ledger/bank (optional ?branchId filter)

## Payment Flow
- Payment methods: `cash`, `card`, `bank_transfer` (PAYMENT_METHODS constant)
- POS sales auto-assigned shiftId from session user's open shift + auto ledger entries
- Orders start as status=new, become status=paid only after POST /api/orders/:id/pay
- On payment: paymentMethod + paidAt stored on order, ledger entry created
- Expenses auto-assigned branchId + shiftId from session user (not from request body)

## Shift Closing
- Cannot close shift if pending orders exist (status: new/processing/pending)
- expected_cash = (sum cash orders paid + sum cash POS sales) - sum cash expenses for that shift
- actual_cash entered by user at close time
- difference = actual - expected, recorded in cash_ledger as type=shift_difference
- totalSales, totalCash, totalBank all include both orders + POS sales

## Key Features
1. **Login**: Username/password authentication, session-based
2. **Dashboard**: Daily sales, VAT, order count, low-stock alerts, weekly chart
3. **POS**: Session-based branch/cashier (read-only), barcode scan, cart, discount, VAT 5%, cash/card/bank payment, shift open/check
4. **Products**: CRUD with barcode, category, unified price, active toggle, avg_cost + stock_qty display
5. **Inventory**: Multi-location per branch (showroom + backstore), internal transfers, low-stock alerts, transaction log
6. **Orders**: WhatsApp/Instagram orders, auto-branch assignment by city, status tracking, payment recording
7. **Expenses**: Categorized expenses per branch with source tracking + ledger integration (tabbed: expenses / cash ledger / bank ledger)
8. **Shift Reports**: GET /api/reports/shift?shiftId=... → cash/card/bank sales, expenses, expected vs actual cash
9. **Settings**: Tabbed interface - account (change password), users (owner/admin), general settings, branches & cities
10. **Reports**: Shift report + Daily report (with COGS/Profit analysis) + Branch comparison report + Profit reports (by branch/employee/product)
11. **Purchases**: Full purchase invoice system with Average Cost calculation, extra cost allocation, posting workflow
12. **COGS/Profit**: Automatic cost tracking on sales and order payments with profit analysis
13. **Export**: Daily report Excel/PDF export, multi-branch profit Excel export (date range), sales invoices Excel export
14. **Invoices (فواتير نقطة البيع)**: POS sales invoice browser with filters (date, payment method, employee, branch), detail modal with print, Excel export

## API Routes
All prefixed with `/api/`:
- POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`, POST `/auth/change-password`
- GET/POST `/branches`, `/categories`, `/products`, `/warehouses`
- GET/POST/PATCH/DELETE `/products/:id`
- GET/POST `/inventory`, `/inventory/receive`, `/inventory/transfer`
- GET/POST `/sales` (requireAuth), `/orders` (requireAuth), `/expenses` (requireAuth), `/employees`, `/shifts` (requireAuth)
- POST `/orders/:id/pay` (requireAuth)
- PATCH `/orders/:id/status` (requireAuth), `/shifts/:id/close` (requireAuth)
- GET `/reports/shift?shiftId=...`, `/reports/daily?date=...&branchId=...`, `/reports/shifts-by-date?date=...` (requireAuth)
- GET `/shifts/current` (requireAuth, uses session user)
- GET `/ledger/cash`, `/ledger/bank` (requireAuth, optional ?branchId)
- GET/POST/PATCH `/users`, `/users/:id/reset-password` (requireOwnerOrAdmin)
- GET/POST `/purchases`, GET `/purchases/:id`, PATCH `/purchases/:id`, POST `/purchases/:id/items`, DELETE `/purchases/:purchaseId/items/:itemId`, POST `/purchases/:id/post` (requireAuth)
- GET/POST/PATCH `/suppliers`
- GET `/reports/profit/branches?from=...&to=...`, `/reports/profit/employees?from=...&to=...&branchId=...`, `/reports/profit/products?from=...&to=...&branchId=...` (requireAuth, cashier sees own branch only)
- GET `/sales` with filters: from, to, paymentMethod, employeeId, branchId (cashier sees own branch only); GET `/sales/:id` returns enriched detail with items + product/branch/cashier names
- GET `/exports/daily.xlsx?date=...&branchId=...`, GET `/exports/daily.pdf?date=...&branchId=...`, GET `/exports/profit_all_branches.xlsx?from=...&to=...`, GET `/exports/profit_by_employee.xlsx?from=...&to=...&branchId=...`, GET `/exports/profit_by_product.xlsx?from=...&to=...&branchId=...`, GET `/exports/sales.xlsx?from=...&to=...&branchId=...&paymentMethod=...&employeeId=...` (requireAuth)
- GET `/dashboard`

## Design
- Arabic-only RTL interface
- Font: Cairo (Google Fonts)
- Color palette: Soft rose/pink primary (#346 80% 65%) + light grays
- Responsive: Desktop + Tablet

## Important Notes
- branchId in products table is nullable (unified pricing across branches)
- users.branchId is NOT NULL
- Schema has isActive field on users table (boolean, default true)
- Seed runs only if no branches exist (idempotent)
- Orders auto-link to open shift for the branch when created
- DB has trigger on orders table (auto-set order_number via trg_orders_set_number) - do not drop
- DB has trigger on sales table (auto-set invoice_number via trg_sales_set_invoice_number) - do not drop
- DB has unique constraint `uniq_open_shift_per_terminal` preventing duplicate open shifts per terminal
- Old DB triggers on sales (validate_shift, require_open_shift, cash_movements) were dropped - logic handled in app code
- **CRITICAL**: schema.ts - always use write tool for schema changes (edit tool corrupts it)
- products.avg_cost and products.stock_qty added via ALTER TABLE (not in Drizzle migration)
- purchase_invoices and purchase_items tables created via psql ALTER/CREATE
