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
- **i18n**: Custom lightweight i18n system (ar/en) with JSON locale files — fully internationalized across all 19 page files
- **Charts**: Recharts (AreaChart, BarChart, PieChart) used in Executive Dashboard

## i18n System
- Provider: `I18nProvider` in `client/src/lib/i18n.tsx` wraps app, stores lang in localStorage
- Hook: `useI18n()` returns `{ t, lang, setLang, dir }` — `t("key.path")` resolves nested JSON keys
- Locale files: `client/src/locales/en.json` and `ar.json` — 1,434 keys each, perfectly matched
- Key namespaces: `app`, `nav`, `sidebar`, `settings`, `login`, `dashboard`, `products`, `orders`, `pos`, `hr`, `invoices`, `purchases`, `purchases_v2`, `reports`, `inventory`, `inventory_page`, `stock_control`, `returns`, `expenses`, `expenses_page`, `finance`, `finance_page`, `audit_log`, `operations`, `executive`, `executive_plus`, `common`, `payment_methods`, `status_labels`, `day_names`, `month_names`, `inv_balances`, `transfers`, `ledger`, `inv_ledger`, `journal`, `accounts`, `supplier_statement`, `mobile`
- Date formatting uses `lang === "ar" ? "ar-OM" : "en-US"` pattern throughout
- All pages import `useI18n` and use `t()` for all user-facing strings
- Language switcher in Settings page persists to localStorage

## Project Structure
```
client/src/
  locales/              → ar.json, en.json (1,434 translation keys each)
  components/layout/    → Sidebar, AppLayout, MobileLayout (bottom nav)
  components/ui/        → shadcn/ui components
  pages/                → Login, Dashboard, POS, Products, Inventory, Orders, Expenses, Settings, Reports, Purchases, Customers
  pages/mobile/         → MobileCustomers, MobileProducts, MobileInventory, MobilePOS, MobileInvoices, MobilePurchases, MobileTransfers, MobileStocktake, MobileMore, MobileOwnerHome, MobileEmployeeHome, MobileShift
  hooks/                → use-toast, use-mobile (768px breakpoint)
  lib/                  → queryClient, auth (AuthProvider/useAuth), i18n (I18nProvider/useI18n), utils
server/
  index.ts              → Express server entry + session setup
  routes.ts             → API routes (/api/*) + requireAuth middleware
  storage.ts            → DatabaseStorage class (Drizzle queries)
  db.ts                 → Database connection
  seed.ts               → Initial data seeding
shared/
  schema.ts             → Drizzle schema + Zod validation
```

## Mobile Experience
- **Detection**: `useIsMobile()` hook (768px breakpoint) — below 768px renders `MobileRouter`, above renders `DesktopRouter`
- **Layout**: `MobileLayout` wraps all mobile pages with fixed bottom navigation bar
- **Navigation**: Role-based bottom nav:
  - **Employee**: Home, POS, Invoices, Shift, More
  - **Owner**: Home (Dashboard), POS, Inventory, Customers, More
- **Mobile Pages**: Fully card-based layouts (no tables), touch-friendly inputs (h-12, text-base), large buttons
  - MobileCustomers: Card list with KPIs, detail dialog, add/edit/delete, WhatsApp
  - MobileProducts: Expandable product cards with inline variant details
  - MobileInventory: Card-based balances + transfers with low stock alerts
  - MobilePOS, MobileInvoices, MobilePurchases, MobileTransfers, MobileStocktake, MobileShift
- **More Menu**: Full navigation hub with icon cards for all owner/employee pages
- **Desktop Unchanged**: Sidebar + table-based layouts preserved for ≥768px

## Accounting Module
- **Auto Journal Entries (server/autoJournal.ts)**: Automatic double-entry journal generation
  - Every financial operation creates a posted journal entry automatically
  - Duplicate prevention: checks `source_type + source_id` before creating
  - Account mapping uses chart of accounts codes (1101=Cash, 1102=Bank, 1301=Inventory, etc.)
  - **Sale** → Dr: Cash/Bank + COGS, Cr: Sales Revenue + VAT + Inventory
  - **Expense** → Dr: General Expenses, Cr: Cash/Bank
  - **Purchase (approval)** → Dr: Inventory, Cr: Supplier Payables
  - **Sale Return** → Dr: Sales Returns + Inventory, Cr: Cash/Bank + COGS
  - **Supplier Payment** → Dr: Supplier Payables, Cr: Cash/Bank
  - **Retroactive generation**: POST /api/journal-entries/generate-retroactive — generates entries for all existing transactions that don't have journal entries yet
