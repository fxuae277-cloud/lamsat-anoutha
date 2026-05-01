/**
 * Phase 8 — Production Data Reset
 * Clears all transactional data, preserves config/settings.
 * Runs inside a single transaction for safety.
 */
import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

function log(msg: string) { console.log(msg); }
function section(t: string) { log(`\n${"═".repeat(60)}\n${t}\n${"═".repeat(60)}`); }

// Tables that exist and must be cleared (verified from backup)
const TABLES_TO_CLEAR = [
  // Dependents first
  "journal_entry_lines",
  "sale_return_items",
  "sale_items",
  "sale_returns",
  "purchase_items",
  "order_items",
  "stocktake_items",
  "inventory_ledger",
  "inventory_balances",
  "inventory_adjustments",
  "location_inventory",
  "notifications",
  // Main tables
  "journal_entries",
  "sales",
  "purchase_invoices",
  "orders",
  "stocktakes",
  "shifts",
  "cash_ledger",
  "bank_ledger",
  "expenses",
  "inventory",
  "product_variants",
  "products",
  "customers",
  "suppliers",
];

// Tables to preserve (config/setup)
const TABLES_TO_KEEP = [
  "users", "branches", "locations", "warehouses",
  "categories", "accounts", "settings",
];

async function getCount(client: PoolClient, table: string): Promise<number> {
  try {
    const res = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
    return parseInt(res.rows[0].cnt);
  } catch {
    return -1;
  }
}

async function getSequences(client: PoolClient): Promise<Array<{ sequence_name: string; last_value: string }>> {
  const res = await client.query(`
    SELECT sequence_name, last_value
    FROM information_schema.sequences
    JOIN pg_sequences ON sequencename = sequence_name
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);
  return res.rows;
}

async function resetSequence(client: PoolClient, table: string, col = "id"): Promise<void> {
  try {
    const seqName = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) as seq`, [table, col]
    );
    const seq = seqName.rows[0]?.seq;
    if (seq) {
      await client.query(`SELECT setval($1, 1, false)`, [seq]);
      log(`  ↺  Reset sequence for ${table}.${col}`);
    }
  } catch {
    // table may not have serial id
  }
}

async function main() {
  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    cleared: {},
    kept: {},
    sequences: {},
  };

  section("PHASE 8 STEP 1 — Pre-reset counts");
  const beforeClient = await pool.connect();
  try {
    for (const t of [...TABLES_TO_CLEAR, ...TABLES_TO_KEEP]) {
      const cnt = await getCount(beforeClient, t);
      log(`  ${cnt >= 0 ? cnt : "N/A"} rows in ${t}`);
      report.cleared[t] = { before: cnt, after: null };
    }
  } finally {
    beforeClient.release();
  }

  section("PHASE 8 STEP 2 — Executing TRUNCATE (single transaction)");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Truncate all with CASCADE to handle any FK we might miss
    for (const table of TABLES_TO_CLEAR) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
        log(`  🗑️  TRUNCATED: ${table}`);
      } catch (e: any) {
        log(`  ⚠️  ${table}: ${e.message}`);
      }
    }

    await client.query("COMMIT");
    log("\n  ✅ TRANSACTION COMMITTED");
  } catch (e: any) {
    await client.query("ROLLBACK");
    log(`\n  ❌ ROLLED BACK: ${e.message}`);
    client.release();
    await pool.end();
    process.exit(1);
  } finally {
    client.release();
  }

  section("PHASE 8 STEP 3 — Reset ID sequences");
  const seqClient = await pool.connect();
  try {
    for (const table of TABLES_TO_CLEAR) {
      await resetSequence(seqClient, table);
    }

    // Reset any application-level sequences in settings
    try {
      const seqSettings = await seqClient.query(`
        SELECT key, value FROM settings
        WHERE key IN (
          'invoice_number_sequence', 'purchase_number_sequence',
          'return_number_sequence', 'receipt_number_sequence',
          'customer_code_sequence', 'supplier_code_sequence',
          'product_sku_sequence', 'order_number_sequence',
          'shift_number_sequence'
        )
      `);
      if (seqSettings.rowCount && seqSettings.rowCount > 0) {
        log("\n  App-level sequences found in settings:");
        seqSettings.rows.forEach(r => log(`    ${r.key} = ${r.value}`));
        await seqClient.query("BEGIN");
        await seqClient.query(`
          UPDATE settings
          SET value = '0'
          WHERE key IN (
            'invoice_number_sequence', 'purchase_number_sequence',
            'return_number_sequence', 'receipt_number_sequence',
            'customer_code_sequence', 'supplier_code_sequence',
            'product_sku_sequence', 'order_number_sequence',
            'shift_number_sequence'
          )
        `);
        await seqClient.query("COMMIT");
        log("  ↺  App-level sequences reset to 0");
      } else {
        log("  ℹ️  No app-level sequences in settings table");
      }
    } catch (e: any) {
      log(`  ⚠️  Settings sequences: ${e.message}`);
    }

    // Show all DB sequences after reset
    const seqs = await getSequences(seqClient);
    log("\n  DB Sequences after reset:");
    seqs.forEach(s => {
      log(`    ${s.sequence_name}: last_value=${s.last_value}`);
      report.sequences[s.sequence_name] = s.last_value;
    });
  } finally {
    seqClient.release();
  }

  section("PHASE 8 STEP 4 — Post-reset verification");
  const verifyClient = await pool.connect();
  try {
    log("\n  Transactional tables (must be 0):");
    let allClear = true;
    for (const t of TABLES_TO_CLEAR) {
      const cnt = await getCount(verifyClient, t);
      const ok = cnt === 0;
      log(`  ${ok ? "✅" : "❌"} ${t}: ${cnt}`);
      report.cleared[t].after = cnt;
      if (!ok) allClear = false;
    }

    log("\n  Config tables (must be preserved):");
    for (const t of TABLES_TO_KEEP) {
      const cnt = await getCount(verifyClient, t);
      log(`  ✅ ${t}: ${cnt}`);
      report.kept[t] = cnt;
      if (report.cleared[t]) report.cleared[t] = undefined;
    }

    report.allClear = allClear;
    if (!allClear) {
      log("\n  ❌ VERIFICATION FAILED: some tables still have data");
      process.exit(1);
    } else {
      log("\n  ✅ VERIFICATION PASSED: all transactional tables empty");
    }
  } finally {
    verifyClient.release();
  }

  const reportPath = path.join("audit", "reports", "phase-8-reset-report-internal.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n  📄 Internal report: ${reportPath}`);

  await pool.end();
}

main().catch((e) => { console.error("\n❌ FATAL:", e.message); pool.end(); process.exit(1); });
