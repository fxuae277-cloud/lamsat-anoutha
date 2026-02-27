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
- orders, order_items
- expenses
- employees, shifts

## Key Features
1. **Dashboard**: Daily sales, VAT, order count, low-stock alerts, weekly chart
2. **POS**: Branch/cashier selection, barcode scan, cart, discount, VAT 5%, cash/bank payment
3. **Products**: CRUD with barcode, category, unified price, active toggle
4. **Inventory**: Main + branch warehouses, receive stock, transfer between warehouses, low-stock alerts
5. **Orders**: WhatsApp/Instagram orders, auto-branch assignment by city, status tracking
6. **Expenses**: Categorized expenses per branch with receipt upload support
7. **Settings**: Branches, users/roles, cities mapping, VAT config

## API Routes
All prefixed with `/api/`:
- GET/POST `/branches`, `/categories`, `/products`, `/warehouses`
- GET/POST/PATCH/DELETE `/products/:id`
- GET/POST `/inventory`, `/inventory/receive`, `/inventory/transfer`
- GET/POST `/sales`, `/orders`, `/expenses`, `/employees`, `/shifts`
- PATCH `/orders/:id/status`, `/shifts/:id/close`
- GET `/dashboard`

## Design
- Arabic-only RTL interface
- Font: Cairo (Google Fonts)
- Color palette: Soft rose/pink primary (#346 80% 65%) + light grays
- Responsive: Desktop + Tablet