- **Chart of Accounts** (Accounts.tsx): Tree view of accounts with hierarchy (parentId), seeded with 24 default accounts
  - Account types: asset, liability, equity, revenue, expense
  - System accounts are read-only; custom accounts can be added/edited
  - API: GET/POST /api/accounts, PATCH /api/accounts/:id, POST /api/accounts/seed
- **Journal Entries** (JournalEntries.tsx): Double-entry bookkeeping
  - Create manual entries with multiple debit/credit lines (must balance)
  - Auto-generated entries from operations arrive as "posted" status
  - Filter by source type: manual, sale, purchase, expense, return, supplier_payment
  - Draft → Posted workflow for manual entries; auto entries are posted immediately
  - API: GET/POST /api/journal-entries, POST /api/journal-entries/:id/post
- **General Ledger + Trial Balance** (GeneralLedger.tsx):
  - General Ledger: Reads from journal_entry_lines (not directly from transactions)
  - Trial Balance: Aggregates posted journal entries per account — always balanced
  - API: GET /api/general-ledger?accountId=, GET /api/trial-balance
- **Supplier Statement**: View purchase history per supplier with running balance (Purchases.tsx)
  - API: GET /api/suppliers/:id/statement
- **Supplier Balance Tracking**: totalPurchases + balance columns on suppliers table
  - Updated on purchase approval, reduced by supplier payments
  - API: POST /api/suppliers/:id/payment
- **Auto-Backup**: Backend scheduler checks hourly, runs daily backup when enabled
  - Settings toggle controls it; keeps last 7 auto-backups

## Authentication & Authorization (Role-Based Access Control)
- **Roles**: `owner`, `admin`, `manager`, `employee`/`cashier`
- Login via POST /api/auth/login (username + password)
- Session stored in PostgreSQL via connect-pg-simple
- GET /api/auth/me returns current user (without password)
- POST /api/auth/logout destroys session
- POST /api/auth/change-password (oldPassword, newPassword) - any logged-in user
- **Sidebar**: Role-based sidebar config in `client/src/config/sidebar.tsx`
  - Owner/Admin: Full management sidebar (Dashboard, Operations, Master Data, Inventory, Purchasing, Finance, Audit, Settings)
  - Employee/Cashier: Operations only (POS, Orders, Invoices, Customers)
  - `getSidebarForRole(role)` returns appropriate sections
- **Frontend Route Guard**: `RequireOwner` component in App.tsx — redirects non-owner/admin to `/pos`
- **API Middleware**:
  - `requireAuth`: All API endpoints (no public endpoints except auth)
  - `requireOwnerOrAdmin`: branches CRUD, cities create, categories create, products CRUD, warehouses create, users, employees, settings PATCH, dashboard executive, reports (branch-comparison, employee-performance), payroll, audit-log
  - `requireManager`: inventory, stock transfers, purchases posting, suppliers, cash deposits/withdrawals, stocktakes, adjustments
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
- **product_variants** (product_id FK, sku unique, barcode unique, color, size, cost_default, price, active) — each product has color/size variants with unique barcode
- **inventory_balances** (location_id FK, variant_id FK, qty_on_hand, qty_reserved) — UNIQUE(location_id, variant_id), variant-level stock per location
- **stock_transfers** (from_location_id, to_location_id, status[draft/approved/cancelled], notes, created_by, approved_at)
- **stock_transfer_lines** (transfer_id FK, variant_id FK, qty) — items in a transfer
- **inventory_ledger** (variant_id, location_id, qty_change, reason, ref_table, ref_id, created_by) — full movement history
- **purchase_extra_costs** (purchase_invoice_id FK, type, amount, notes)
- customers (name, phone[unique normalized], city, address, totalSpent, visits, lastVisit, createdAt) — auto-created via find-or-create by phone
- suppliers
- sales, sale_items (sales have shift_id + payment_method)
- orders, order_items (orders have shift_id + payment_method + paid_at)
- expenses (with shift_id + source: cash/card/bank_transfer + created_by)
- employees, shifts (with expectedCash, actualCash, difference, terminalName)
- **sale_returns** (return_number, sale_id, branch_id, shift_id, refund_amount, refund_method, cogs_returned, reason, created_by)
- **sale_return_items** (return_id, sale_item_id, product_id, quantity, unit_price, unit_cost, line_total, line_cogs)
- **audit_log** (action, entity_type, entity_id, branch_id, user_id, user_name, details, old_value, new_value, ip_address)
- **cash_ledger** (date, branch_id, shift_id, type, amount_in, amount_out, category, note, created_by)
- **bank_ledger** (date, branch_id, shift_id, method[card/bank_transfer], amount_in, amount_out, ref_id, category, note, created_by)
- **purchase_invoices** (invoice_number, supplier_id, branch_id, invoice_date, shipping/customs/clearance/other costs, subtotal, total_extra_cost, grand_total, status[pending/approved])
- **purchase_items** (purchase_id, product_id, variant_id, qty, unit_cost_base, line_subtotal, allocated_extra_cost, unit_cost_final)
- **supplier_ocr_templates** (supplier_id FK, invoice_no_pattern, date_pattern, table_start_keyword, column_order)
- **payroll_runs** (month, year, status[draft/approved], total_basic, total_commission, total_deductions, total_advances, total_net, created_by, approved_by, approved_at)
- **payroll_details** (payroll_id, employee_id, basic_salary, commission, deductions, advances, bonus, net_salary, note)
- **employee_advances** (employee_id, amount, date, note, settled, settled_in_payroll_id, created_by)
- **employee_deductions** (employee_id, amount, reason, date, applied_in_payroll_id, created_by)
- users table extended: salary_type (monthly/daily/commission), commission_rate (decimal 5,2)
- **session** (auto-created by connect-pg-simple)

