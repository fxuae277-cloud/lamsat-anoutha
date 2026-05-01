/**
 * Phase 8 — Check extra tables found via sequences
 */
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const EXTRA_TABLES = [
  "held_invoices", "owner_transactions", "purchase_attachments",
  "transfer_scans", "stock_transfers", "stock_transfer_lines",
  "opening_stock_entries", "opening_stock_items", "opening_stock_audit",
  "account_balances", "expense_categories", "roles", "permissions",
  "password_history", "role_permissions",
];

async function run() {
  const client = await pool.connect();
  console.log("\n=== Extra Tables Check ===");
  for (const t of EXTRA_TABLES) {
    try {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      // Get first row for context
      const sample = await client.query(`SELECT * FROM ${t} LIMIT 1`);
      const cols = sample.fields.map(f => f.name).slice(0, 5).join(", ");
      console.log(`  ${t}: ${res.rows[0].cnt} rows | cols: ${cols}`);
    } catch (e: any) {
      console.log(`  ${t}: NOT EXISTS`);
    }
  }
  client.release();
  await pool.end();
}

run().catch(console.error);
