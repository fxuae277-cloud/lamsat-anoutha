/**
 * Phase 7 Backup — exports critical tables as JSON before data reconciliation
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const DB_URL = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const CRITICAL_TABLES = [
  "products",
  "customers",
  "sales",
  "sale_items",
  "sale_returns",
  "journal_entries",
  "journal_entry_lines",
  "suppliers",
  "purchase_invoices",
  "location_inventory",
  "inventory_balances",
  "shifts",
  "cash_ledger",
  "bank_ledger",
];

async function backup() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join("audit", "backups");
  const outFile = path.join(outDir, `pre-phase-7-${ts}.json`);

  console.log(`[Backup] Starting — ${ts}`);
  const backup: Record<string, { count: number; rows: any[] }> = {};
  let totalRows = 0;

  for (const table of CRITICAL_TABLES) {
    try {
      const res = await pool.query(`SELECT * FROM ${table} LIMIT 50000`);
      backup[table] = { count: res.rowCount ?? 0, rows: res.rows };
      totalRows += res.rowCount ?? 0;
      console.log(`  ✅ ${table}: ${res.rowCount} rows`);
    } catch (e: any) {
      console.log(`  ⚠️  ${table}: ${e.message} (skipped)`);
      backup[table] = { count: 0, rows: [] };
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`\n[Backup] ✅ Saved: ${outFile}`);
  console.log(`[Backup] Size: ${sizeMB} MB | Total rows: ${totalRows}`);
  console.log(`[Backup] File: ${outFile}`);

  if (parseFloat(sizeMB) < 0.001 && totalRows === 0) {
    console.error("[Backup] ❌ WARNING: backup appears empty!");
    process.exit(1);
  }

  await pool.end();
  return outFile;
}

backup().catch((e) => { console.error(e); process.exit(1); });