## Payroll System
- Users have salary_type (monthly/daily/commission) and commission_rate
- Create payroll run for a month/year → auto-generates details for all active non-owner employees
- Each detail row: basic_salary + commission (auto-calculated from sales if commission type) - deductions - advances = net_salary
- Advances: unsettled advances are deducted in payroll; settled when payroll is approved
- Deductions: unapplied deductions are deducted in payroll; marked as applied when approved
- Draft payroll can be regenerated (recalculated); approved payroll is final
- HR page has 5 tabs: Employees, Payroll Runs, Advances, Deductions, Performance

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

## Multi-Location Inventory System (Unified Dual-Track)
- **Central Warehouse** (المخزن المركزي): One company-wide location, `is_central=true`, `branch_id=NULL`
- **Branch Default Store** (مخزن الفرع): One per branch, `is_branch_default=true` — receives stock from central
- **Dual inventory tracking** (kept in sync by all operations):
  - `inventory_balances` + `inventory_ledger`: Variant-level tracking (modern system) — used by Inventory page, balances API, transfers
  - `location_inventory` + `inventory_transactions`: Product-level tracking (legacy) — used by POS stock checks, dashboard KPIs, low stock alerts
- **Full flow**: Purchase → approve → Central WH (`inventory_balances` + `location_inventory`) → Transfer → Branch → POS Sale → deducts both systems → Return → adds back both
- **Purchase Approval** → stock enters Central Warehouse; auto-creates default variant if missing; updates both systems + `inventory_ledger`
- **Stock Transfers** (variant-level): draft → add lines → approve; deducts source, adds destination in both systems + logs ledger
- **POS Sales**: looks up product's default variant → deducts from `inventory_balances` at branch default location + deducts `location_inventory`
- **Sale Returns**: adds back to `inventory_balances` + `location_inventory` + logs ledger
- **Stocktake Adjustments**: syncs both systems + logs to ledger
- Frontend Inventory tabs: أرصدة المخزون, التحويلات, سجل الحركات
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

## Shift System (Professional POS)
- **Open Shift**: POS requires opening a shift with opening cash before any sales
- **Close Shift** button in POS header with full pre-close summary dialog
- Cannot close shift if pending orders exist (status: new/processing/pending)
- Pre-close dialog shows: live shift report (sales by payment method, expenses, cash reconciliation)
- expected_cash = openingCash + (sum cash orders paid + sum cash POS sales) - sum cash expenses + deposits - withdrawals
- actual_cash entered by user at close time with live difference calculation
- difference = actual - expected, recorded in cash_ledger as type=shift_difference
- Post-close: receipt-style shift report with full breakdown + print button + new shift button
- totalSales, totalCash, totalBank all include both orders + POS sales

