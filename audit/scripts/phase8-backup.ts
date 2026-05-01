/**
 * Phase 8 — Full backup + pre-reset snapshot
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const ALL_TABLES = [
  // Transactional (will be cleared)
  "products", "product_variants", "customers", "suppliers",
  "sales", "sale_items", "sale_returns",
  "purchases", "purchase_invoices", "purchase_items", "purchase_returns",
  "payments", "customer_payments", "supplier_payments",
  "inventory", "location_inventory", "inventory_movements",
  "inventory_adjustments", "inventory_ledger", "inventory_balances",
  "stocktakes", "stocktake_items",
  "cash_sessions", "shifts", "cash_movements", "cash_ledger", "bank_ledger",
  "expenses",
  "journal_entries", "journal_entry_lines",
  "orders", "order_items",
  "attachments", "notifications", "audit_logs",
  "sale_return_items",
  // Config (will be preserved)
  "users", "branches", "locations", "warehouses", "categories",
  "accounts", "settings", "payment_methods", "tax_settings",
  "print_templates", "system_config",
];

async function run() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join("audit", "backups");
  const outFile = path.join(outDir, `pre-reset-${ts}.json`);
  const snapshotFile = path.join("audit", "reports", "pre-reset-snapshot.json");

  console.log(`\n[Phase 8 Backup] Starting — ${ts}`);
  const backup: Record<string, { count: number; rows: any[] }> = {};
  const snapshot: Record<string, number> = {};
  let totalRows = 0;

  for (const table of ALL_TABLES) {
    try {
      const res = await pool.query(`SELECT * FROM ${table} LIMIT 100000`);
      backup[table] = { count: res.rowCount ?? 0, rows: res.rows };
      snapshot[table] = res.rowCount ?? 0;
      totalRows += res.rowCount ?? 0;
      console.log(`  ✅ ${table}: ${res.rowCount} rows`);
    } catch (e: any) {
      console.log(`  ⚠️  ${table}: ${e.message} (skipped)`);
      snapshot[table] = -1;
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  fs.writeFileSync(snapshotFile, JSON.stringify({ timestamp: ts, counts: snapshot, totalRows }, null, 2));

  const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`\n[Backup] ✅ Saved: ${outFile} (${sizeMB} MB)`);
  console.log(`[Snapshot] ✅ Saved: ${snapshotFile}`);
  console.log(`[Backup] Total rows: ${totalRows}`);

  await pool.end();
  return outFile;
}

run().catch((e) => { console.error(e); process.exit(1); });
