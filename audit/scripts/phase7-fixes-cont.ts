/**
 * Phase 7 — Fixes continuation: FIX4, FIX5, FIX6
 */
import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const report: Record<string, any> = {
  timestamp: new Date().toISOString(),
  fixes: {},
};

function log(msg: string) { console.log(msg); }
function section(title: string) { log(`\n${"═".repeat(60)}\n${title}\n${"═".repeat(60)}`); }

async function withFix(
  name: string,
  fn: (client: PoolClient) => Promise<{ rowsAffected: number; details: any }>
) {
  section(`FIX: ${name}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    log(`✅ COMMITTED — rows affected: ${result.rowsAffected}`);
    report.fixes[name] = { status: "OK", ...result };
  } catch (e: any) {
    await client.query("ROLLBACK");
    log(`❌ ROLLED BACK — ${e.message}`);
    report.fixes[name] = { status: "ROLLBACK", error: e.message };
    throw e;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
// FIX 4: ISS-004 — نظام المخزون المزدوج (warehouses investigation)
// ══════════════════════════════════════════════════════════════
async function fix4_dualInventory() {
  section("FIX4: Dual Inventory Investigation (ISS-004)");
  const client = await pool.connect();
  try {
    // Get warehouses columns first
    const colRes = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'warehouses' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const cols = colRes.rows.map(r => r.column_name);
    log(`  warehouses columns: ${cols.join(", ")}`);

    const whRes = await client.query(`SELECT * FROM warehouses ORDER BY id`);
    const invRes = await client.query(`SELECT COUNT(*) as cnt FROM inventory`);
    const locRes = await client.query(`SELECT COUNT(*) as cnt FROM locations`);
    const liRes  = await client.query(`SELECT COUNT(*) as cnt FROM location_inventory`);

    log(`  warehouses rows: ${whRes.rowCount}`);
    whRes.rows.forEach(r => log(`  → ${JSON.stringify(r)}`));
    log(`  inventory (old) rows: ${invRes.rows[0].cnt}`);
    log(`  locations (new) rows: ${locRes.rows[0].cnt}`);
    log(`  location_inventory rows: ${liRes.rows[0].cnt}`);

    const oldInventoryCount = parseInt(invRes.rows[0].cnt);
    const decision = oldInventoryCount === 0
      ? "DECISION: locations/location_inventory هو المصدر الوحيد للحقيقة — inventory القديم فارغ تماماً"
      : `DECISION: يحتاج دراسة — inventory القديم فيه ${oldInventoryCount} صف`;

    log(`\n  ${decision}`);
    log(`  ✅ warehouses موجودة كـ legacy metadata — لا تعديلات مطلوبة`);

    report.fixes["FIX4_dual_inventory"] = {
      status: "DOCUMENTED",
      warehousesColumns: cols,
      warehouses: { count: whRes.rowCount, rows: whRes.rows },
      inventory_old: { count: oldInventoryCount },
      locations: { count: parseInt(locRes.rows[0].cnt) },
      location_inventory: { count: parseInt(liRes.rows[0].cnt) },
      decision,
      action: oldInventoryCount === 0
        ? "No migration needed — old inventory table empty. Locations system is sole source of truth."
        : "Requires manual review — both systems have data",
    };
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
// FIX 5: avg_cost للمنتجات (من فواتير الشراء)
// ══════════════════════════════════════════════════════════════
async function fix5_avgCost() {
  section("FIX5: Product avg_cost from Purchase Invoices");
  const client = await pool.connect();
  try {
    // Check purchase_items columns
    const colRes = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_items' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const cols = colRes.rows.map(r => r.column_name);
    log(`  purchase_items columns: ${cols.join(", ")}`);

    // Adapt query to actual columns — try unit_cost and quantity
    const hasTotalCost = cols.includes("total_cost");
    const hasUnitCost  = cols.includes("unit_cost") || cols.includes("unit_cost_final");
    const costCol      = hasTotalCost ? "total_cost" : hasUnitCost ? (cols.includes("unit_cost_final") ? "unit_cost_final" : "unit_cost") : null;
    const qtyCol       = cols.includes("quantity") ? "quantity" : cols.includes("qty") ? "qty" : null;

    log(`  Cost column: ${costCol}, Qty column: ${qtyCol}`);

    if (!costCol || !qtyCol) {
      log(`  ⚠️  Cannot determine cost/qty columns — skipping`);
      report.fixes["FIX5_avg_cost"] = { status: "SKIPPED", reason: `Cannot find cost/qty columns in purchase_items. Columns: ${cols.join(",")}` };
      return;
    }

    // Build avg_cost calculation
    const calcQuery = hasTotalCost
      ? `SUM(pi_items.${costCol}::numeric) / NULLIF(SUM(pi_items.${qtyCol}::numeric), 0)`
      : `SUM(pi_items.${costCol}::numeric * pi_items.${qtyCol}::numeric) / NULLIF(SUM(pi_items.${qtyCol}::numeric), 0)`;

    const needy = await client.query(`
      SELECT p.id, p.name, p.avg_cost, pi_calc.calc_avg
      FROM products p
      LEFT JOIN (
        SELECT pi_items.product_id, ${calcQuery} as calc_avg
        FROM purchase_items pi_items
        JOIN purchase_invoices piv ON piv.id = pi_items.purchase_id
        WHERE piv.status = 'approved'
        GROUP BY pi_items.product_id
      ) pi_calc ON pi_calc.product_id = p.id
      WHERE (p.avg_cost IS NULL OR p.avg_cost::numeric = 0)
        AND pi_calc.calc_avg IS NOT NULL AND pi_calc.calc_avg > 0
    `);

    log(`  Products with avg_cost=0 but purchase history: ${needy.rowCount}`);
    needy.rows.forEach(r =>
      log(`  → ${r.name}: current=${r.avg_cost}, calculated=${parseFloat(r.calc_avg).toFixed(3)}`)
    );

    if (needy.rowCount === 0) {
      log(`  ✅ SKIP: No products need avg_cost update`);
      report.fixes["FIX5_avg_cost"] = { status: "SKIPPED", reason: "No products with avg_cost=0 that have purchase history" };
    } else {
      await client.query("BEGIN");
      const upd = await client.query(`
        UPDATE products p
        SET avg_cost = pi_calc.calc_avg::numeric::text
        FROM (
          SELECT pi_items.product_id, ${calcQuery} as calc_avg
          FROM purchase_items pi_items
          JOIN purchase_invoices piv ON piv.id = pi_items.purchase_id
          WHERE piv.status = 'approved'
          GROUP BY pi_items.product_id
        ) pi_calc
        WHERE pi_calc.product_id = p.id
          AND (p.avg_cost IS NULL OR p.avg_cost::numeric = 0)
          AND pi_calc.calc_avg > 0
      `);
      await client.query("COMMIT");
      log(`  ✅ Updated avg_cost for ${upd.rowCount} products`);
      report.fixes["FIX5_avg_cost"] = { status: "OK", rowsAffected: upd.rowCount };
    }

    // Export products still needing manual review
    const flagged = await client.query(`
      SELECT p.id, p.name, p.avg_cost::text, p.price::text,
             COUNT(si.id) as sales_count,
             COALESCE(SUM(si.quantity::numeric), 0) as units_sold
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      WHERE p.avg_cost IS NULL OR p.avg_cost::numeric = 0
      GROUP BY p.id, p.name, p.avg_cost, p.price
      ORDER BY sales_count DESC
    `);

    const csvPath = path.join("audit", "reports", "products-needing-cost-review.csv");
    const csv = ["id,name,avg_cost,price,sales_count,units_sold",
      ...flagged.rows.map(r => `${r.id},"${r.name}",${r.avg_cost},${r.price},${r.sales_count},${r.units_sold}`)
    ].join("\n");
    fs.writeFileSync(csvPath, csv);
    log(`  📄 Products still needing cost review: ${csvPath} (${flagged.rowCount} rows)`);
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
// FIX 6: إعادة حساب suppliers.total_purchases
// ══════════════════════════════════════════════════════════════
async function fix6_supplierTotals() {
  await withFix("FIX6_supplier_total_purchases", async (client) => {
    const before = await client.query(`
      SELECT s.id, s.name,
             COALESCE(s.total_purchases::numeric, 0) as stored,
             COALESCE(pi.actual, 0) as correct
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total::numeric) as actual
        FROM purchase_invoices WHERE status = 'approved'
        GROUP BY supplier_id
      ) pi ON pi.supplier_id = s.id
    `);
    log(`  Suppliers found: ${before.rowCount}`);
    before.rows.forEach(r =>
      log(`  → ${r.name}: stored=${parseFloat(r.stored).toFixed(3)}, correct=${parseFloat(r.correct).toFixed(3)}, drift=${(parseFloat(r.stored) - parseFloat(r.correct)).toFixed(3)}`)
    );

    const upd = await client.query(`
      UPDATE suppliers s
      SET total_purchases = COALESCE((
        SELECT SUM(grand_total::numeric)
        FROM purchase_invoices
        WHERE supplier_id = s.id AND status = 'approved'
      ), 0)
    `);

    const verify = await client.query(`
      SELECT COUNT(*) as drift
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total::numeric) as actual
        FROM purchase_invoices WHERE status = 'approved' GROUP BY supplier_id
      ) pi ON pi.supplier_id = s.id
      WHERE ABS(COALESCE(s.total_purchases::numeric,0) - COALESCE(pi.actual,0)) > 0.01
    `);
    if (parseInt(verify.rows[0].drift) > 0) throw new Error("Verification failed: supplier drift remains");
    log(`  ✅ Verification passed`);

    return { rowsAffected: upd.rowCount ?? 0, details: { suppliersBefore: before.rows } };
  });
}

async function main() {
  log("\n🔄 PHASE 7 — FIXES CONTINUATION (FIX4, FIX5, FIX6)");

  await fix4_dualInventory();
  await fix5_avgCost();
  await fix6_supplierTotals();

  const reportPath = path.join("audit", "reports", "phase-7-fixes-cont-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n✅ ALL CONTINUATION FIXES COMPLETE — ${reportPath}`);
  await pool.end();
}

main().catch((e) => { console.error("\n❌ FATAL:", e.message); pool.end(); process.exit(1); });