## Daily Accounting (المحاسبة اليومية)
- **Cash Ledger** (/finance tab "دفتر النقد"): daily view of all cash movements (sales, expenses, deposits, withdrawals, shift differences)
- **Bank Ledger** (/finance tab "دفتر البنك"): read-only, auto-populated from card/bank sales and expenses
- **Cash Difference** (/finance tab "فرق الصندوق"): closed shifts with expected vs actual vs difference per shift
- Summary cards: opening cash, cash sales, expenses, deposits, withdrawals, net cash
- Deposit/Withdrawal endpoints (requireManager): POST /api/cash-ledger/deposit, POST /api/cash-ledger/withdrawal
- API: GET /api/cash-ledger?date=..., GET /api/bank-ledger?date=..., GET /api/cash-ledger/summary?date=..., GET /api/shifts/closed?date=...

## Key Features
1. **Login**: Username/password authentication, session-based
2. **Dashboard**: Daily sales, VAT, order count, low-stock alerts, weekly chart
3. **POS**: Session-based branch/cashier (read-only), barcode scan, cart, discount, VAT 5%, cash/card/bank payment, shift open/check
4. **Products**: Product Master with Variants (color/size/barcode unique per variant), category, unified price, active toggle
5. **Inventory**: Variant-based inventory with 3 tabs: Balances by location, Stock Transfers (draft→approve with balance check), Movement Ledger
6. **Orders**: WhatsApp/Instagram orders, auto-branch assignment by city, status tracking, payment recording
7. **Expenses**: Categorized expenses per branch with source tracking + ledger integration (tabbed: expenses / cash ledger / bank ledger)
8. **Shift Reports**: GET /api/reports/shift?shiftId=... → cash/card/bank sales, expenses, expected vs actual cash
9. **Settings**: Tabbed interface - account (change password), users (owner/admin), general settings, branches & cities
10. **Reports**: Shift report + Daily report (with COGS/Profit analysis) + Branch comparison report + Profit reports (by branch/employee/product)
11. **Purchases**: Full purchase invoice system with Average Cost calculation, extra cost allocation, posting workflow, OCR invoice image scanning (Tesseract + sharp preprocessing)
12. **COGS/Profit**: Automatic cost tracking on sales and order payments with profit analysis
13. **Export**: Daily report Excel/PDF export, multi-branch profit Excel export (date range), sales invoices Excel export, inventory Excel export, purchases Excel export, individual invoice PDF export
14. **Invoices (فواتير نقطة البيع)**: POS sales invoice browser with filters (date, payment method, employee, branch), detail modal with PDF download + thermal 80mm receipt print + A4 print, Excel export
15. **Thermal Receipt**: Auto-print 80mm thermal receipt on POS sale completion; reprint from Invoices page
16. **Stocktake (الجرد والتسويات)**: Create stocktake sessions per branch/location, count items vs system qty, approve to auto-adjust inventory, manual adjustments (+/-), variance report by product
17. **i18n (Arabic/English)**: Language selector in Settings > General > Preferences; per-user `ui_language` stored in DB; dynamic RTL/LTR switching; sidebar + settings page fully translated

## API Routes
All prefixed with `/api/`:
- POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`, POST `/auth/change-password`, PATCH `/me/settings` (uiLanguage)
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
- GET `/exports/daily.xlsx?date=...&branchId=...`, GET `/exports/daily.pdf?date=...&branchId=...`, GET `/exports/profit_all_branches.xlsx?from=...&to=...`, GET `/exports/profit_by_employee.xlsx?from=...&to=...&branchId=...`, GET `/exports/profit_by_product.xlsx?from=...&to=...&branchId=...`, GET `/exports/sales.xlsx?from=...&to=...&branchId=...&paymentMethod=...&employeeId=...`, GET `/exports/invoice.pdf?id=...`, GET `/exports/inventory.xlsx?branchId=...`, GET `/exports/purchases.xlsx?from=...&to=...&branchId=...` (requireAuth)
- GET/POST `/stocktakes`, GET `/stocktakes/:id/items`, PATCH `/stocktake-items/:id`, POST `/stocktakes/:id/approve` (requireAuth + requireManager/requireOwnerOrAdmin)
- GET/POST `/inventory-adjustments` (requireAuth + requireManager)
- GET `/dashboard`
- GET/POST `/products/:id/variants`, PATCH/DELETE `/variants/:id`, GET `/variants/barcode/:barcode`, POST `/variants/quick-create`
- GET `/inventory-balances?locationId=`, GET/POST `/stock-transfers`, POST `/stock-transfers/:id/lines`, POST `/stock-transfers/:id/approve`
- GET `/inventory-ledger?locationId=&variantId=`

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
