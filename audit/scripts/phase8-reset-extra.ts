/**
 * Phase 8 — Clear remaining transactional tables found in extra check
 */
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

// Transactional tables discovered in extra check
const EXTRA_TRANSACTIONAL = [
  "transfer_scans",       // stock transfer scan records
  "stock_transfer_lines", // stock transfer line items
  "stock_transfers",      // stock transfer headers
  "held_invoices",        // parked/held sales
  "owner_transactions",   // owner cash in/out movements
  "purchase_attachments", // attachments to purchase invoices
  "opening_stock_audit",  // opening stock audit trail
  "opening_stock_items",  // opening stock items
  "opening_stock_entries",// opening stock entries
  "account_balances",     // derived account balance cache
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== Clearing extra transactional tables ===");
    await client.query("BEGIN");
    for (const t of EXTRA_TRANSACTIONAL) {
      try {
        await client.query(`TRUNCATE TABLE ${t} CASCADE`);
        console.log(`  🗑️  TRUNCATED: ${t}`);
        // Reset sequence
        try {
          const seq = await client.query(`SELECT pg_get_serial_sequence($1, 'id') as s`, [t]);
          if (seq.rows[0]?.s) {
            await client.query(`SELECT setval($1, 1, false)`, [seq.rows[0].s]);
            console.log(`  ↺  Reset sequence: ${t}.id`);
          }
        } catch {}
      } catch (e: any) {
        console.log(`  ⚠️  ${t}: ${e.message}`);
      }
    }
    await client.query("COMMIT");
    console.log("\n  ✅ COMMITTED");

    // Verify
    console.log("\n=== Verification ===");
    for (const t of EXTRA_TRANSACTIONAL) {
      try {
        const res = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`);
        console.log(`  ${parseInt(res.rows[0].cnt) === 0 ? "✅" : "❌"} ${t}: ${res.rows[0].cnt}`);
      } catch (e: any) {
        console.log(`  ⚠️  ${t}: not found`);
      }
    }
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.log(`\n  ❌ ROLLBACK: ${e.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
